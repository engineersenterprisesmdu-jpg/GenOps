/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { AppDatabase, Genset, SiteLog } from '../types';
import { formatCurrency, formatMinutesToTime } from '../utils/time';
import { 
  Building2, 
  Settings, 
  Layers, 
  Calculator, 
  History, 
  FileCheck, 
  FileText,
  AlertTriangle,
  Zap,
  TrendingUp,
  Fuel,
  CheckCircle2,
  HelpCircle,
  Clock,
  Printer,
  ChevronRight,
  Search,
  Filter,
  CheckSquare,
  DollarSign,
  Calendar,
  CreditCard,
  CalendarRange,
  X
} from 'lucide-react';

interface DashboardProps {
  db: AppDatabase;
  onNavigate: (tab: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
}

export default function Dashboard({ db, onNavigate, selectedMonth, setSelectedMonth, onUpdateDb }: DashboardProps) {
  // Available chronological options for ranges
  const chronologicalMonths = useMemo(() => {
    const months = new Set<string>();
    db.siteLogs.forEach(log => {
      if (log.monthKey) months.add(log.monthKey);
    });
    
    // Populate standard monthly keys for range selectivity
    const today = new Date();
    for (let i = -12; i <= 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.add(key);
    }
    return Array.from(months).sort();
  }, [db.siteLogs]);

  const reverseChronologicalMonths = useMemo(() => {
    return [...chronologicalMonths].reverse();
  }, [chronologicalMonths]);

  // Dashboard configuration states
  const [periodType, setPeriodType] = useState<'single' | 'range'>('single');
  const [startMonth, setStartMonth] = useState<string>('2026-01');
  const [endMonth, setEndMonth] = useState<string>('2026-12');
  
  // Dashboard Sub-tabs
  const [dashboardSubTab, setDashboardSubTab] = useState<'logs' | 'payments'>('logs');

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'entered' | 'pending' | 'mismatch'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'received' | 'pending'>('all');

  // Multi-edit state for tracking payment collections inputs dynamically
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPayDate, setEditPayDate] = useState('');
  const [editPayRef, setEditPayRef] = useState('');

  // activeMonths included based on selection
  const activePeriodMonths = useMemo(() => {
    if (periodType === 'single') {
      return [selectedMonth];
    } else {
      return chronologicalMonths.filter(m => m >= startMonth && m <= endMonth);
    }
  }, [periodType, selectedMonth, startMonth, endMonth, chronologicalMonths]);

  // Safe meter diff parser
  function parseMeterDiff(startStr: string, endStr: string): number {
    const parse = (s: string) => {
      const v = s.trim();
      if (v.includes(':')) {
        const parts = v.split(':');
        return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
      } else {
        return Math.round((parseFloat(v) || 0) * 60);
      }
    };
    return Math.abs(parse(endStr) - parse(startStr));
  }

  // Compile every potential log combination for active month(s) & place(s)
  const computedLogs = useMemo(() => {
    const list: Array<{
      id: string;
      genset: Genset;
      monthKey: string;
      monthLabel: string;
      log: SiteLog | null;
      isEntered: boolean;
      clockHrsStr: string;
      clockMins: number;
      meterMins: number;
      isMismatch: boolean;
      fuelPrice: number;
      subtotalCost?: number;
      taxesTotal?: number;
      grandTotal: number;
      isPaid: boolean;
      billNo: string;
      billDate: string;
      paymentDate: string;
      paymentRef: string;
    }> = [];

    activePeriodMonths.forEach(mKey => {
      const [year, month] = mKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      // Grab relevant diesel rates
      const currentMonthPrices = db.zonePrices.filter(zp => zp.monthKey === mKey);

      db.gensets.forEach(g => {
        const log = db.siteLogs.find(l => l.gensetId === g.id && l.monthKey === mKey);
        
        // Find average fuel price for this month & genset subzone
        const client = db.clients.find(c => c.id === g.clientId);
        const zoneName = client?.zone || '';
        const nameLower = g.siteName.toLowerCase();
        
        const matchedName = 
          nameLower.includes('salem') ? 'Salem Area' :
          nameLower.includes('namakkal') ? 'Namakkal Area' :
          nameLower.includes('pathanam') ? 'Pathanam Area' :
          nameLower.includes('kottayam') ? 'Kottayam Area' :
          nameLower.includes('idukki') ? 'Idukki Area' :
          nameLower.includes('alapuzha') ? 'Alapuzha Area' :
          zoneName.toLowerCase().includes('salem') ? 'Salem Area' :
          zoneName.toLowerCase().includes('kottayam') ? 'Kottayam Area' :
          'Salem Area';

        const priceConfig = currentMonthPrices.find(zp => zp.zoneName.toLowerCase() === matchedName.toLowerCase());
        const fuelPrice = priceConfig ? priceConfig.averagePrice : (mKey === '2026-04' ? 93.35 : 0);

        // Billing calculations
        const clockMins = log ? log.entries.reduce((sum, e) => sum + e.durationMinutes, 0) : 0;
        const totalHrsDec = clockMins / 60;
        const costPerHour = parseFloat((g.dieselQuantityPerHour * fuelPrice).toFixed(2));
        const subtotalCost = Math.round(costPerHour * totalHrsDec);

        let cgst = 0, sgst = 0, igst = 0;
        if (g.gstType === 'CGST_SGST') {
          cgst = parseFloat((subtotalCost * 0.09).toFixed(2));
          sgst = parseFloat((subtotalCost * 0.09).toFixed(2));
        } else {
          igst = parseFloat((subtotalCost * 0.18).toFixed(2));
        }

        const taxesTotal = cgst + sgst + igst;
        const totalWithTax = subtotalCost + taxesTotal;
        const grandTotal = Math.round(totalWithTax);

        // Meter calculations
        const meterMins = log ? parseMeterDiff(log.startMeter, log.endMeter) : 0;
        const isMismatch = log ? Math.abs(meterMins - clockMins) > 1 : false;

        list.push({
          id: `${g.id}-${mKey}`,
          genset: g,
          monthKey: mKey,
          monthLabel,
          log: log || null,
          isEntered: !!log,
          clockHrsStr: formatMinutesToTime(clockMins),
          clockMins,
          meterMins,
          isMismatch,
          fuelPrice,
          subtotalCost,
          taxesTotal,
          grandTotal,
          isPaid: log ? !!log.isPaid : false,
          billNo: log?.billNo || '',
          billDate: log?.billDate || '',
          paymentDate: log?.paymentDate || '',
          paymentRef: log?.paymentRef || '',
        });
      });
    });

    return list;
  }, [db, activePeriodMonths]);

  // Aggregate logs metrics for selected Period
  const auditMetrics = useMemo(() => {
    const totalExpected = computedLogs.length;
    const totalBooked = computedLogs.filter(item => item.isEntered).length;
    const totalPending = totalExpected - totalBooked;
    const totalMismatchInput = computedLogs.filter(item => item.isMismatch).length;

    return {
      totalExpected,
      totalBooked,
      totalPending,
      totalMismatchInput
    };
  }, [computedLogs]);

  // Aggregate collection metrics for Point 4 & 5
  const paymentMetrics = useMemo(() => {
    const billedInvoices = computedLogs.filter(item => item.billNo !== '');
    const totalIssuedInvoiceCount = billedInvoices.length;
    
    const totalBilledAmount = billedInvoices.reduce((sum, item) => sum + item.grandTotal, 0);
    const totalBilledSubtotal = billedInvoices.reduce((sum, item) => sum + (item.subtotalCost || 0), 0);
    const totalBilledTaxes = billedInvoices.reduce((sum, item) => sum + (item.taxesTotal || 0), 0);

    const receivedInvoices = billedInvoices.filter(item => item.isPaid);
    const receivedAmount = receivedInvoices.reduce((sum, item) => sum + item.grandTotal, 0);
    const receivedSubtotal = receivedInvoices.reduce((sum, item) => sum + (item.subtotalCost || 0), 0);
    const receivedTaxes = receivedInvoices.reduce((sum, item) => sum + (item.taxesTotal || 0), 0);

    const pendingInvoices = billedInvoices.filter(item => !item.isPaid);
    const pendingAmount = pendingInvoices.reduce((sum, item) => sum + item.grandTotal, 0);
    const pendingSubtotal = pendingInvoices.reduce((sum, item) => sum + (item.subtotalCost || 0), 0);
    const pendingTaxes = pendingInvoices.reduce((sum, item) => sum + (item.taxesTotal || 0), 0);

    return {
      totalIssuedInvoiceCount,
      totalBilledAmount,
      totalBilledSubtotal,
      totalBilledTaxes,
      receivedCount: receivedInvoices.length,
      receivedAmount,
      receivedSubtotal,
      receivedTaxes,
      pendingCount: pendingInvoices.length,
      pendingAmount,
      pendingSubtotal,
      pendingTaxes
    };
  }, [computedLogs]);

  // Handle direct payment update
  const handleTogglePaymentStatus = (gensetId: string, monthKey: string, currentPaid: boolean) => {
    onUpdateDb(prev => {
      const idx = prev.siteLogs.findIndex(l => l.gensetId === gensetId && l.monthKey === monthKey);
      let newLogs = [...prev.siteLogs];
      if (idx >= 0) {
        newLogs[idx] = { 
          ...newLogs[idx], 
          isPaid: !currentPaid,
          paymentDate: !currentPaid ? new Date().toISOString().split('T')[0] : undefined
        };
      } else {
        newLogs.push({
          id: `log-${gensetId}-${monthKey}`,
          gensetId,
          monthKey,
          startMeter: '0.0',
          endMeter: '0.0',
          entries: [],
          isPaid: true,
          paymentDate: new Date().toISOString().split('T')[0]
        });
      }
      return { ...prev, siteLogs: newLogs };
    });
  };

  const handleUpdatePaymentDetails = (gensetId: string, monthKey: string, date: string, ref: string) => {
    onUpdateDb(prev => {
      const idx = prev.siteLogs.findIndex(l => l.gensetId === gensetId && l.monthKey === monthKey);
      let newLogs = [...prev.siteLogs];
      if (idx >= 0) {
        newLogs[idx] = { 
          ...newLogs[idx], 
          isPaid: true,
          paymentDate: date || new Date().toISOString().split('T')[0],
          paymentRef: ref 
        };
      } else {
        newLogs.push({
          id: `log-${gensetId}-${monthKey}`,
          gensetId,
          monthKey,
          startMeter: '0.0',
          endMeter: '0.0',
          entries: [],
          isPaid: true,
          paymentDate: date || new Date().toISOString().split('T')[0],
          paymentRef: ref
        });
      }
      return { ...prev, siteLogs: newLogs };
    });
    setEditingPaymentId(null);
  };

  // Filter logs list based on search and selected logs filter
  const filteredLogList = useMemo(() => {
    return computedLogs.filter(item => {
      const matchesSearch = item.genset.siteName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.monthLabel.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      if (logFilter === 'entered') return item.isEntered;
      if (logFilter === 'pending') return !item.isEntered;
      if (logFilter === 'mismatch') return item.isMismatch;
      return true;
    });
  }, [computedLogs, searchQuery, logFilter]);

  // Filter payments list based on search and selected payments filter
  const filteredPaymentsList = useMemo(() => {
    // Only show items that have a bill number issued
    return computedLogs.filter(item => {
      if (item.billNo === '') return false;

      const matchesSearch = item.genset.siteName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.billNo.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      if (paymentFilter === 'received') return item.isPaid;
      if (paymentFilter === 'pending') return !item.isPaid;
      return true;
    });
  }, [computedLogs, searchQuery, paymentFilter]);

  // Fast Month Label
  const formatMonthLabel = (mKey: string) => {
    const [year, month] = mKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-4" id="dashboard-tab">
      
      {/* Header and Period Configuration Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5.5 w-5.5 text-blue-600" />
            Operations Overview Dashboard
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Audit submission status, expected log entries, meter mismatch warnings, and billing collections.
          </p>
        </div>

        {/* Dynamic Period Control Panel */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs font-semibold">
          <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2.5">
            <CalendarRange className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-slate-600 tracking-wide font-bold uppercase text-[10px]">Period Selection:</span>
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPeriodType('single')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer font-bold uppercase text-[9px] ${
                periodType === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-650 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Single Month
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('range')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer font-bold uppercase text-[9px] ${
                periodType === 'range'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-650 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Custom Range
            </button>
          </div>

          {periodType === 'single' ? (
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-normal">Month:</span>
              <select
                id="month-period-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded border border-slate-200 bg-white text-slate-805 font-bold px-2 py-0.5"
              >
                {reverseChronologicalMonths.map(m => (
                  <option key={m} value={m}>{formatMonthLabel(m)}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-normal">From:</span>
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="rounded border border-slate-200 bg-white text-slate-805 font-bold px-1.5 py-0.5"
                >
                  {chronologicalMonths.map(m => (
                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-normal">To:</span>
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="rounded border border-slate-200 bg-white text-slate-805 font-bold px-1.5 py-0.5"
                >
                  {chronologicalMonths.map(m => (
                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard Sub-tab Selector */}
      <div className="flex border-b border-slate-200" id="dashboard-sub-navigation">
        <button
          onClick={() => {
            setDashboardSubTab('logs');
            setSearchQuery('');
          }}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            dashboardSubTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Generator Logs Auditor</span>
          <span className="ml-1 bg-blue-50 text-blue-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
            {auditMetrics.totalBooked} / {auditMetrics.totalExpected}
          </span>
        </button>
        <button
          onClick={() => {
            setDashboardSubTab('payments');
            setSearchQuery('');
          }}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            dashboardSubTab === 'payments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Invoices & Payment Collections</span>
          <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            paymentMetrics.pendingCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            Pending: {paymentMetrics.pendingCount}
          </span>
        </button>
      </div>

      {/* RENDER TAB 1: GENERATOR LOGS AUDITOR */}
      {dashboardSubTab === 'logs' && (
        <div className="space-y-4 animate-fadeIn" id="logs-auditor-workspace">
          
          {/* Key Metrics Bento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Metric Box 1 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Total Expected Logs</span>
                <span className="text-xl font-extrabold text-slate-850 block">{auditMetrics.totalExpected}</span>
                <span className="text-[10px] text-slate-500 font-medium block">Site-Months expected</span>
              </div>
            </div>

            {/* Metric Box 2 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Logs Booked / Submitted</span>
                <span className="text-xl font-extrabold text-slate-850 block">{auditMetrics.totalBooked}</span>
                <span className="text-[10px] text-emerald-600 font-semibold block">Entered successfully</span>
              </div>
            </div>

            {/* Metric Box 3 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Remaining to Enter</span>
                <span className="text-xl font-extrabold text-amber-600 block">{auditMetrics.totalPending}</span>
                <span className="text-[10px] text-amber-700 font-semibold block">Awaiting documentation</span>
              </div>
            </div>

            {/* Metric Box 4 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
              <div className={`p-2.5 ${auditMetrics.totalMismatchInput > 0 ? 'bg-rose-50 text-rose-650' : 'bg-slate-50 text-slate-550'} rounded-lg shrink-0`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Meter Mismatches</span>
                <span className={`text-xl font-extrabold block ${auditMetrics.totalMismatchInput > 0 ? 'text-rose-600' : 'text-slate-805'}`}>
                  {auditMetrics.totalMismatchInput}
                </span>
                <span className="text-[10px] text-slate-500 font-medium block">
                  {auditMetrics.totalMismatchInput > 0 ? 'Requires adjustments' : 'All tallies correct'}
                </span>
              </div>
            </div>

          </div>

          {/* List Table of Logs audit filter */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="h-4.5 w-4.5 text-blue-600" />
                Audit Logs list of booked and pending entries
              </h2>

              {/* Status filtering row */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLogFilter('all')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    logFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-250 text-slate-600'
                  }`}
                >
                  All Statuses ({computedLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('entered')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    logFilter === 'entered' ? 'bg-emerald-700 text-white' : 'bg-slate-100 hover:bg-emerald-50 text-emerald-700'
                  }`}
                >
                  Entered ({auditMetrics.totalBooked})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('pending')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    logFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-100 hover:bg-amber-50 text-amber-700'
                  }`}
                >
                  Pending ({auditMetrics.totalPending})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('mismatch')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    logFilter === 'mismatch' ? 'bg-rose-705 bg-rose-600 text-white' : 'bg-slate-100 hover:bg-rose-50 text-rose-600'
                  }`}
                >
                  Mismatch ({auditMetrics.totalMismatchInput})
                </button>
              </div>
            </div>

            {/* List Table filters search */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 max-w-md">
              <Search className="h-3.5 w-3.5 text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Search by location name or month..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-slate-755 border-none focus:outline-none w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-755 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Main Table for Auditor logs */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-[9px] text-slate-450 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Location / Site Name</th>
                    <th className="py-2.5 px-3">Billing Zone</th>
                    <th className="py-2.5 px-3 text-center">Period Month</th>
                    <th className="py-2.5 px-3 text-center">Log Status</th>
                    <th className="py-2.5 px-3 text-right">Run Hours (Clock)</th>
                    <th className="py-2.5 px-3 text-right">Meter difference</th>
                    <th className="py-2.5 px-3 text-center">Tally Status</th>
                    <th className="py-2.5 px-3 text-right">Fuel Rate</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-mono text-[11px]">
                  {filteredLogList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 italic font-sans">
                        No sites matching the active criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogList.map(item => {
                      const client = db.clients.find(c => c.id === item.genset.clientId);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-2.5 px-3 font-sans font-bold text-slate-800">{item.genset.siteName}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-550">{client?.zone || 'Unassigned'}</td>
                          <td className="py-2.5 px-3 font-sans text-center text-slate-600 font-bold">{item.monthLabel}</td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            {item.isEntered ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Booked 📄
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-55 bg-amber-50 text-amber-805 border border-amber-200">
                                Pending ⏳
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">{item.isEntered ? `${item.clockHrsStr} Hrs` : '0:00 Hrs'}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">{item.isEntered ? `${formatMinutesToTime(item.meterMins)} Hrs` : '-'}</td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            {!item.isEntered ? (
                              <span className="text-[10px] text-slate-350 italic">-</span>
                            ) : item.isMismatch ? (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded leading-none">
                                <AlertTriangle className="h-3 w-3 inline shrink-0" /> Mismatch
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded leading-none">
                                Match ✓
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                            {item.fuelPrice > 0 ? `₹${item.fuelPrice.toFixed(2)}` : <span className="text-red-500 italic block">₹0.00</span>}
                          </td>
                          <td className="py-2 px-3 text-center font-sans">
                            <button
                              onClick={() => {
                                // Jump to log book for this specific month and genset site!
                                setSelectedMonth(item.monthKey);
                                onNavigate('logs');
                              }}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-105 border border-blue-200 hover:border-blue-300 font-bold transition duration-150 cursor-pointer"
                              title="Go straight to entry logs for this month"
                            >
                              <span>Enter Logs</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      )}

      {/* RENDER TAB 2: INVOICES & PAYMENT COLLECTIONS */}
      {dashboardSubTab === 'payments' && (
        <div className="space-y-4 animate-fadeIn" id="payments-collections-workspace">
          
          {/* Collection stats Bento boxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Payment Box 1 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-0.5">
                <FileCheck className="h-5 w-5" />
              </div>
              <div className="w-full">
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Total Billed Amt ({paymentMetrics.totalIssuedInvoiceCount} Bills)</span>
                <span className="text-xl font-extrabold text-slate-850 block">{formatCurrency(paymentMetrics.totalBilledAmount)}</span>
                <div className="mt-1 border-t border-slate-100 pt-1 text-[10px] text-slate-500 font-medium space-y-0.5">
                  <div className="flex justify-between">
                    <span>Base Bill:</span>
                    <span className="font-mono text-slate-700 font-bold">{formatCurrency(paymentMetrics.totalBilledSubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST amount:</span>
                    <span className="font-mono text-slate-700 font-bold">{formatCurrency(paymentMetrics.totalBilledTaxes)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Box 2 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 mt-0.5">
                <DollarSign className="h-5 w-5" />
              </div>
              <div className="w-full">
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Payments Received ({paymentMetrics.receivedCount} bills)</span>
                <span className="text-xl font-extrabold text-emerald-600 block">{formatCurrency(paymentMetrics.receivedAmount)}</span>
                <div className="mt-1 border-t border-slate-100 pt-1 text-[10px] text-emerald-600 font-medium space-y-0.5">
                  <div className="flex justify-between">
                    <span>Base Bill:</span>
                    <span className="font-mono text-emerald-850 font-bold">{formatCurrency(paymentMetrics.receivedSubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST amount:</span>
                    <span className="font-mono text-emerald-850 font-bold">{formatCurrency(paymentMetrics.receivedTaxes)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Box 3 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3.5">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg shrink-0 mt-0.5">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="w-full">
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Outstanding / Pending ({paymentMetrics.pendingCount} bills)</span>
                <span className="text-xl font-extrabold text-rose-600 block">{formatCurrency(paymentMetrics.pendingAmount)}</span>
                <div className="mt-1 border-t border-slate-100 pt-1 text-[10px] text-rose-700 font-medium space-y-0.5">
                  <div className="flex justify-between">
                    <span>Base Bill:</span>
                    <span className="font-mono text-rose-850 font-bold">{formatCurrency(paymentMetrics.pendingSubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST amount:</span>
                    <span className="font-mono text-rose-850 font-bold">{formatCurrency(paymentMetrics.pendingTaxes)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Table List of Bill payments received and not received */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-b-slate-100">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="h-4.5 w-4.5 text-blue-600 font-bold" />
                Voucher ledger of bills received and not received (Record Receipt)
              </h2>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentFilter('all')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    paymentFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  All Invoices
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentFilter('received')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    paymentFilter === 'received' ? 'bg-emerald-700 text-white' : 'bg-slate-100 hover:bg-emerald-50 text-emerald-700'
                  }`}
                >
                  Received / Paid ({paymentMetrics.receivedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentFilter('pending')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    paymentFilter === 'pending' ? 'bg-rose-600 text-white' : 'bg-slate-100 hover:bg-rose-50 text-rose-705'
                  }`}
                >
                  Pending unpaid ({paymentMetrics.pendingCount})
                </button>
              </div>
            </div>

            {/* Ledger Filters row search */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 max-w-md">
              <Search className="h-3.5 w-3.5 text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Search by Site Name, Invoice No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-slate-755 border-none focus:outline-none w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-755 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Invoices table payment recorder */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-[9px] text-slate-450 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Place / Site Location</th>
                    <th className="py-2.5 px-3">Period Month</th>
                    <th className="py-2.5 px-3">Invoice No</th>
                    <th className="py-2.5 px-3">Invoice Date</th>
                    <th className="py-2.5 px-3 text-right">Bill Total Cost (₹)</th>
                    <th className="py-2.5 px-3 text-center">Collection Status</th>
                    <th className="py-2.5 px-3">Payment Receipt Details</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-mono text-[11px]">
                  {filteredPaymentsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-405 italic font-sans">
                        No issued invoices match the active criteria. Start issuing invoices in the Calculation billing worksheet.
                      </td>
                    </tr>
                  ) : (
                    filteredPaymentsList.map(item => {
                      const isEditingPriceDetails = editingPaymentId === item.id;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-3 font-sans font-bold text-slate-800">{item.genset.siteName}</td>
                          <td className="py-3 px-3 font-sans text-slate-550 font-extrabold">{item.monthLabel}</td>
                          <td className="py-3 px-3 font-sans font-bold text-slate-900 bg-slate-50/50">{item.billNo}</td>
                          <td className="py-3 px-3 text-slate-500">{item.billDate ? new Date(item.billDate).toLocaleDateString('en-GB') : '-'}</td>
                          <td className="py-3 px-3 text-right font-extrabold text-blue-900">₹{item.grandTotal.toLocaleString('en-IN')}</td>
                          
                          {/* Collection inline status toggle badge */}
                          <td className="py-3 px-3 text-center font-sans">
                            <button
                              type="button"
                              onClick={() => handleTogglePaymentStatus(item.genset.id, item.monthKey, item.isPaid)}
                              className={`px-2.5 py-1 text-[9px] font-black rounded cursor-pointer transition border uppercase inline-flex items-center gap-1 ${
                                item.isPaid
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-250'
                                  : 'bg-rose-50 text-rose-700 border-rose-150 hover:bg-rose-100/90'
                              }`}
                            >
                              <span>{item.isPaid ? '💰 PAID ✓' : '⏳ PENDING'}</span>
                            </button>
                          </td>

                          {/* Dynamic transaction recording values */}
                          <td className="py-2.5 px-3 font-sans">
                            {isEditingPriceDetails ? (
                              <div className="flex flex-col gap-1.5 p-1 bg-slate-50 rounded border border-slate-200 min-w-[190px]">
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] text-slate-400 uppercase font-bold">Voucher Dt:</span>
                                  <input
                                    type="date"
                                    value={editPayDate}
                                    onChange={(e) => setEditPayDate(e.target.value)}
                                    className="text-[10px] rounded border border-slate-200 p-0.5 bg-white font-mono focus:outline-none w-full"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] text-slate-400 uppercase font-bold">Ref No:</span>
                                  <input
                                    type="text"
                                    placeholder="UTR / Chq No / Draft"
                                    value={editPayRef}
                                    onChange={(e) => setEditPayRef(e.target.value)}
                                    className="text-[10px] rounded border border-slate-200 p-0.5 bg-white font-mono focus:outline-none w-full"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] leading-relaxed">
                                {item.isPaid ? (
                                  <>
                                    <div className="text-slate-650 font-medium">Date Recd: <span className="font-mono text-slate-900 font-bold">{item.paymentDate || 'Today'}</span></div>
                                    <div className="text-slate-400">Ref: <span className="font-mono text-emerald-800 font-bold">{item.paymentRef || 'Voucher Cash / Transfer'}</span></div>
                                  </>
                                ) : (
                                  <span className="text-slate-400 italic font-medium">No payment recorded yet</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Transaction action controllers */}
                          <td className="py-2.5 px-3 text-center font-sans">
                            {isEditingPriceDetails ? (
                              <div className="flex flex-col gap-1 font-sans">
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePaymentDetails(item.genset.id, item.monthKey, editPayDate, editPayRef)}
                                  className="px-1.5 py-0.5 text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer transition uppercase"
                                >
                                  Save Vchr
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPaymentId(null)}
                                  className="px-1.5 py-0.5 text-[9px] bg-slate-100 hover:bg-slate-205 text-slate-600 font-bold rounded border border-slate-200 cursor-pointer transition uppercase"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPaymentId(item.id);
                                  setEditPayDate(item.paymentDate || new Date().toISOString().split('T')[0]);
                                  setEditPayRef(item.paymentRef || '');
                                }}
                                className="px-2 py-1 text-[9.5px] font-bold text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 rounded cursor-pointer transition flex items-center justify-center mx-auto gap-0.5"
                                title="Edit or record payment slip details"
                              >
                                <CreditCard className="h-3 w-3 inline shrink-0" /> Edit Slip
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* QUICK WORKSPACE WORKFLOW NAVIGATORS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
          <Building2 className="h-4.5 w-4.5 text-slate-600" />
          Active Operations Quick Launcher
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          <button
            id="goto-log-book-btn"
            onClick={() => onNavigate('logs')}
            className="group p-3 bg-gradient-to-br from-slate-50 to-slate-100/30 hover:to-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="p-1 bg-blue-100 text-blue-700 rounded-lg group-hover:scale-105 transition-transform">
                <History className="h-3.5 w-3.5" />
              </span>
              <span className="text-[8px] font-bold px-1 py-0.5 bg-blue-100/60 text-blue-800 rounded uppercase">Entry Logs</span>
            </div>
            <h3 className="font-bold text-xs text-slate-800">Diesel Run Logs</h3>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed truncate">
              Enter clock timings & generator meter readings.
            </p>
          </button>

          <button
            id="goto-billing-sheet-btn"
            onClick={() => onNavigate('billing')}
            className="group p-3 bg-gradient-to-br from-slate-50 to-slate-100/30 hover:to-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-left transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="p-1 bg-emerald-100 text-emerald-700 rounded-lg group-hover:scale-105 transition-transform">
                <Calculator className="h-3.5 w-3.5" />
              </span>
              <span className="text-[8px] font-bold px-1 py-0.5 bg-emerald-100/60 text-emerald-800 rounded uppercase">Reconciliation</span>
            </div>
            <h3 className="font-bold text-xs text-slate-800">Calculation Sheet</h3>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed truncate">
              Map subzone fuel prices and draft Tax Invoices.
            </p>
          </button>

          <button
            id="goto-receipts-register-btn"
            onClick={() => onNavigate('payments')}
            className="group p-3 bg-gradient-to-br from-slate-50 to-slate-100/30 hover:to-teal-50 border border-slate-200 hover:border-teal-300 rounded-lg text-left transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="p-1 bg-teal-100 text-teal-700 rounded-lg group-hover:scale-105 transition-transform">
                <CreditCard className="h-3.5 w-3.5" />
              </span>
              <span className="text-[8px] font-bold px-1 py-0.5 bg-teal-105 bg-teal-100 text-teal-800 rounded uppercase">Ledger</span>
            </div>
            <h3 className="font-bold text-xs text-slate-800">Money Receipts</h3>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed truncate">
              Record bank voucher receipts & print formal slips.
            </p>
          </button>

          <button
            id="goto-master-config-btn"
            onClick={() => onNavigate('config')}
            className="group p-3 bg-gradient-to-br from-slate-50 to-slate-100/30 hover:to-purple-50 border border-slate-200 hover:border-purple-300 rounded-lg text-left transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="p-1 bg-purple-100 text-purple-700 rounded-lg group-hover:scale-105 transition-transform">
                <Settings className="h-3.5 w-3.5" />
              </span>
              <span className="text-[8px] font-bold px-1 py-0.5 bg-purple-100/60 text-purple-800 rounded uppercase">Masters</span>
            </div>
            <h3 className="font-bold text-xs text-slate-800">Master Configs</h3>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed truncate">
              Add Clients, Site locations, capacities and company profile.
            </p>
          </button>

          <button
            id="goto-backup-hub-btn"
            onClick={() => onNavigate('backup')}
            className="group p-3 bg-gradient-to-br from-slate-50 to-slate-100/30 hover:to-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg text-left transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="p-1 bg-amber-100 text-amber-700 rounded-lg group-hover:scale-105 transition-transform">
                <FileText className="h-3.5 w-3.5" />
              </span>
              <span className="text-[8px] font-bold px-1 py-0.5 bg-amber-100/60 text-amber-800 rounded uppercase">JSON Transfer</span>
            </div>
            <h3 className="font-bold text-xs text-slate-800">Pen Drive Backups</h3>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed truncate">
              Export and restore database files for standalone portability.
            </p>
          </button>

        </div>
      </div>

    </div>
  );
}
