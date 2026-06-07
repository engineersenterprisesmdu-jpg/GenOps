/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { AppDatabase, Genset, SiteLog, ZonePriceConfig, Client } from '../types';
import { 
  formatCurrency, 
  formatMinutesToTime, 
  formatMinutesToDecimal,
  parseMeterToMinutes
} from '../utils/time';
import { 
  Calculator, 
  Fuel, 
  Receipt,
  Printer, 
  Save, 
  Calendar,
  Sparkles,
  RefreshCw,
  Plus,
  Compass,
  FileCheck2,
  ChevronDown,
  Info
} from 'lucide-react';

interface BillingSheetProps {
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onSelectInvoice: (gensetId: string) => void;
}

export default function BillingSheet({ db, onUpdateDb, selectedMonth, setSelectedMonth, onSelectInvoice }: BillingSheetProps) {
  // Alter lists sequence state and actions
  const [reorderMode, setReorderMode] = useState(false);

  const moveClientUp = (clientId: string) => {
    onUpdateDb(prev => {
      const cIndex = prev.clients.findIndex(c => c.id === clientId);
      if (cIndex <= 0) return prev;
      const newClients = [...prev.clients];
      const temp = newClients[cIndex];
      newClients[cIndex] = newClients[cIndex - 1];
      newClients[cIndex - 1] = temp;
      return { ...prev, clients: newClients };
    });
  };

  const moveClientDown = (clientId: string) => {
    onUpdateDb(prev => {
      const cIndex = prev.clients.findIndex(c => c.id === clientId);
      if (cIndex < 0 || cIndex >= prev.clients.length - 1) return prev;
      const newClients = [...prev.clients];
      const temp = newClients[cIndex];
      newClients[cIndex] = newClients[cIndex + 1];
      newClients[cIndex + 1] = temp;
      return { ...prev, clients: newClients };
    });
  };

  const moveGensetUp = (gensetId: string) => {
    onUpdateDb(prev => {
      const gIndex = prev.gensets.findIndex(g => g.id === gensetId);
      if (gIndex <= 0) return prev;
      const newGensets = [...prev.gensets];
      const temp = newGensets[gIndex];
      newGensets[gIndex] = newGensets[gIndex - 1];
      newGensets[gIndex - 1] = temp;
      return { ...prev, gensets: newGensets };
    });
  };

  const moveGensetDown = (gensetId: string) => {
    onUpdateDb(prev => {
      const gIndex = prev.gensets.findIndex(g => g.id === gensetId);
      if (gIndex < 0 || gIndex >= prev.gensets.length - 1) return prev;
      const newGensets = [...prev.gensets];
      const temp = newGensets[gIndex];
      newGensets[gIndex] = newGensets[gIndex + 1];
      newGensets[gIndex + 1] = temp;
      return { ...prev, gensets: newGensets };
    });
  };

  // Dynamic dynamic Month options
  const monthsSelectOptions = useMemo(() => {
    const months = new Set<string>();
    db.siteLogs.forEach(log => {
      if (log.monthKey) months.add(log.monthKey);
    });
    db.zonePrices.forEach(zp => {
      if (zp.monthKey) months.add(zp.monthKey);
    });
    const today = new Date();
    for (let i = -12; i <= 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.add(key);
    }
    return Array.from(months).sort().reverse();
  }, [db.siteLogs, db.zonePrices]);

  // Fuel Subzone editor state
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zPrice1st, setZPrice1st] = useState('');
  const [zPriceLast, setZPriceLast] = useState('');
  const [zPriceAvg, setZPriceAvg] = useState('');

  // Default general sheet details
  const [generalBillDate, setGeneralBillDate] = useState('2026-05-01');
  const [generalBillPrefix, setGeneralBillPrefix] = useState('Eng/26-27/');
  const [startBillNo, setStartBillNo] = useState('0027');

  // Load prices for selected month. If none exist, we initialize them
  const currentMonthPrices = useMemo(() => {
    let prices = db.zonePrices.filter(zp => zp.monthKey === selectedMonth);
    if (prices.length === 0) {
      // Create seed prices for this month.
      // As requested: "the diesel rate should become zero every month so that only after conf the diesel rate the diesel cost can be calculated"
      // We default to ₹0.00 for all months other than the main demonstration month (2026-04)
      const isDemoMonth = selectedMonth === '2026-04';
      const initialSeedZones = [
        { name: 'Salem Area', p1: isDemoMonth ? 93.44 : 0, pL: isDemoMonth ? 93.26 : 0, pA: isDemoMonth ? 93.35 : 0 },
        { name: 'Namakkal Area', p1: isDemoMonth ? 93.06 : 0, pL: isDemoMonth ? 93.06 : 0, pA: isDemoMonth ? 93.06 : 0 },
        { name: 'Pathanam Area', p1: isDemoMonth ? 95.29 : 0, pL: isDemoMonth ? 95.71 : 0, pA: isDemoMonth ? 95.50 : 0 },
        { name: 'Kottayam Area', p1: isDemoMonth ? 95.44 : 0, pL: isDemoMonth ? 95.14 : 0, pA: isDemoMonth ? 95.29 : 0 },
        { name: 'Idukki Area', p1: isDemoMonth ? 94.87 : 0, pL: isDemoMonth ? 95.61 : 0, pA: isDemoMonth ? 95.24 : 0 },
        { name: 'Alapuzha Area', p1: isDemoMonth ? 94.96 : 0, pL: isDemoMonth ? 94.96 : 0, pA: isDemoMonth ? 94.96 : 0 },
      ];

      const newConfigs = initialSeedZones.map((z, idx) => ({
        id: `zp-${selectedMonth}-${idx}`,
        zoneName: z.name,
        monthKey: selectedMonth,
        price1st: z.p1,
        priceLast: z.pL,
        averagePrice: z.pA
      }));

      // Update in db
      setTimeout(() => {
        onUpdateDb(prev => {
          // Double check inside
          const exist = prev.zonePrices.some(zp => zp.monthKey === selectedMonth);
          if (exist) return prev;
          return {
            ...prev,
            zonePrices: [...prev.zonePrices, ...newConfigs]
          };
        });
      }, 50);

      return newConfigs;
    }
    return prices;
  }, [db.zonePrices, selectedMonth]);

  // Handle Editing monthly subzone Prices
  const startEditPrice = (zp: ZonePriceConfig) => {
    setEditingZoneId(zp.id);
    setZPrice1st(zp.price1st.toString());
    setZPriceLast(zp.priceLast.toString());
    setZPriceAvg(zp.averagePrice.toString());
  };

  const handleSavePrice = (id: string) => {
    const p1 = parseFloat(zPrice1st) || 0;
    const pL = parseFloat(zPriceLast) || 0;
    
    // Auto calculate average of 1st and last unless overridden
    let pA = parseFloat(zPriceAvg) || 0;
    if (!zPriceAvg || pA === 0) {
      pA = parseFloat(((p1 + pL) / 2).toFixed(2));
    }

    onUpdateDb(prev => ({
      ...prev,
      zonePrices: prev.zonePrices.map(zp => 
        zp.id === id ? { ...zp, price1st: p1, priceLast: pL, averagePrice: pA } : zp
      )
    }));

    setEditingZoneId(null);
  };

  const resetPricesToZero = () => {
    if (window.confirm(`Are you sure you want to reset all Subzone Fuel Prices to ₹0.00 for ${formatMonthLabel(selectedMonth)}? This will require configuring fuel rates before diesel costs can be calculated.`)) {
      onUpdateDb(prev => ({
        ...prev,
        zonePrices: prev.zonePrices.map(zp => 
          zp.monthKey === selectedMonth ? { ...zp, price1st: 0, priceLast: 0, averagePrice: 0 } : zp
        )
      }));
    }
  };

  // Safe helper to get subzone price for a site location
  const getSubzonePriceForSite = (genset: Genset, clientZone: string) => {
    if (genset.zoneName) {
      const priceConfig = currentMonthPrices.find(zp => zp.zoneName.toLowerCase() === genset.zoneName!.toLowerCase());
      if (priceConfig) return priceConfig;
    }

    const siteName = genset.siteName;
    const nameLower = siteName.toLowerCase();
    const zoneLower = clientZone.toLowerCase();

    // Match sub-areas
    let matchedName = 'Salem Area';
    if (nameLower.includes('namakkal') || nameLower.includes('rasipuram') || nameLower.includes('velur') || nameLower.includes('komara')) {
      matchedName = 'Namakkal Area';
    } else if (nameLower.includes('thiruvella') || nameLower.includes('kadampanad') || nameLower.includes('mallapally') || nameLower.includes('kozhen')) {
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

    const priceConfig = currentMonthPrices.find(zp => zp.zoneName.toLowerCase() === matchedName.toLowerCase());
    return priceConfig || { price1st: 0, priceLast: 0, averagePrice: 0, zoneName: matchedName };
  };

  // Bulk set Invoice Numbers chronology sequentially as requested!
  // "the chronology of the list of clients shall be arranged by me and the bill number also shall be entered as from to or shall be generated entered by me since we have other bill numbers for the same month"
  const handleBulkGenerateBillDetails = () => {
    const baseNo = parseInt(startBillNo, 10);
    if (isNaN(baseNo)) {
      alert('Please enter a valid starting numeric bill suffix (e.g. 0027)');
      return;
    }

    onUpdateDb(prev => {
      let runIndex = 0;
      const updatedLogs = [...prev.siteLogs];

      // Assign sequentially for all generator sites in active groups
      prev.gensets.forEach(g => {
        const logIndex = updatedLogs.findIndex(l => l.gensetId === g.id && l.monthKey === selectedMonth);
        const billStr = `${generalBillPrefix}${(baseNo + runIndex).toString().padStart(4, '0')}`;
        
        const existingLog = logIndex >= 0 ? updatedLogs[logIndex] : {
          id: `log-${g.id}-${selectedMonth}`,
          gensetId: g.id,
          monthKey: selectedMonth,
          startMeter: '0.0',
          endMeter: '0.0',
          entries: []
        };

        const updatedLog = {
          ...existingLog,
          billNo: billStr,
          billDate: generalBillDate
        };

        if (logIndex >= 0) {
          updatedLogs[logIndex] = updatedLog;
        } else {
          updatedLogs.push(updatedLog);
        }

        runIndex++;
      });

      return { ...prev, siteLogs: updatedLogs };
    });

    alert('Chronological bill numbers and dates populated successfully across all sites!');
  };

  // Grouped breakdown calculations for display (LIC Salem Division vs Kottayam Division)
  const clientDivisionsList = useMemo(() => {
    return db.clients;
  }, [db.clients]);

  // Compute calculated values for ALL rows for display & aggregate summaries
  const rowsCalculations = useMemo(() => {
    const list: Array<{
      genset: Genset;
      log: SiteLog;
      client: Client;
      priceConfig: any;
      clockMins: number;
      fuelPrice: number;
      costPerHour: number;
      totalHrsDec: number;
      subtotalCost: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalWithTax: number;
      grandTotal: number;
      roundedOff: number;
    }> = [];

    db.gensets.forEach(g => {
      const client = db.clients.find(c => c.id === g.clientId);
      if (!client) return;

      const log = db.siteLogs.find(l => l.gensetId === g.id && l.monthKey === selectedMonth) || {
        id: `temp-${g.id}-${selectedMonth}`,
        gensetId: g.id,
        monthKey: selectedMonth,
        startMeter: '0.0',
        endMeter: '0.0',
        entries: [],
        billNo: '',
        billDate: ''
      };

      // Math
      const clockMins = log.entries.reduce((sum, e) => sum + e.durationMinutes, 0);
      const totalHrsDec = clockMins / 60;
      
      const priceConfig = getSubzonePriceForSite(g, client.zone);
      const fuelPrice = priceConfig.averagePrice;
      
      const costPerHour = parseFloat((g.dieselQuantityPerHour * fuelPrice).toFixed(2));
      const subtotalCost = Math.round(costPerHour * totalHrsDec);

      // Taxes
      let cgst = 0, sgst = 0, igst = 0;
      if (g.gstType === 'CGST_SGST') {
        cgst = parseFloat((subtotalCost * 0.09).toFixed(2));
        sgst = parseFloat((subtotalCost * 0.09).toFixed(2));
      } else {
        igst = parseFloat((subtotalCost * 0.18).toFixed(2));
      }

      const totalWithTax = subtotalCost + cgst + sgst + igst;
      const grandTotal = Math.round(totalWithTax);
      const roundedOff = parseFloat((grandTotal - totalWithTax).toFixed(2));

      list.push({
        genset: g,
        log,
        client,
        priceConfig,
        clockMins,
        fuelPrice,
        costPerHour,
        totalHrsDec,
        subtotalCost,
        cgst,
        sgst,
        igst,
        totalWithTax,
        grandTotal,
        roundedOff
      });
    });

    return list;
  }, [db, selectedMonth, currentMonthPrices]);

  // Format month label
  const formatMonthLabel = (mKey: string) => {
    const [year, month] = mKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="space-y-4" id="billing-calculations-tab">
      
      {/* Header Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-1.5">
            <Calculator className="h-5.5 w-5.5 text-blue-600 font-bold" />
            Diesel Running Hours Bill
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Reconciliation summary tallying running meter logs with tax invoicing, compliant with client approval grids.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Active Month Dropdown Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-lg">
            <span className="text-xs font-bold text-slate-600 pl-1 uppercase tracking-wide">Active Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-bold text-blue-800 bg-white border border-slate-200 rounded p-1 focus:outline-none"
            >
              {monthsSelectOptions.map(m => (
                <option key={m} value={m}>
                  {(() => {
                    const [year, month] = m.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  })()}
                </option>
              ))}
            </select>
          </div>

          {/* Alter Lists Order Mode selector */}
          <button
            type="button"
            onClick={() => setReorderMode(!reorderMode)}
            className={`text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              reorderMode 
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <span>🔄</span>
            {reorderMode ? 'Done Altering Order' : 'Alter Lists Insertion Order'}
          </button>
        </div>
      </div>

      {/* Sequential Bill Number Configurator */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <Receipt className="h-4 w-4 text-blue-600" />
          Seq. Chronological Bill Numbers Suffix & Dates
        </h2>
        <p className="text-[11px] text-slate-500 leading-normal">
          Enter your current month starting sequence (e.g. Eng/26-27/0027). Clicking "Populate Invoices Chronology" will bulk-fill serial inputs for all sites chronologically, accommodating existing custom monthly ranges.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prefix Pattern</label>
            <input
              type="text"
              value={generalBillPrefix}
              onChange={(e) => setGeneralBillPrefix(e.target.value)}
              className="w-full text-xs font-semibold rounded-md border border-slate-200 p-1.5 bg-slate-50 text-slate-800 focus:bg-white"
              placeholder="e.g. Eng/26-27/"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Starting Serial Suffix</label>
            <input
              type="text"
              value={startBillNo}
              onChange={(e) => setStartBillNo(e.target.value)}
              className="w-full text-xs font-semibold rounded-md border border-slate-200 p-1.5 bg-slate-50 text-slate-800 focus:bg-white"
              placeholder="e.g. 0027"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Common Bill Date</label>
            <input
              type="date"
              value={generalBillDate}
              onChange={(e) => setGeneralBillDate(e.target.value)}
              className="w-full text-xs font-semibold rounded-md border border-slate-200 p-1.5 bg-slate-50 text-slate-800 focus:bg-white font-mono"
            />
          </div>

          <button
            type="button"
            onClick={handleBulkGenerateBillDetails}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded h-8.5 flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Populate Invoices Chronology
          </button>

          <button
            type="button"
            onClick={() => onSelectInvoice('all')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded h-8.5 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Generate & Print all monthly invoices at one stretch"
          >
            <Printer className="h-3.5 w-3.5" />
            Print All Invoices at One Stretch ({rowsCalculations.length})
          </button>
        </div>
      </div>

      {/* Main Consolidated Sheets table styled exactly like Image 3 */}
      {clientDivisionsList.map(client => {
        // Filter rows belonging to this division group
        const divisionRows = rowsCalculations.filter(r => r.client.id === client.id);
        if (divisionRows.length === 0) return null;

        // Sum columns for group
        const sumSubtotal = divisionRows.reduce((a, b) => a + b.subtotalCost, 0);
        const sumCgst = divisionRows.reduce((a, b) => a + b.cgst, 0);
        const sumSgst = divisionRows.reduce((a, b) => a + b.sgst, 0);
        const sumIgst = divisionRows.reduce((a, b) => a + b.igst, 0);
        const sumGrand = divisionRows.reduce((a, b) => a + b.grandTotal, 0);

         return (
          <div key={client.id} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-2 p-3">
            <div className="flex items-center justify-between border-b border-slate-150 pb-2.5">
              <div className="flex items-center gap-3">
                {reorderMode && (
                  <div className="flex gap-1 bg-slate-100 p-1 rounded border border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveClientUp(client.id)}
                      className="text-[11px] hover:bg-white text-slate-700 font-extrabold px-1.5 py-0.5 rounded border border-slate-200 cursor-pointer"
                      title="Move Group Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveClientDown(client.id)}
                      className="text-[11px] hover:bg-white text-slate-700 font-extrabold px-1.5 py-0.5 rounded border border-slate-200 cursor-pointer"
                      title="Move Group Down"
                    >
                      ▼
                    </button>
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    {client.name} - {client.zone} billing
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Group Subtotals & Taxes</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectInvoice('client-' + client.id)}
                  className="bg-slate-55 hover:bg-blue-50 border border-slate-200 text-slate-800 hover:text-blue-700 font-extrabold text-[10px] px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer"
                  title={`Generate & Print all ${divisionRows.length} Invoices for ${client.name} in one stretch`}
                >
                  <Printer className="h-3 w-3 text-blue-600" />
                  Print Group Invoices ({divisionRows.length})
                </button>
                <span className="text-[10px] font-bold px-2 py-1 bg-emerald-50 text-emerald-850 border border-emerald-100 rounded font-sans">
                  {divisionRows.length} Locations Active
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-bold text-[9px] text-slate-450 uppercase tracking-wider">
                    <th className="py-1.5 px-2">Place / Site Location</th>
                    <th className="py-1.5 px-2">Capacity</th>
                    <th className="py-1.5 px-2 text-right">Ratio/Hr</th>
                    <th className="py-1.5 px-2">Bill No. (Editable)</th>
                    <th className="py-1.5 px-2">Bill Date</th>
                    <th className="py-1.5 px-2 text-right">Fuel Price</th>
                    <th className="py-1.5 px-2 text-right">Cost/Hr</th>
                    <th className="py-1.5 px-2 text-center">Run Hours</th>
                    <th className="py-1.5 px-2 text-right">Diesel cost</th>
                    {client.zone.toLowerCase().includes('salem') ? (
                      <>
                        <th className="py-1.5 px-2 text-right">CGST (9%)</th>
                        <th className="py-1.5 px-2 text-right">SGST (9%)</th>
                      </>
                    ) : (
                      <th className="py-1.5 px-2 text-right">IGST (18%)</th>
                    )}
                    <th className="py-1.5 px-2 text-right">Total Amt</th>
                    <th className="py-1.5 px-2 text-right">Round Off</th>
                    <th className="py-1.5 px-2 text-right bg-blue-50/50">Grand Total</th>
                    <th className="py-1.5 px-2 text-center">Invoice</th>
                    <th className="py-1.5 px-2 text-center">Receipt Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {divisionRows.map(row => {
                    const clockHrsStr = formatMinutesToTime(row.clockMins);

                    return (
                      <tr key={row.genset.id} className="hover:bg-slate-50/60 transition text-slate-755 font-mono text-[10.5px]">
                        <td className="py-1.5 px-2 font-sans font-bold text-slate-800 text-left flex items-center gap-2">
                          {reorderMode && (
                            <div className="flex gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 shrink-0 select-none">
                              <button
                                type="button"
                                onClick={() => moveGensetUp(row.genset.id)}
                                className="text-[9px] hover:bg-white text-slate-700 font-bold px-1 rounded transition cursor-pointer"
                                title="Move Site Up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => moveGensetDown(row.genset.id)}
                                className="text-[9px] hover:bg-white text-slate-700 font-bold px-1 rounded transition cursor-pointer"
                                title="Move Site Down"
                              >
                                ▼
                              </button>
                            </div>
                          )}
                          <span>{row.genset.siteName}</span>
                        </td>
                        <td className="py-1.5 px-2 font-sans text-left text-slate-500">{row.genset.capacity}</td>
                        <td className="py-1.5 px-2 text-right text-slate-500">{row.genset.dieselQuantityPerHour} L</td>
                        
                        {/* Custom individual invoice override inputs as requested in point #3 */}
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={row.log.billNo || ''}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              onUpdateDb(prev => {
                                const idx = prev.siteLogs.findIndex(l => l.gensetId === row.genset.id && l.monthKey === selectedMonth);
                                let newLogs = [...prev.siteLogs];
                                if (idx >= 0) {
                                  newLogs[idx] = { ...newLogs[idx], billNo: newVal };
                                } else {
                                  newLogs.push({
                                    id: `log-${row.genset.id}-${selectedMonth}`,
                                    gensetId: row.genset.id,
                                    monthKey: selectedMonth,
                                    startMeter: '0.0',
                                    endMeter: '0.0',
                                    entries: [],
                                    billNo: newVal,
                                    billDate: row.log.billDate || ''
                                  });
                                }
                                return { ...prev, siteLogs: newLogs };
                              });
                            }}
                            placeholder="Invoice No"
                            className="w-28 text-[11px] font-sans font-semibold text-slate-700 bg-slate-50 border border-slate-200 focus:bg-white rounded p-1 font-mono focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="date"
                            value={row.log.billDate || ''}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              onUpdateDb(prev => {
                                const idx = prev.siteLogs.findIndex(l => l.gensetId === row.genset.id && l.monthKey === selectedMonth);
                                let newLogs = [...prev.siteLogs];
                                if (idx >= 0) {
                                  newLogs[idx] = { ...newLogs[idx], billDate: newVal };
                                } else {
                                  newLogs.push({
                                    id: `log-${row.genset.id}-${selectedMonth}`,
                                    gensetId: row.genset.id,
                                    monthKey: selectedMonth,
                                    startMeter: '0.0',
                                    endMeter: '0.0',
                                    entries: [],
                                    billNo: row.log.billNo || '',
                                    billDate: newVal
                                  });
                                }
                                return { ...prev, siteLogs: newLogs };
                              });
                            }}
                            className="w-28 text-[11px] font-sans text-slate-705 bg-slate-50 border border-slate-200 focus:bg-white rounded p-1 font-mono focus:outline-none"
                          />
                        </td>

                        <td className="py-1.5 px-2 text-right font-semibold text-amber-700">₹{row.fuelPrice.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-600">₹{row.costPerHour.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-center text-blue-650 font-extrabold">{clockHrsStr} Hrs</td>
                        <td className="py-1.5 px-2 text-right font-bold text-slate-800">₹{row.subtotalCost.toLocaleString('en-IN')}</td>
                        
                        {client.zone.toLowerCase().includes('salem') ? (
                          <>
                            <td className="py-1.5 px-2 text-right text-slate-450">₹{row.cgst.toFixed(2)}</td>
                            <td className="py-1.5 px-2 text-right text-slate-450">₹{row.sgst.toFixed(2)}</td>
                          </>
                        ) : (
                          <td className="py-1.5 px-2 text-right text-slate-450">₹{row.igst.toFixed(2)}</td>
                        )}

                        <td className="py-1.5 px-2 text-right text-slate-600">₹{row.totalWithTax.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-400">
                          {row.roundedOff > 0 ? `+₹${row.roundedOff}` : row.roundedOff === 0 ? '0' : `-₹${Math.abs(row.roundedOff)}`}
                        </td>
                        <td className="py-1.5 px-2 text-right bg-blue-50/40 font-bold text-blue-900">₹{row.grandTotal.toLocaleString('en-IN')}</td>
                        <td className="py-1.5 px-2 text-center font-sans">
                          <button
                            onClick={() => onSelectInvoice(row.genset.id)}
                            className="bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 p-1 rounded transition flex items-center justify-center mx-auto cursor-pointer"
                            title="Generate single Tax Invoice"
                          >
                            <Printer className="h-3 w-3" />
                          </button>
                        </td>
                        <td className="py-1.5 px-1.5 text-center font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateDb(prev => {
                                const idx = prev.siteLogs.findIndex(l => l.gensetId === row.genset.id && l.monthKey === selectedMonth);
                                let newLogs = [...prev.siteLogs];
                                if (idx >= 0) {
                                  const wasPaid = !!newLogs[idx].isPaid;
                                  newLogs[idx] = { 
                                    ...newLogs[idx], 
                                    isPaid: !wasPaid, 
                                    paymentDate: !wasPaid ? new Date().toISOString().split('T')[0] : undefined
                                  };
                                } else {
                                  newLogs.push({
                                    id: `log-${row.genset.id}-${selectedMonth}`,
                                    gensetId: row.genset.id,
                                    monthKey: selectedMonth,
                                    startMeter: '0.0',
                                    endMeter: '0.0',
                                    entries: [],
                                    isPaid: true,
                                    paymentDate: new Date().toISOString().split('T')[0]
                                  });
                                }
                                return { ...prev, siteLogs: newLogs };
                              });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition block mx-auto cursor-pointer border ${
                              row.log.isPaid 
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                            title={row.log.isPaid ? `Paid on ${row.log.paymentDate || 'N/A'}. Click to mark Pending.` : 'Pending. Click to mark Paid.'}
                          >
                            {row.log.isPaid ? 'Paid' : 'Pending'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Division Total sum Row matching Image 3 layout */}
                  <tr className="bg-slate-50 font-bold font-mono text-[10.5px] text-slate-850 border-t border-slate-200">
                    <td colSpan={8} className="py-1.5 px-2 text-right font-sans uppercase tracking-wider font-extrabold text-slate-500">
                      Total ({client.zone})
                    </td>
                    <td className="py-1.5 px-2 text-right font-extrabold text-slate-800">₹{sumSubtotal.toLocaleString('en-IN')}</td>
                    {client.zone.toLowerCase().includes('salem') ? (
                      <>
                        <td className="py-1.5 px-2 text-right text-slate-600 font-bold">₹{sumCgst.toLocaleString('en-IN')}</td>
                        <td className="py-1.5 px-2 text-right text-slate-600 font-bold">₹{sumSgst.toLocaleString('en-IN')}</td>
                      </>
                    ) : (
                      <td className="py-1.5 px-2 text-right text-slate-600 font-bold">₹{sumIgst.toLocaleString('en-IN')}</td>
                    )}
                    <td colSpan={2} className="py-1.5 px-2 text-right text-slate-400 font-sans italic font-normal text-[9px]">Taxes Compiled</td>
                    <td className="py-1.5 px-2 text-right text-blue-900 bg-blue-100/50 font-extrabold font-sans text-xs">
                      {formatCurrency(sumGrand)}
                    </td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        );
      })}

      {/* Subzone Diesel Price List Maintenance - matching bottom grid of Image 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Informational Guidelines Card */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-2 h-fit">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <Info className="h-4 w-4 text-blue-600 font-bold" />
            Billing Formula Breakdown
          </h3>
          <p className="text-[11px] text-slate-500 leading-normal">
            The billing formulas used in this sheet are mathematically matched to historical Excel formats for compliance audits:
          </p>
          <ul className="text-[11px] text-slate-600 list-inside list-disc space-y-1.5 font-sans">
            <li><strong>Diesel Cost / Hour</strong> = Genset Litres/Hr × Zone Average Cost</li>
            <li><strong>Minutes Run</strong> = Total calculated from Clock Log entries.</li>
            <li><strong>Subtotal</strong> = Round(Cost/Hr × Total Minutes / 60)</li>
            <li><strong>Taxes</strong> = Subtotal × 18% (Salem: 9%+9% CGST/SGST, Kottayam: 18% IGST)</li>
            <li><strong>Grand Tally</strong> = Subtotal + Total Taxes (Rounded to nearest Rupee).</li>
          </ul>
        </div>
        
        {/* Diesel subzone rates configuration */}
        <div className="lg:col-span-2 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-3" id="diesel-subzone-rates-section">
          <div className="border-b border-slate-150 pb-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Fuel className="h-4 w-4 text-amber-500 font-bold" />
                Subzone Fuel Rates per Month ({formatMonthLabel(selectedMonth)})
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                Configure zone diesel prices (1st and last date) to dynamically compute average costs.
              </p>
            </div>
            <button
              type="button"
              onClick={resetPricesToZero}
              className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded border border-rose-200 hover:border-rose-300 transition shrink-0 cursor-pointer"
              title="Reset rates to zero as requested"
            >
              Reset to ₹0.00
            </button>
          </div>

          {/* Warnings banner if average prices are ₹0.00 */}
          {currentMonthPrices.some(zp => zp.averagePrice === 0) && (
            <div className="p-3 bg-red-50/80 border border-red-200 rounded-lg text-[11.5px] text-red-900 font-medium leading-relaxed" id="rates-zero-notice-banner">
              ⚠️ <strong>Diesel Rates Unconfigured:</strong> The diesel rates for one or more subzones are set to <strong>₹0.00</strong> for {formatMonthLabel(selectedMonth)}. 
              Only after you click <span className="text-blue-700 font-bold">"Edit Prices"</span> and configure the current rate will the diesel cost of running hours be computed.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentMonthPrices.map(zp => {
              const isEditing = editingZoneId === zp.id;
              const isZero = zp.averagePrice === 0;
              return (
                <div 
                  key={zp.id} 
                  className={`border p-2.5 rounded-lg space-y-2 hover:bg-slate-50/50 transition ${
                    isZero 
                      ? 'border-red-200 bg-red-50/5/10 shadow-xs' 
                      : 'border-slate-201'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      {zp.zoneName}
                      {isZero && (
                        <span className="text-[9px] text-red-700 bg-red-150 border border-red-200 px-1 py-0.2 rounded font-semibold tracking-wider font-sans uppercase">
                          unconfigured
                        </span>
                      )}
                    </span>
                    {isEditing ? (
                      <button
                        onClick={() => handleSavePrice(zp.id)}
                        className="text-[10px] bg-emerald-605 hover:bg-emerald-700 text-white font-extrabold px-1.5 py-0.5 rounded cursor-pointer uppercase tracking-wider bg-emerald-600"
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => startEditPrice(zp)}
                        className="text-[10px] text-blue-600 hover:underline cursor-pointer uppercase font-bold tracking-wider"
                      >
                        Edit Prices
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-bold">1st</span>
                        <input
                          type="number"
                          step="0.01"
                          value={zPrice1st}
                          onChange={(e) => setZPrice1st(e.target.value)}
                          className="w-full text-xs font-mono rounded border border-slate-200 p-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-bold">Last</span>
                        <input
                          type="number"
                          step="0.01"
                          value={zPriceLast}
                          onChange={(e) => setZPriceLast(e.target.value)}
                          className="w-full text-xs font-mono rounded border border-slate-200 p-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-bold">Average</span>
                        <input
                          type="number"
                          step="0.01"
                          value={zPriceAvg}
                          onChange={(e) => setZPriceAvg(e.target.value)}
                          className="w-full text-xs font-mono rounded border border-slate-200 p-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Auto"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-sans">Cost 1st</span>
                        <span className={`block font-bold ${isZero ? 'text-red-500 font-semibold' : 'text-slate-700'}`}>₹{zp.price1st.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-sans">Cost 31st</span>
                        <span className={`block font-bold ${isZero ? 'text-red-500 font-semibold' : 'text-slate-700'}`}>₹{zp.priceLast.toFixed(2)}</span>
                      </div>
                      <div className={`px-1.5 py-0.5 rounded border ${isZero ? 'bg-red-50 border-red-200' : 'bg-amber-50/40 border-amber-100'}`}>
                        <span className={`text-[9px] uppercase font-bold font-sans ${isZero ? 'text-red-700' : 'text-amber-800'}`}>Avg Cost</span>
                        <span className={`block font-extrabold border-t mt-0.5 pointer-events-none ${isZero ? 'text-red-800 border-red-200' : 'text-amber-900 border-amber-100'}`}>
                          ₹{zp.averagePrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
