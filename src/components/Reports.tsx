/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { AppDatabase, Genset, LogEntry, SiteLog } from '../types';
import { 
  formatMinutesToTime, 
  formatMinutesToDecimal, 
  parseMeterToMinutes,
  formatCurrency 
} from '../utils/time';
import { 
  Printer, 
  FileText, 
  ArrowLeft, 
  Sparkles, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Layers,
  Fuel,
  Info
} from 'lucide-react';

interface ReportsProps {
  db: AppDatabase;
  selectedMonth: string;
  setSelectedMonth?: (month: string) => void;
}

export default function Reports({ db, selectedMonth, setSelectedMonth }: ReportsProps) {
  const [reportType, setReportType] = useState<'site' | 'consolidated'>('site');
  const [selectedGensetId, setSelectedGensetId] = useState<string>(db.gensets[0]?.id || '');
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

  // Clean formatting for Month Label
  const formatMonthLabel = (mKey: string) => {
    const [year, month] = mKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const selectedMonthFormatted = formatMonthLabel(selectedMonthLocal);

  // Selected Genset details
  const genset = useMemo(() => {
    return db.gensets.find(g => g.id === selectedGensetId) || db.gensets[0];
  }, [db.gensets, selectedGensetId]);

  const client = useMemo(() => {
    if (!genset) return null;
    return db.clients.find(c => c.id === genset.clientId);
  }, [db.clients, genset]);

  const siteLog = useMemo(() => {
    if (!genset) return null;
    return db.siteLogs.find(l => l.gensetId === genset.id && l.monthKey === selectedMonthLocal) || {
      id: `temp-${genset.id}-${selectedMonthLocal}`,
      gensetId: genset.id,
      monthKey: selectedMonthLocal,
      startMeter: '0.0',
      endMeter: '0.0',
      entries: []
    } as SiteLog;
  }, [db.siteLogs, genset, selectedMonthLocal]);

  // Calculations for current selected site
  const clockMins = useMemo(() => {
    if (!siteLog) return 0;
    return siteLog.entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  }, [siteLog]);

  const meterDiffMins = useMemo(() => {
    if (!siteLog) return 0;
    const sMins = parseMeterToMinutes(siteLog.startMeter);
    const eMins = parseMeterToMinutes(siteLog.endMeter);
    return Math.max(0, eMins - sMins);
  }, [siteLog]);

  const averagePrice = useMemo(() => {
    if (!genset || !client) return 93.35;

    if (genset.zoneName) {
      const priceConfig = db.zonePrices.find(zp => zp.monthKey === selectedMonthLocal && zp.zoneName.toLowerCase() === genset.zoneName!.toLowerCase());
      if (priceConfig) return priceConfig.averagePrice;
    }

    const zoneName = client.zone || '';
    
    // Look up price in zonePrices list
    const priceConfig = db.zonePrices.find(
      zp => zp.monthKey === selectedMonthLocal && 
      (genset.siteName.toLowerCase().includes(zp.zoneName.split(' ')[0].toLowerCase()) || 
       (zoneName.toLowerCase().includes('salem') && zp.zoneName.toLowerCase().includes('salem')) ||
       (zoneName.toLowerCase().includes('kottayam') && zp.zoneName.toLowerCase().includes('kottayam')) ||
       zp.zoneName.toLowerCase().includes('average'))
    );
    return priceConfig ? priceConfig.averagePrice : (selectedMonthLocal === '2026-04' ? 93.35 : 0);
  }, [db.zonePrices, genset, client, selectedMonthLocal]);

  const fuelLitres = useMemo(() => {
    if (!genset) return 0;
    const hours = clockMins / 60;
    return hours * genset.dieselQuantityPerHour;
  }, [genset, clockMins]);

  const dieselCost = useMemo(() => {
    return Math.round(fuelLitres * averagePrice);
  }, [fuelLitres, averagePrice]);

  const gstRate = 0.18;
  const csgstRate = 0.09;

  const cgstAmount = genset?.gstType === 'CGST_SGST' ? Math.round(dieselCost * csgstRate) : 0;
  const sgstAmount = genset?.gstType === 'CGST_SGST' ? Math.round(dieselCost * csgstRate) : 0;
  const igstAmount = genset?.gstType === 'IGST' ? Math.round(dieselCost * gstRate) : 0;
  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const grandTally = dieselCost + totalTax;

  const triggersPrint = () => {
    window.print();
  };

  // Consolidated Math Summary of all active Gensets under the active Month
  const consolidatedRows = useMemo(() => {
    return db.gensets.map((g, index) => {
      const log = db.siteLogs.find(l => l.gensetId === g.id && l.monthKey === selectedMonthLocal) || {
        startMeter: '0.0',
        endMeter: '0.0',
        entries: []
      };
      
      const cl = db.clients.find(c => c.id === g.clientId);
      const zoneName = cl?.zone || '';
      
      let zp = null;
      if (g.zoneName) {
        zp = db.zonePrices.find(p => p.monthKey === selectedMonthLocal && p.zoneName.toLowerCase() === g.zoneName!.toLowerCase());
      }
      if (!zp) {
        zp = db.zonePrices.find(
          p => p.monthKey === selectedMonthLocal && 
          (g.siteName.toLowerCase().includes(p.zoneName.split(' ')[0].toLowerCase()) || 
           (zoneName.toLowerCase().includes('salem') && p.zoneName.toLowerCase().includes('salem')) ||
           (zoneName.toLowerCase().includes('kottayam') && p.zoneName.toLowerCase().includes('kottayam')) ||
           p.zoneName.toLowerCase().includes('average'))
        );
      }

      const price = zp ? zp.averagePrice : (selectedMonthLocal === '2026-04' ? 93.35 : 0);
      const totalMinutes = (log.entries || []).reduce<number>((sum, e) => sum + (e.durationMinutes || 0), 0);
      const hoursDec = totalMinutes / 60;
      const consumedLitres = hoursDec * g.dieselQuantityPerHour;
      const subtotal = Math.round(consumedLitres * price);

      const cgst = g.gstType === 'CGST_SGST' ? Math.round(subtotal * 0.09) : 0;
      const sgst = g.gstType === 'CGST_SGST' ? Math.round(subtotal * 0.09) : 0;
      const igst = g.gstType === 'IGST' ? Math.round(subtotal * 0.18) : 0;
      const taxes = cgst + sgst + igst;
      const grand = subtotal + taxes;

      const sMins = parseMeterToMinutes(log.startMeter);
      const eMins = parseMeterToMinutes(log.endMeter);
      const diffMins = eMins - sMins;
      const doesTally = Math.abs(diffMins - totalMinutes) < 1.0;

      return {
        id: g.id,
        serial: index + 1,
        siteName: g.siteName,
        capacity: g.capacity,
        clientName: cl?.name || '',
        price,
        totalMinutes,
        runHoursDec: hoursDec.toFixed(2),
        consumedLitres,
        subtotal,
        taxes,
        grand,
        doesTally,
        startMeter: log.startMeter,
        endMeter: log.endMeter,
        meterDiff: formatMinutesToTime(diffMins),
        billNo: (log as any).billNo || '',
        isPaid: (log as any).isPaid || false,
        paymentDate: (log as any).paymentDate || ''
      };
    });
  }, [db, selectedMonthLocal]);

  const consolidatedTotal = useMemo(() => {
    return consolidatedRows.reduce((sum, row) => {
      sum.subtotal += row.subtotal;
      sum.taxes += row.taxes;
      sum.grand += row.grand;
      sum.litres += row.consumedLitres;
      sum.minutes += row.totalMinutes;
      return sum;
    }, { subtotal: 0, taxes: 0, grand: 0, litres: 0, minutes: 0 });
  }, [consolidatedRows]);

  const financialSummary = useMemo(() => {
    let billedSubtotal = 0;
    let billedTaxes = 0;
    let billedGrand = 0;

    let receivedSubtotal = 0;
    let receivedTaxes = 0;
    let receivedGrand = 0;

    let pendingSubtotal = 0;
    let pendingTaxes = 0;
    let pendingGrand = 0;

    consolidatedRows.forEach(r => {
      billedSubtotal += r.subtotal;
      billedTaxes += r.taxes;
      billedGrand += r.grand;

      if (r.isPaid) {
        receivedSubtotal += r.subtotal;
        receivedTaxes += r.taxes;
        receivedGrand += r.grand;
      } else {
        pendingSubtotal += r.subtotal;
        pendingTaxes += r.taxes;
        pendingGrand += r.grand;
      }
    });

    return {
      billedSubtotal,
      billedTaxes,
      billedGrand,
      receivedSubtotal,
      receivedTaxes,
      receivedGrand,
      pendingSubtotal,
      pendingTaxes,
      pendingGrand,
    };
  }, [consolidatedRows]);

  return (
    <div className="space-y-4 font-sans" id="reports-tab">
      
      {/* Configuration Header Area (Hidden on Native Print Layouts via Tailwind print:hidden) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-1.5 matches-tab-[reports]">
            <FileText className="h-5.5 w-5.5 text-blue-600" />
            Bill and Audit Reports
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Retrieve standalone site running logs or download overall lists for compilation.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg gap-1 h-fit text-xs font-bold">
          <button
            onClick={() => setReportType('site')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${reportType === 'site' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-850'}`}
          >
            Site-by-Site Log Sheets
          </button>
          <button
            onClick={() => setReportType('consolidated')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${reportType === 'consolidated' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-850'}`}
          >
            Consolidated Auditor list
          </button>
        </div>
      </div>

      {/* Control bar for report parameters (Hidden on native Print) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {reportType === 'site' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Select Generator Site:</span>
              <select
                value={selectedGensetId}
                onChange={(e) => setSelectedGensetId(e.target.value)}
                className="rounded border border-slate-200 text-xs bg-slate-50 text-slate-800 font-bold px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {db.gensets.map(g => {
                  const cl = db.clients.find(c => c.id === g.clientId);
                  return (
                    <option key={g.id} value={g.id}>
                      {g.siteName} ({g.capacity} - {cl?.zone})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Select Month / Cycle:</span>
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
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={triggersPrint}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-1.5 rounded flex items-center gap-1.5 transition shadow-xs cursor-pointer uppercase tracking-wider"
        >
          <Printer className="h-4 w-4" />
          Print / Save PDF Report
        </button>
      </div>

      {reportType === 'site' && genset && (
        <div className="flex justify-center bg-slate-150 p-2 sm:p-4 rounded-xl print:bg-white print:p-0">
          
          {/* Printable Site Log Sheet A4 container */}
          <div 
            id="printable-report-card" 
            className="bg-white text-black p-6 md:p-8 border border-slate-350 shadow-md font-sans w-full max-w-[800px] leading-relaxed print:shadow-none print:border-none"
            style={{ letterSpacing: '0.01em', minHeight: '297mm' }}
          >
            
            {/* Header / Letterhead Title */}
            <div className="border-b-2 border-slate-300 pb-4 flex justify-between items-start">
              <div>
                {db.company.logoUrl ? (
                  <img 
                    referrerPolicy="no-referrer" 
                    src={db.company.logoUrl} 
                    alt="Company Logo" 
                    className="h-14 object-contain mb-2 max-w-[300px]" 
                  />
                ) : null}
                
                {(!db.company.logoUrl || !db.company.hideCompanyNameWithLogo) && (
                  <h1 className="text-lg font-black uppercase tracking-wider text-slate-900 leading-tight">
                    {db.company.name}
                  </h1>
                )}
                <p className="text-[10px] text-slate-500 font-medium max-w-[450px] leading-relaxed mt-1 whitespace-pre-line">
                  {db.company.address} | Tel: {db.company.contactNumber}
                </p>
                <div className="text-[9px] font-bold text-slate-600 mt-0.5 uppercase">
                  GSTIN: {db.company.gstin} | PAN: {db.company.pan}
                </div>
              </div>

              <div className="text-right flex flex-col justify-between h-full">
                <span className="bg-slate-100 text-slate-800 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded inline-block">
                  Genset Log Sheet
                </span>
                <div className="text-[10px] leading-tight text-slate-500 mt-2">
                  <div><strong>Month:</strong> {selectedMonthFormatted}</div>
                  {siteLog?.billNo && <div><strong>Ref InvoiceNo:</strong> {siteLog.billNo}</div>}
                  {siteLog?.billDate && <div><strong>Date:</strong> {new Date(siteLog.billDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                </div>
              </div>
            </div>

            {/* Site particulars Grid matching Image 1 constraints */}
            <div className="grid grid-cols-2 border-b border-slate-200 py-3 text-[11px] gap-6">
              <div>
                <h4 className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">To:</h4>
                <div className="font-extrabold text-slate-900 mt-0.5">{client?.name || 'M/s LIC of India'}</div>
                <div className="text-slate-600 leading-normal mt-0.5 whitespace-pre-line">{client?.address}</div>
                {client?.gstin && <div className="font-mono text-[10px] mt-1"><strong>Client GSTIN:</strong> {client.gstin}</div>}
              </div>

              <div className="bg-slate-50/50 p-2.5 rounded border border-slate-150">
                <h4 className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Generator & Meter Spec:</h4>
                <div className="font-bold text-slate-800 mt-0.5">Location: <span className="font-extrabold text-blue-900">{genset.siteName}</span></div>
                <div>Genset Capacity: <strong>{genset.capacity}</strong></div>
                <div>Standard Diesel Consumption: <strong>{genset.dieselQuantityPerHour} Ltrs / Hour</strong></div>
                <div>Format Setting: <span className="font-mono font-bold uppercase">{genset.meterFormat || 'HH:MM'}</span></div>
              </div>
            </div>

            {/* Meter reading and tally verification card */}
            <div className="my-4 p-3 bg-blue-50/40 rounded border border-blue-100 grid grid-cols-3 gap-2.5 text-[11px] font-mono leading-normal">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Start Meter Reading</span>
                <span className="text-xs font-bold text-slate-800">{siteLog?.startMeter || '0.0'} Hours</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">End Meter Reading</span>
                <span className="text-xs font-bold text-slate-800">{siteLog?.endMeter || '0.0'} Hours</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Meter Run Hours</span>
                <span className="text-xs font-extrabold text-blue-800">
                  {formatMinutesToTime(meterDiffMins)} Hrs ({formatMinutesToDecimal(meterDiffMins, 2)} decimals)
                </span>
              </div>
            </div>

            {/* Table of Recorded Clock Entries */}
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider font-sans">
                Accumulated Log Timings Tally Breakdown
              </h3>
              
              <table className="w-full text-left text-[11px] border-collapse border border-slate-250">
                <thead>
                  <tr className="border-b border-slate-250 bg-slate-100 text-slate-700 font-bold uppercase text-[9px] tracking-wider leading-none">
                    <th className="py-2 px-3 text-center border-r border-slate-250 w-12">SL.NO</th>
                    <th className="py-2 px-3 border-r border-slate-250">RUNNING DATE</th>
                    <th className="py-2 px-3 border-r border-slate-250">START CLOCK</th>
                    <th className="py-2 px-3 border-r border-slate-250">END CLOCK</th>
                    <th className="py-2 px-3 text-right">TOTAL RUN DURATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {!(siteLog?.entries) || siteLog.entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic font-sans">
                        No clock running entries recorded for this month.
                      </td>
                    </tr>
                  ) : (
                    siteLog.entries.map((e, idx) => {
                      // Pretty date helper
                      const displayDate = e.date ? new Date(e.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '---';
                      return (
                        <tr key={e.id} className="hover:bg-slate-50 text-slate-800 leading-normal">
                          <td className="py-2 px-3 text-center font-bold text-slate-400 border-r border-slate-200 font-sans">{idx + 1}</td>
                          <td className="py-2 px-3 border-r border-slate-200 font-sans font-semibold text-slate-700">{displayDate}</td>
                          <td className="py-2 px-3 border-r border-slate-200 font-semibold">{e.startTime} Hrs</td>
                          <td className="py-2 px-3 border-r border-slate-200 font-semibold">{e.endTime} Hrs</td>
                          <td className="py-2 px-3 text-right font-extrabold text-blue-700">{formatMinutesToTime(e.durationMinutes)} Hrs</td>
                        </tr>
                      );
                    })
                  )}
                  {siteLog && siteLog.entries.length > 0 && (
                    <tr className="bg-slate-50 font-bold text-slate-800 border-t border-slate-250 text-xs">
                      <td colSpan={4} className="py-2.5 px-3 uppercase text-right font-sans font-bold pr-4">
                        Sum Total Running Hours Logged:
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-lg text-blue-700">
                        {formatMinutesToTime(clockMins)} Hrs
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Audit Status Card: compares Clock log to Generator Meter */}
            <div className="border border-slate-250 rounded-lg p-3 bg-slate-50/50 flex items-start gap-2.5 text-[10.5px] leading-relaxed my-5">
              <Info className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-slate-800 uppercase tracking-wider text-[10px]">
                  Audit & Compliance Verification Indicator:
                </p>
                <p className="text-slate-600 mt-0.5">
                  {Math.abs(clockMins - meterDiffMins) < 1.0 ? (
                    <span>The accumulated clock sheet duration matches the physical start/ending meter difference.</span>
                  ) : (
                    <span>The accumulated clock sheet duration does not match the physical start/ending meter difference.</span>
                  )}{" "}
                  Comparing <strong>Clock Total: {formatMinutesToTime(clockMins)} Hrs</strong> against <strong>Generator Meter Total: {formatMinutesToTime(meterDiffMins)} Hrs</strong>.
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {Math.abs(clockMins - meterDiffMins) < 1.0 ? (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[9px] uppercase">
                      ● Status: 100% Fully Tallied & Accurate
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[9px] uppercase">
                      ● Status: Unbalanced / Discrepancy warning
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mathematical billing validation overview to match Image 3 context */}
            <div className="grid grid-cols-2 gap-4 mt-6 border-t border-slate-150 pt-4 text-[11px]">
              <div className="space-y-1 text-slate-600">
                <h4 className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Computations:</h4>
                <div>Fuel Consumption: <strong className="text-slate-800 font-mono">{fuelLitres.toFixed(2)} Litres</strong> ({formatMinutesToDecimal(clockMins, 2)} hrs × {genset.dieselQuantityPerHour} L/hr)</div>
                <div>Zone Average Diesel Price: <strong>₹{averagePrice.toFixed(2)}</strong> per Litre</div>
                <div>Diesel Base Cost: <strong>{formatCurrency(dieselCost)}</strong></div>
                <div>Taxes (CGST/SGST/IGST): <strong>{formatCurrency(totalTax)}</strong></div>
                <div className="border-t border-slate-200 pt-1 text-slate-900 font-extrabold uppercase text-[10px]">Estimated Grand Tally: {formatCurrency(grandTally)}</div>
              </div>

              {/* Verified signatures area */}
              <div className="flex flex-col justify-end items-end h-full text-right self-end min-h-[90px]">
                {db.company.signatureUrl && (
                  <div className="mb-2">
                    <img 
                      referrerPolicy="no-referrer" 
                      src={db.company.signatureUrl} 
                      alt="Authorized seal/sign" 
                      className="h-16 object-contain" 
                    />
                  </div>
                )}
                <div className="border-t border-slate-350 w-44 pt-1 font-bold text-[10px] uppercase text-slate-800">
                  Authorized Sign & Seal
                </div>
                <div className="text-[9px] text-slate-400">{db.company.name}</div>
              </div>
            </div>

          </div>
        </div>
      )}

      {reportType === 'consolidated' && (
        <div 
          id="consolidated-auditor-card"
          className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none"
        >
          
          <div className="border-b-2 border-slate-200 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-indigo-950 uppercase tracking-wider">
                Consolidated Billing audit report
              </h2>
              <p className="text-xs text-slate-400">
                Active Monthly diesel rates and generator run values for <strong className="text-slate-600">{selectedMonthFormatted}</strong>
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              Generated: {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Financial Splits snapshot showcasing GST and Base Splits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            
            {/* Total Billed */}
            <div className="bg-slate-50 border border-slate-220 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed Amt</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {formatCurrency(financialSummary.billedGrand)}
                </span>
              </div>
              <div className="mt-3 border-t border-slate-200/60 pt-2.5 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Running Cost (Base):</span>
                  <span className="font-mono text-slate-800 font-bold">{formatCurrency(financialSummary.billedSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>GST Taxes amount:</span>
                  <span className="font-mono text-slate-800 font-bold">{formatCurrency(financialSummary.billedTaxes)}</span>
                </div>
              </div>
            </div>

            {/* Total Received */}
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col justify-between font-sans">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total Received</span>
                <span className="text-xl font-black text-emerald-850 mt-1 block">
                  {formatCurrency(financialSummary.receivedGrand)}
                </span>
              </div>
              <div className="mt-3 border-t border-emerald-200/50 pt-2.5 space-y-1 text-[11px]">
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Running Cost (Base):</span>
                  <span className="font-mono text-emerald-950 font-bold">{formatCurrency(financialSummary.receivedSubtotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>GST Taxes amount:</span>
                  <span className="font-mono text-emerald-950 font-bold">{formatCurrency(financialSummary.receivedTaxes)}</span>
                </div>
              </div>
            </div>

            {/* Total Pending */}
            <div className="bg-rose-50/65 border border-rose-100 rounded-xl p-4 flex flex-col justify-between font-sans animate-pulse-slow">
              <div>
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Outstanding / Pending</span>
                <span className="text-xl font-black text-rose-800 mt-1 block">
                  {formatCurrency(financialSummary.pendingGrand)}
                </span>
              </div>
              <div className="mt-3 border-t border-rose-200/50 pt-2.5 space-y-1 text-[11px]">
                <div className="flex justify-between text-rose-700 font-medium">
                  <span>Running Cost (Base):</span>
                  <span className="font-mono text-rose-950 font-bold">{formatCurrency(financialSummary.pendingSubtotal)}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-medium">
                  <span>GST Taxes amount:</span>
                  <span className="font-mono text-rose-950 font-bold">{formatCurrency(financialSummary.pendingTaxes)}</span>
                </div>
              </div>
            </div>

          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                  <th className="py-2 px-3 text-center w-10">Sl</th>
                  <th className="py-2 px-3">Location Location</th>
                  <th className="py-2 px-3">Bill / Invoice No</th>
                  <th className="py-2 px-3">Client (Zone)</th>
                  <th className="py-2 px-3 text-center">Size (KVA)</th>
                  <th className="py-2 px-3 text-right">Fuel Rate (₹/L)</th>
                  <th className="py-2 px-3 text-center">Run (HH:MM)</th>
                  <th className="py-2 px-3 text-right">Ltrs Charged</th>
                  <th className="py-2 px-3 text-right">Subtotal Base</th>
                  <th className="py-2 px-3 text-right">GST Taxes</th>
                  <th className="py-2 px-3 text-right">Grand Total</th>
                  <th className="py-2 px-3 text-center">Date of Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                {consolidatedRows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 text-center font-sans text-slate-400">{r.serial}</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-800">{r.siteName}</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-600 bg-slate-50/55">{r.billNo || <span className="text-slate-350 italic font-normal font-sans">Not Issued</span>}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-500">{r.clientName}</td>
                    <td className="py-2.5 px-3 text-center font-sans">{r.capacity}</td>
                    <td className="py-2.5 px-3 text-right">₹{r.price.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-indigo-750">{formatMinutesToTime(r.totalMinutes)}</td>
                    <td className="py-2.5 px-3 text-right">{r.consumedLitres.toFixed(1)} L</td>
                    <td className="py-2.5 px-3 text-right font-sans font-bold text-slate-800">{formatCurrency(r.subtotal)}</td>
                    <td className="py-2.5 px-3 text-right font-sans text-slate-500">{formatCurrency(r.taxes)}</td>
                    <td className="py-2.5 px-3 text-right font-sans font-extrabold text-emerald-800">{formatCurrency(r.grand)}</td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      {r.isPaid && r.paymentDate ? (
                        <span className="text-emerald-800 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                          {r.paymentDate}
                        </span>
                      ) : (
                        <span className="text-rose-700 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded text-[10px] uppercase">
                          Not received
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                <tr className="bg-slate-100 font-extrabold text-xs text-slate-900 font-sans border-t-2 border-slate-200">
                  <td colSpan={6} className="py-3 px-3 uppercase text-right">Summary Combined:</td>
                  <td className="py-3 px-3 text-center font-mono">{formatMinutesToTime(consolidatedTotal.minutes)} hrs</td>
                  <td className="py-3 px-3 text-right font-mono">{consolidatedTotal.litres.toFixed(1)} Litres</td>
                  <td className="py-3 px-3 text-right">{formatCurrency(consolidatedTotal.subtotal)}</td>
                  <td className="py-3 px-3 text-right">{formatCurrency(consolidatedTotal.taxes)}</td>
                  <td className="py-3 px-3 text-right text-lg text-emerald-800">{formatCurrency(consolidatedTotal.grand)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="text-xs text-slate-400 max-w-sm leading-relaxed font-sans">
              * Note: The consolidated billing list comprises estimated totals compiled from local calculations and diesel rate configuration. Subject to contract approvals.
            </div>

            <div className="text-right text-[11px] uppercase tracking-wide text-slate-600 font-sans">
              <span className="block font-bold">Compiled for Auditor submittal</span>
              <span className="block italic text-[10px] text-slate-400 mt-0.5">By {db.company.name}</span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
