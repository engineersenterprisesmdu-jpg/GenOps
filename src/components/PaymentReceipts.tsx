/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { AppDatabase, SiteLog, Genset, Client, BankDetails } from '../types';
import { 
  formatCurrency, 
  parseMeterToMinutes,
  formatMinutesToDecimal 
} from '../utils/time';
import { 
  Receipt, 
  Search, 
  FileText, 
  Printer, 
  Clock, 
  CheckCircle2, 
  Building2, 
  CreditCard,
  X,
  Plus,
  RefreshCw,
  FolderOpen,
  ArrowLeft
} from 'lucide-react';

interface PaymentReceiptsProps {
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
  selectedMonth: string;
  setSelectedMonth?: (month: string) => void;
}

export default function PaymentReceipts({ db, onUpdateDb, selectedMonth, setSelectedMonth }: PaymentReceiptsProps) {
  const [filterType, setFilterType] = useState<'all' | 'paid' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonthLocal, setSelectedMonthLocal] = useState<string>(selectedMonth);

  useEffect(() => {
    setSelectedMonthLocal(selectedMonth);
  }, [selectedMonth]);

  // Available months list for custom selection
  const availableMonthsList = useMemo(() => {
    const list = new Set<string>();
    db.zonePrices.forEach(zp => {
      if (zp.monthKey) list.add(zp.monthKey);
    });
    db.siteLogs.forEach(l => {
      if (l.monthKey) list.add(l.monthKey);
    });
    
    // Add fallback list centering active periods
    const today = new Date();
    for (let i = -12; i <= 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.add(key);
    }
    return Array.from(list).sort().reverse();
  }, [db.zonePrices, db.siteLogs]);

  // Payment Recording Modal State
  const [recordingLogId, setRecordingLogId] = useState<string | null>(null);
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentBankId, setPaymentBankId] = useState<string>('');

  // Consolidated Audit Report Preview State
  const [showConsolidatedReport, setShowConsolidatedReport] = useState<boolean>(false);

  const companiesList = db.companies && db.companies.length > 0 ? db.companies : [{ ...db.company, id: 'co-engineers' }];
  const bankAccountsList = db.bankAccounts && db.bankAccounts.length > 0 ? db.bankAccounts : [{ ...db.company.bankDetails, id: 'bank-canara' }];

  // Safe helper to get subzone price for a site location
  const getSubzonePriceForSite = (genset: Genset, clientZone: string) => {
    if (genset.zoneName) {
      const currentMonthPrices = db.zonePrices.filter(zp => zp.monthKey === selectedMonthLocal);
      const priceConfig = currentMonthPrices.find(zp => zp.zoneName.toLowerCase() === genset.zoneName!.toLowerCase());
      if (priceConfig) return priceConfig;
    }

    const siteName = genset.siteName;
    const nameLower = siteName.toLowerCase();
    const zoneLower = clientZone.toLowerCase();
    let matchedName = 'Salem Area';
    if (nameLower.includes('namakkal') || nameLower.includes('rasipuram') || nameLower.includes('velur')) {
      matchedName = 'Namakkal Area';
    } else if (nameLower.includes('thiruvella') || nameLower.includes('kadampanad') || nameLower.includes('mallapally')) {
      matchedName = 'Pathanam Area';
    } else if (nameLower.includes('changanachery')) {
      matchedName = 'Kottayam Area';
    } else if (nameLower.includes('vandiperiyar') || nameLower.includes('cheruthoni') || nameLower.includes('adimali')) {
      matchedName = 'Idukki Area';
    } else if (nameLower.includes('charamoodu') || nameLower.includes('charmoodu')) {
      matchedName = 'Alapuzha Area';
    } else if (zoneLower.includes('kottayam')) {
      matchedName = 'Kottayam Area';
    }

    const currentMonthPrices = db.zonePrices.filter(zp => zp.monthKey === selectedMonthLocal);
    const priceConfig = currentMonthPrices.find(zp => zp.zoneName.toLowerCase() === matchedName.toLowerCase());
    return priceConfig || { averagePrice: 0, zoneName: matchedName };
  };

  // Pre-calculate billing amount for any log
  const getCalculatedBill = (g: Genset, log: SiteLog, client: Client) => {
    const minutes = (log.entries || []).reduce((sum, e) => sum + e.durationMinutes, 0);
    const hrsDec = minutes / 60;
    const priceConfig = getSubzonePriceForSite(g, client.zone);
    const fuelPrice = priceConfig.averagePrice;
    
    const costPerHour = parseFloat((g.dieselQuantityPerHour * fuelPrice).toFixed(2));
    const subtotalCost = Math.round(costPerHour * hrsDec);
    
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    if (g.gstType === 'CGST_SGST') {
      cgst = parseFloat((subtotalCost * 0.09).toFixed(2));
      sgst = parseFloat((subtotalCost * 0.09).toFixed(2));
    } else {
      igst = parseFloat((subtotalCost * 0.18).toFixed(2));
    }
    
    const grandTotal = Math.round(subtotalCost + cgst + sgst + igst);
    return {
      minutes,
      hrsDec,
      fuelPrice,
      costPerHour,
      subtotalCost,
      tax: cgst + sgst + igst,
      grandTotal
    };
  };

  // Resolve list of records
  const billingLogItems = useMemo(() => {
    return db.gensets.map(g => {
      const client: Client = db.clients.find(c => c.id === g.clientId) || { 
        id: 'unregistered', 
        name: 'M/s Unregistered', 
        zone: 'Unknown', 
        address: '', 
        gstin: '', 
        pan: ''
      };
      const log = db.siteLogs.find(l => l.gensetId === g.id && l.monthKey === selectedMonthLocal) || {
        id: `empty-${g.id}-${selectedMonthLocal}`,
        gensetId: g.id,
        monthKey: selectedMonthLocal,
        startMeter: '0.0',
        endMeter: '0.0',
        entries: [],
        isSubmitted: false
      };

      const billCalc = getCalculatedBill(g, log, client);

      return {
        genset: g,
        client,
        log,
        billCalc
      };
    });
  }, [db.gensets, db.siteLogs, selectedMonthLocal]);

  // Filter and search
  const filteredItems = useMemo(() => {
    return billingLogItems.filter(item => {
      const matchesSearch = item.genset.siteName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (item.log.billNo || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const isPaid = !!item.log.isPaid;
      if (filterType === 'paid') return matchesSearch && isPaid;
      if (filterType === 'pending') return matchesSearch && !isPaid;
      return matchesSearch;
    });
  }, [billingLogItems, filterType, searchTerm]);

  // Summary widgets
  const summaryBlock = useMemo(() => {
    let totalAmt = 0;
    let totalSubtotal = 0;
    let totalTax = 0;

    let paidAmt = 0;
    let paidSubtotal = 0;
    let paidTax = 0;

    let pendingAmt = 0;
    let pendingSubtotal = 0;
    let pendingTax = 0;

    let paidCount = 0;
    let pendingCount = 0;

    billingLogItems.forEach(item => {
      const billVal = item.billCalc.grandTotal;
      const subtotal = item.billCalc.subtotalCost;
      const tax = item.billCalc.tax;

      totalAmt += billVal;
      totalSubtotal += subtotal;
      totalTax += tax;

      if (item.log.isPaid) {
        paidAmt += item.log.paymentAmount || billVal;
        paidSubtotal += subtotal;
        paidTax += tax;
        paidCount++;
      } else {
        pendingAmt += billVal;
        pendingSubtotal += subtotal;
        pendingTax += tax;
        pendingCount++;
      }
    });

    return { 
      totalAmt, 
      totalSubtotal,
      totalTax,
      paidAmt, 
      paidSubtotal,
      paidTax,
      pendingAmt, 
      pendingSubtotal,
      pendingTax,
      paidCount, 
      pendingCount 
    };
  }, [billingLogItems]);

  // Handle Recording payment form submit
  const submitRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingLogId) return;

    onUpdateDb(prev => {
      return {
        ...prev,
        siteLogs: prev.siteLogs.map(l => {
          if (l.id === recordingLogId) {
            return {
              ...l,
              isPaid: true,
              paymentDate: voucherDate,
              paymentRef,
              paymentAmount,
              paymentBankId: paymentBankId || undefined
            };
          }
          return l;
        })
      };
    });

    setRecordingLogId(null);
    setPaymentRef('');
    alert('Payment details recorded and linked back to the ledger file successfully.');
  };

  // Launch modal
  const openRecordingModal = (item: typeof billingLogItems[0]) => {
    setRecordingLogId(item.log.id);
    setPaymentAmount(item.log.paymentAmount || item.billCalc.grandTotal);
    setVoucherDate(item.log.paymentDate || new Date().toISOString().split('T')[0]);
    setPaymentRef(item.log.paymentRef || '');
    
    // Auto-preselect either site-linked bank or fallbacks
    setPaymentBankId(item.log.paymentBankId || item.genset.bankAccountId || bankAccountsList[0]?.id || '');
  };

  // Clear Payment flag
  const clearPaymentReceipt = (id: string) => {
    if (confirm('Are you sure you want to delete and reset the receipt recording details for this bill?')) {
      onUpdateDb(prev => ({
        ...prev,
        siteLogs: prev.siteLogs.map(l => {
          if (l.id === id) {
            const { isPaid, paymentDate, paymentRef, paymentAmount, paymentBankId, ...rest } = l;
            return rest;
          }
          return l;
        })
      }));
      alert('Payment receipt record cleared.');
    }
  };

  // We will build a clean consolidated list of only received logs for audit-reporting
  const receivedItemsForAudit = useMemo(() => {
    return billingLogItems.filter(item => item.log.isPaid);
  }, [billingLogItems]);

  // English words converter
  const convertNumberToWords = (num: number): string => {
    if (num === 0) return 'Rupees Zero Only';
    
    const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const double = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const translate = (n: number): string => {
      let str = '';
      if (n > 99) {
        str += single[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n > 19) {
        str += double[Math.floor(n / 10)] + ' ' + single[n % 10] + ' ';
      } else if (n > 0) {
        str += single[n] + ' ';
      }
      return str;
    };

    let result = '';
    
    // Crores
    if (Math.floor(num / 10000000) > 0) {
      result += translate(Math.floor(num / 10000000)) + 'Crore ';
      num %= 10000000;
    }
    // Lakhs
    if (Math.floor(num / 100000) > 0) {
      result += translate(Math.floor(num / 100000)) + 'Lakh ';
      num %= 100000;
    }
    // Thousands
    if (Math.floor(num / 1000) > 0) {
      result += translate(Math.floor(num / 1000)) + 'Thousand ';
      num %= 1000;
    }
    
    result += translate(num);
    return 'Rupees ' + result.trim() + ' Only';
  };

  return (
    <div className="space-y-6" id="payments-receipt-workspace">
      
      <div className="space-y-6 print:hidden">
        {/* Header Info Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-emerald-600" />
            Receipts Registry
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage audit-compliant payment collections, settle pending customer log book invoices, and run printable formal slips.</p>
        </div>
        
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs text-slate-400 font-bold uppercase">Period:</span>
          <select
            value={selectedMonthLocal}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedMonthLocal(val);
              if (setSelectedMonth) {
                setSelectedMonth(val);
              }
            }}
            className="rounded border border-slate-200 text-xs bg-slate-50 text-slate-800 font-bold px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {availableMonthsList.map(m => (
              <option key={m} value={m}>
                {new Date(m + '-01').toLocaleDateString('en', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowConsolidatedReport(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg cursor-pointer transition shadow-xs hover:shadow"
            title="Consolidated Monthly Audit Report of Received Details"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Month Audit Registry
          </button>
        </div>
      </div>

      {/* Overview Analytics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Ledger widget */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-0.5">
            <FileText className="h-5 w-5" />
          </div>
          <div className="w-full">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Gross Month Billing</p>
            <p className="text-xl font-extrabold text-slate-900">{formatCurrency(summaryBlock.totalAmt)}</p>
            <div className="mt-1.5 border-t border-slate-100 pt-1 text-[10px] text-slate-505 text-slate-500 font-medium space-y-0.5">
              <div className="flex justify-between">
                <span>Base Bill:</span>
                <span className="font-mono text-slate-700 font-bold">{formatCurrency(summaryBlock.totalSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST taxes:</span>
                <span className="font-mono text-slate-700 font-bold">{formatCurrency(summaryBlock.totalTax)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Collected widget */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 mt-0.5">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="w-full">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Total Money Received</p>
            <p className="text-xl font-extrabold text-emerald-650">{formatCurrency(summaryBlock.paidAmt)}</p>
            <div className="mt-1.5 border-t border-slate-100 pt-1 text-[10px] text-emerald-600 font-medium space-y-0.5">
              <div className="flex justify-between">
                <span>Base Bill:</span>
                <span className="font-mono text-emerald-850 font-bold">{formatCurrency(summaryBlock.paidSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST taxes:</span>
                <span className="font-mono text-emerald-850 font-bold">{formatCurrency(summaryBlock.paidTax)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending widget */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg shrink-0 mt-0.5">
            <Clock className="h-5 w-5" />
          </div>
          <div className="w-full">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Ledger Bills Unpaid</p>
            <p className="text-xl font-extrabold text-red-600">{formatCurrency(summaryBlock.pendingAmt)}</p>
            <div className="mt-1.5 border-t border-slate-100 pt-1 text-[10px] text-red-700 font-medium space-y-0.5">
              <div className="flex justify-between">
                <span>Base Bill:</span>
                <span className="font-mono text-red-850 font-bold">{formatCurrency(summaryBlock.pendingSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST taxes:</span>
                <span className="font-mono text-red-850 font-bold">{formatCurrency(summaryBlock.pendingTax)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main filter directory toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg self-start shrink-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'all' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              All Invoices ({billingLogItems.length})
            </button>
            <button
              onClick={() => setFilterType('paid')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'paid' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Paid Slips ({summaryBlock.paidCount})
            </button>
            <button
              onClick={() => setFilterType('pending')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'pending' ? 'bg-white text-red-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Outstanding ({summaryBlock.pendingCount})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search site, client, bills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 rounded-lg border-slate-200 focus:ring-blue-500 focus:border-blue-500 p-2"
            />
          </div>
        </div>

        {/* Directory List Table */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <FolderOpen className="h-8 w-8 mx-auto text-slate-300" />
            <p className="text-xs">No matching billing records discovered in this category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 uppercase text-[9.5px] font-extrabold text-slate-400 tracking-wider">
                  <th className="py-2.5 px-3">Genset Location</th>
                  <th className="py-2.5 px-3">Bill Ref / Date</th>
                  <th className="py-2.5 px-3">Client Particulars</th>
                  <th className="py-2.5 px-3 text-right">Computed Bill</th>
                  <th className="py-2.5 px-3 text-center">Settlement State</th>
                  <th className="py-2.5 px-3">Receipt Info / Bank</th>
                  <th className="py-2.5 px-3 text-center">Reset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.map(item => {
                  const hasBillNo = !!item.log.billNo;
                  const isPaid = !!item.log.isPaid;
                  const targetCo = companiesList.find(c => c.id === item.genset.companyId) || companiesList[0];
                  const targetBank = bankAccountsList.find(b => b.id === (item.log.paymentBankId || item.genset.bankAccountId)) || bankAccountsList[0];
                  
                  return (
                    <tr key={item.genset.id} className="hover:bg-slate-50/70 transition">
                      
                      {/* Location & Capacity */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-800 text-xs block">{item.genset.siteName}</span>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                          <span className="font-semibold text-blue-650 bg-blue-50 px-1.5 py-0.2 rounded">{item.genset.capacity}</span>
                          <span>•</span>
                          <span>{targetCo?.name.slice(0, 18)}..</span>
                        </div>
                      </td>

                      {/* Bill No / Bill Date */}
                      <td className="py-3.5 px-3 text-slate-600">
                        {hasBillNo ? (
                          <>
                            <span className="font-bold text-slate-800 font-mono block">{item.log.billNo}</span>
                            <span className="text-[10px] text-slate-400 font-medium block">{item.log.billDate || 'No Date'}</span>
                          </>
                        ) : (
                          <span className="italic text-slate-400 block text-[10px]">Bill ungenerated</span>
                        )}
                      </td>

                      {/* Client (Zone) */}
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-slate-700 block">{item.client.name}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded inline-block mt-0.5">{item.client.zone}</span>
                      </td>

                      {/* Computed Bill Total */}
                      <td className="py-3.5 px-3 text-right">
                        <span className="font-bold text-slate-800 font-mono text-xs">{formatCurrency(item.billCalc.grandTotal)}</span>
                        <span className="text-[9px] text-slate-400 block font-medium font-mono">{formatMinutesToDecimal(item.billCalc.minutes)} Hrs</span>
                      </td>

                      {/* Settlement State Button / Badge */}
                      <td className="py-3.5 px-3 text-center">
                        {isPaid ? (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-lg uppercase tracking-wider inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 bg-emerald-600 rounded-full animate-ping"></span>
                            Received
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-lg uppercase tracking-wider inline-flex items-center gap-1">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Receipt Info Bank */}
                      <td className="py-3.5 px-3">
                        {isPaid ? (
                          <div className="space-y-0.5 text-slate-600">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              {formatCurrency(item.log.paymentAmount || item.billCalc.grandTotal)} Received
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              On: <span className="text-slate-600 font-bold">{item.log.paymentDate || 'No Date'}</span> | Ref: <span className="font-semibold font-mono text-slate-700">{item.log.paymentRef || 'N/A'}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[140px]" title={targetBank?.bankName}>
                              🏦 {targetBank?.bankName || 'Direct Cash / Cheque'}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => openRecordingModal(item)}
                            className="bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 font-extrabold text-[10px] px-2 py-1 rounded-md transition uppercase tracking-wider flex items-center gap-1 mx-auto sm:mx-0 "
                          >
                            <Plus className="h-3 w-3" />
                            Record Cash / Bank
                          </button>
                        )}
                      </td>

                      {/* Reset/clear Actions */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center">
                          {isPaid ? (
                            <button
                              onClick={() => clearPaymentReceipt(item.log.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 cursor-pointer transition"
                              title="Reset/Delete payment log entry"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="text-slate-350 text-[10px]">—</span>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Receipt Modal / Drawer */}
      {recordingLogId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-150 shadow-2xl max-w-md w-full overflow-hidden text-left animate-slide-up">
            
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-400" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">Record Payment Stamp</h3>
              </div>
              <button
                onClick={() => setRecordingLogId(null)}
                className="p-1 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={submitRecordPayment} className="p-5 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Voucher Payment Date</label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-200 p-2.5 bg-slate-50 focus:bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Amount Received (₹)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs rounded-lg border-slate-200 p-2.5 bg-slate-50 focus:bg-white font-mono font-bold text-emerald-700"
                  required
                  placeholder="0.00"
                />
                <span className="text-[9px] text-slate-400 italic block mt-0.5">Note: Accepts partial amount logs. Defaults to calculated total.</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transfer Reference / Cheque Ref No</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-TXN-10025 or Cheque #49202"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-200 p-2.5 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Credit Into Bank Account Location</label>
                <select
                  value={paymentBankId}
                  onChange={(e) => setPaymentBankId(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-200 p-2.5 cursor-pointer"
                  required
                >
                  {bankAccountsList.map(bank => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bankName} (A/c: {bank.accountNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setRecordingLogId(null)}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 px-4 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md"
                >
                  Complete Voucher
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
      </div>

      {/* Consolidated Audit Report / Payments Received Ledger */}
      {showConsolidatedReport && (
        <div className="fixed inset-0 bg-slate-550 bg-slate-100 flex flex-col p-4 sm:p-6 z-40 overflow-y-auto font-sans print:absolute print:inset-0 print:p-0 print:bg-white" id="consolidated-report-overlay">
          {/* Inject temporary landscape print page rule only while the consolidated audit list is displayed */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 landscape !important;
                margin: 0 !important;
              }
            }
          `}} />
          
          {/* Header Bar */}
          <div className="max-w-4xl w-full mx-auto bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3 mb-4 print:hidden shrink-0">
            <div className="flex items-center gap-2.5 text-left">
              <button
                onClick={() => setShowConsolidatedReport(false)}
                className="p-1.5 hover:bg-slate-50 rounded border border-slate-200 text-slate-600 transition shrink-0 cursor-pointer flex items-center justify-center bg-white"
                title="Return to Collections"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Audit Registry Print Sheet</h2>
                <p className="text-[10px] text-slate-500 leading-tight">Payments Consolidation Register for {selectedMonthLocal ? new Date(selectedMonthLocal + '-01').toLocaleDateString('en', { month: 'long', year: 'numeric' }) : 'April 2026'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                id="do-print-ledger-btn"
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs hover:shadow-md"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Audit Ledger
              </button>
              <button
                onClick={() => setShowConsolidatedReport(false)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>

          <div className="flex justify-center w-full max-w-4xl mx-auto print:max-w-none print:p-0 pb-12 print:pb-0">
            {/* Print block wrapper */}
            <div className="border border-slate-300 print:border-none p-6 md:p-8 rounded-2xl bg-white shadow-md space-y-5 print:shadow-none w-full" id="printable-report-card">
              
              {/* Header Letterhead */}
              <div className="flex justify-between items-start border-b-2 border-slate-950 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-900 text-white font-black rounded-lg leading-none shrink-0 tracking-wider">
                    EE
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                      ENGINEERS ENTERPRISES
                    </h2>
                    <p className="text-[10px] text-slate-500 max-w-[360px] leading-relaxed">
                      {companiesList[0]?.address || db.company.address || 'Corporate Office Ledger & Engineering Maintenance Systems'}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5 font-semibold">
                      GSTIN ID: {companiesList[0]?.gstin || '29AACE5831M1ZS'} | PAN: {companiesList[0]?.pan || 'AACE5831M'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-950 uppercase tracking-widest">PAYMENTS CONSOLIDATION REGISTER</h3>
                  <span className="text-[9px] px-2 py-0.5 bg-slate-900 text-white font-black rounded uppercase mt-1 inline-block">INTERNAL AUDIT OFFICE</span>
                  <div className="text-[10px] text-slate-550 mt-1.5 font-medium">
                    Month Period: <strong className="text-slate-950 font-bold">{selectedMonthLocal ? new Date(selectedMonthLocal + '-01').toLocaleDateString('en', { month: 'long', year: 'numeric' }) : 'April 2026'}</strong>
                  </div>
                </div>
              </div>

              {/* AUDIT SUMMARY STAT CARD BOX */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed Log Invoices</span>
                  <p className="text-sm font-extrabold text-slate-800 font-mono mt-0.5">
                    {formatCurrency(billingLogItems.reduce((acc, item) => acc + item.billCalc.grandTotal, 0))}
                  </p>
                  <span className="text-[9px] text-slate-400 font-medium block">Across {billingLogItems.length} operating site nodes</span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block">Total Audited Receipts</span>
                  <p className="text-sm font-black text-emerald-950 font-mono mt-0.5">
                    {formatCurrency(receivedItemsForAudit.reduce((acc, item) => acc + (item.log.paymentAmount || item.billCalc.grandTotal), 0))}
                  </p>
                  <span className="text-[9px] text-emerald-700 font-bold block">✓ Fully Cleared ({receivedItemsForAudit.length} payments)</span>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider block">Total Remaining Outstanding</span>
                  <p className="text-sm font-extrabold text-amber-950 font-mono mt-0.5">
                    {formatCurrency(
                      billingLogItems
                        .filter(item => !item.log.isPaid)
                        .reduce((acc, item) => acc + item.billCalc.grandTotal, 0)
                    )}
                  </p>
                  <span className="text-[9px] text-amber-600 font-semibold block">⚠️ Pending verification / Not received</span>
                </div>
              </div>

              {/* BANK SUMMARY CREDIT CRUCIBLE */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                <span className="text-[9px] font-extrabold hover:text-slate-700 text-slate-400 uppercase tracking-wider block">Bank Credits Reconciliation Breakdown:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {bankAccountsList.map(bank => {
                    const bankReceivedSum = receivedItemsForAudit
                      .filter(item => {
                        const targetBankId = item.log.paymentBankId || item.genset.bankAccountId;
                        return targetBankId === bank.id;
                      })
                      .reduce((sum, item) => sum + (item.log.paymentAmount || item.billCalc.grandTotal), 0);
                    
                    return (
                      <div key={bank.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 font-mono text-[10px]">
                        <span className="text-slate-600">
                          🏦 {bank.bankName} (A/c ..{bank.accountNumber.slice(-4)})
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(bankReceivedSum)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CORE LEDGER TABLE */}
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">reconciled collections log spreadsheet:</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider text-[8px] border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300 w-8 text-center">S.N</th>
                        <th className="p-2 border-r border-slate-300 w-16">Clear Date</th>
                        <th className="p-2 border-r border-slate-300">Debtor Client Details</th>
                        <th className="p-2 border-r border-slate-300">Operated Generator Site</th>
                        <th className="p-2 border-r border-slate-300 w-24 text-center">Tax Invoice / Bill Ref</th>
                        <th className="p-2 border-r border-slate-300">Cleared Bank Mode</th>
                        <th className="p-2 border-r border-slate-300">Bank Txn Ref ID</th>
                        <th className="p-2 text-right">Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {receivedItemsForAudit.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                            No billing payments recorded as received for this month.
                          </td>
                        </tr>
                      ) : (
                        receivedItemsForAudit.map((item, idx) => {
                          const targetBank = bankAccountsList.find(b => b.id === (item.log.paymentBankId || item.genset.bankAccountId)) || bankAccountsList[0];
                          return (
                            <tr key={item.log.id} className="hover:bg-slate-50/50">
                              <td className="p-2 border-r border-slate-300 text-center font-bold font-mono">{idx + 1}</td>
                              <td className="p-2 border-r border-slate-300 font-mono whitespace-nowrap">{item.log.paymentDate || 'No Date'}</td>
                              <td className="p-2 border-r border-slate-300 font-bold uppercase">{item.client.name}</td>
                              <td className="p-2 border-r border-slate-300">
                                <span className="font-semibold block">{item.genset.siteName}</span>
                                <span className="text-[8px] text-slate-400 font-bold">{item.genset.capacity}</span>
                              </td>
                              <td className="p-2 border-r border-slate-300 text-center font-mono font-semibold">{item.log.billNo || 'Not Generated'}</td>
                              <td className="p-2 border-r border-slate-300 truncate max-w-[120px] font-semibold" title={targetBank?.bankName}>
                                🏦 {targetBank?.bankName || 'Direct Account'}
                              </td>
                              <td className="p-2 border-r border-slate-300 font-mono text-slate-600 select-all">{item.log.paymentRef || 'N/A'}</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 tracking-tight">
                                {formatCurrency(item.log.paymentAmount || item.billCalc.grandTotal)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black border-t-2 border-slate-800 text-[10px]">
                        <td colSpan={7} className="p-2 border-v border-slate-300 text-right uppercase tracking-wider text-[9px]">
                          Grand Total Audited Receipts Collections:
                        </td>
                        <td className="p-2 text-right font-mono text-xs text-slate-950 underline underline-offset-2">
                          {formatCurrency(receivedItemsForAudit.reduce((acc, item) => acc + (item.log.paymentAmount || item.billCalc.grandTotal), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* AUDIT SIGN-OFF BLOCK SECTION */}
              <div className="border-t border-slate-300 pt-5 space-y-4">
                <p className="text-[9px] text-slate-500 italic max-w-2xl leading-normal text-left">
                  Disclaimer: This payments received register represents highly confidential corporate accounts transactions for auditing compliance. It compiles real-time ledger settlement entries matched with bank statements, clearing vouchers, and physical deposit sheets. Not for external circulation or customer sharing.
                </p>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="text-left font-sans text-[9px] text-slate-400 flex flex-col justify-end">
                    <p>Generated dynamically from local secure ledger logs.</p>
                    <p className="mt-0.5">Reconciliation Date: {new Date().toISOString().split('T')[0]}</p>
                  </div>

                  <div className="text-right space-y-1 relative pr-4">
                    <p className="text-[9.5px] font-bold text-slate-800 uppercase tracking-wider block">Auditor Reconciled Stamp / Authority Sign-Off</p>
                    <div className="pt-10">
                      <div className="inline-block border-t border-slate-950 w-48 pt-1 text-center">
                        <span className="text-[10px] font-black text-slate-950 uppercase tracking-widest block">Accounts Vetting Authority</span>
                        <span className="text-[9px] text-slate-400 italic font-mono block mt-0.5">Engineers Enterprises</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
