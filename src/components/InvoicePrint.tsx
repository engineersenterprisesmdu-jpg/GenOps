/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { AppDatabase, Genset } from '../types';
import { 
  formatCurrency, 
  formatMinutesToTime, 
  formatMinutesToDecimal,
  convertNumberToWords,
  parseMeterToMinutes
} from '../utils/time';
import { 
  ArrowLeft, 
  Printer, 
  Sparkles, 
  ToggleLeft,
  ToggleRight,
  FileText,
  Mail,
  Scale
} from 'lucide-react';

interface InvoicePageProps {
  key?: string;
  db: AppDatabase;
  gensetId: string;
  selectedMonth: string;
  useLetterhead: boolean;
  includeSeal: boolean;
  isMultiPrint: boolean;
}

function InvoicePage({ db, gensetId, selectedMonth, useLetterhead, includeSeal, isMultiPrint }: InvoicePageProps) {
  // Load selected genset details
  const genset = useMemo(() => {
    return db.gensets.find(g => g.id === gensetId);
  }, [db.gensets, gensetId]);

  const client = useMemo(() => {
    if (!genset) return null;
    return db.clients.find(c => c.id === genset.clientId);
  }, [db.clients, genset]);

  const log = useMemo(() => {
    if (!genset) return null;
    return db.siteLogs.find(l => l.gensetId === genset.id && l.monthKey === selectedMonth) || {
      id: `l-temp-${genset.id}`,
      gensetId: genset.id,
      monthKey: selectedMonth,
      startMeter: '0.0',
      endMeter: '0.0',
      entries: [],
      billNo: 'Eng/26-27/0027',
      billDate: '2026-05-01'
    };
  }, [db.siteLogs, genset, selectedMonth]);

  // Pricing Subzone configuration matching
  const priceConfig = useMemo(() => {
    if (!genset || !client) return { averagePrice: 93.35, zoneName: 'Default' };

    if (genset.zoneName) {
      const price = db.zonePrices.find(zp => zp.monthKey === selectedMonth && zp.zoneName.toLowerCase() === genset.zoneName!.toLowerCase());
      if (price) return price;
    }

    const nameLower = genset.siteName.toLowerCase();
    const zoneLower = client.zone.toLowerCase();

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

    const price = db.zonePrices.find(zp => zp.monthKey === selectedMonth && zp.zoneName.toLowerCase() === matchedName.toLowerCase());
    return price || { averagePrice: selectedMonth === '2026-04' ? 93.35 : 0, zoneName: matchedName };
  }, [db.zonePrices, genset, client, selectedMonth]);

  // Invoice calculations
  const invoiceData = useMemo(() => {
    if (!genset || !log) return null;

    const clockMins = log.entries.reduce((sum, e) => sum + e.durationMinutes, 0);
    const totalHrsDec = clockMins / 60;
    const fuelPrice = priceConfig.averagePrice;
    
    // Formula matching
    const costPerHour = parseFloat((genset.dieselQuantityPerHour * fuelPrice).toFixed(2));
    const subtotalCost = Math.round(costPerHour * totalHrsDec);

    let cgst = 0, sgst = 0, igst = 0;
    if (genset.gstType === 'CGST_SGST') {
      cgst = parseFloat((subtotalCost * 0.09).toFixed(2));
      sgst = parseFloat((subtotalCost * 0.09).toFixed(2));
    } else {
      igst = parseFloat((subtotalCost * 0.18).toFixed(2));
    }

    const totalWithTax = subtotalCost + cgst + sgst + igst;
    const grandTotal = Math.round(totalWithTax);
    const roundedOff = parseFloat((grandTotal - totalWithTax).toFixed(2));

    const totalInWords = convertNumberToWords(grandTotal);

    // Bill date formatting
    let billDateFormatted = '';
    if (log.billDate) {
      billDateFormatted = new Date(log.billDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }

    // Month formatting (e.g. Apr-26)
    const [year, month] = selectedMonth.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
    const billingMonthLabel = dateObj.toLocaleDateString('en-GB', {
      month: 'short',
      year: '2-digit'
    });

    return {
      clockMins,
      totalHrsDec,
      durationHrsStr: formatMinutesToTime(clockMins),
      fuelPrice,
      costPerHour,
      subtotalCost,
      cgst,
      sgst,
      igst,
      roundedOff,
      grandTotal,
      totalInWords,
      billDateFormatted,
      billingMonthLabel
    };
  }, [genset, log, priceConfig, selectedMonth]);

  if (!genset || !client || !log || !invoiceData) {
    return (
      <div className="bg-white p-6 rounded-2xl border text-center text-rose-500 font-bold max-w-[800px] w-full">
        Unmapped parameters for site {gensetId}.
      </div>
    );
  }

  return (
    <div 
      id="billing-invoice-box"
      className={`bg-white text-black p-5 md:p-8 border border-slate-350 shadow-md font-sans w-full max-w-[800px] leading-relaxed print:shadow-none print:border-none ${isMultiPrint ? 'print-invoice-page mb-6 print:mb-0' : ''}`}
      style={{ letterSpacing: '0.01em' }}
    >
      {/* Letterhead Header Banner option */}
      {useLetterhead && (
        <div className="border-b-2 border-black pb-3 text-left print:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:flex-row print:items-center print:justify-between">
            <div className="text-left print:text-left">
              {db.company.logoUrl ? (
                <img 
                  referrerPolicy="no-referrer" 
                  src={db.company.logoUrl} 
                  alt="Company Logo" 
                  className="h-14 object-contain mb-2 max-w-[300px] inline-block" 
                />
              ) : null}
              
              {(!db.company.logoUrl || !db.company.hideCompanyNameWithLogo) && (
                <div className="mt-1">
                  {db.company.name === 'ENGINEERS ENTERPRISES' ? (
                    <>
                      <h1 className="text-3xl font-extrabold tracking-widest text-[#1e293b] uppercase" style={{ fontFamily: 'monospace, sans-serif' }}>
                        ENGINEERS
                      </h1>
                      <span className="text-[10px] font-bold tracking-[0.25em] text-slate-500 uppercase block pl-1">ENTERPRISES</span>
                    </>
                  ) : (
                    <h1 className="text-xl font-black uppercase tracking-wider text-slate-900 leading-tight">
                      {db.company.name}
                    </h1>
                  )}
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-black text-white rounded font-mono mt-1 inline-block uppercase">
                    GEN POWER SOLUTIONS
                  </span>
                </div>
              )}
            </div>
            
            {/* Company address block right side */}
            <div className="text-left sm:text-right print:text-right text-[10px] font-medium text-slate-700 mt-2 sm:mt-0 print:mt-0 font-sans space-y-0.5 sm:max-w-xs print:max-w-xs leading-normal">
              <p className="font-bold text-slate-900">{db.company.address}</p>
              <p>Cell: {db.company.contactNumber} {db.company.email ? ` | ${db.company.email}` : ''}</p>
              <div className="flex justify-start sm:justify-end print:justify-end gap-x-3 font-mono text-[9px] pt-1 mt-1 border-t border-slate-200">
                <div>
                  <span className="text-slate-400 font-sans">GST NO: </span>
                  <strong className="text-slate-900">{db.company.gstin}</strong>
                </div>
                {db.company.pan && (
                  <div>
                    <span className="text-slate-400 font-sans">PAN: </span>
                    <strong className="text-slate-900">{db.company.pan}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tax Invoice ribbon */}
      <div className="my-4 border border-black p-1 text-center bg-slate-50">
        <h2 className="text-sm font-extrabold tracking-widest text-black uppercase">TAX INVOICE</h2>
      </div>

      {/* Bill No, Party parameters grid columns */}
      <div className="grid grid-cols-2 text-xs border border-black divide-x divide-black mb-4">
        <div className="p-2.5 space-y-3">
          <div>
            <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">TO</span>
            <p className="font-extrabold text-[#111827] text-sm leading-tight mt-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mr-1">M/s.</span>
              {client.name}
            </p>
            <p className="text-slate-800 text-[11px] font-bold mt-1 leading-normal">{genset.siteName}</p>
            <p className="text-slate-700 text-[10px] leading-relaxed mt-0.5 whitespace-pre-wrap">{client.address}</p>
          </div>
          <div className="border-t border-slate-100 pt-2 select-all">
            <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">PARTY GST NUMBER</span>
            <strong className="text-black font-extrabold font-mono text-[11.5px]">{client.gstin || '33AAACL0582H1ZT'}</strong>
          </div>
        </div>

        <div className="p-2.5 space-y-3">
          <div>
            <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">Invoice Number</span>
            <strong className="text-black font-extrabold text-[14px] leading-tight block select-all">{log.billNo || 'Eng/26-27/0027'}</strong>
          </div>
          <div className="border-t border-slate-200 pt-2">
            <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Date of Issue</span>
            <strong className="text-black font-extrabold text-[12.5px] block">{invoiceData.billDateFormatted || '01.05.2026'}</strong>
          </div>
        </div>
      </div>

      {/* Items & details table matching grid */}
      <div className="border border-black overflow-hidden mb-4">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-black text-center text-[10px] font-extrabold uppercase bg-slate-50 tracking-wider h-8">
              <th className="py-1 px-2 border-r border-black w-14 col-span-1">Sl.No</th>
              <th className="py-1 px-2 border-r border-black text-left col-span-1">Description</th>
              <th className="py-1 px-2 border-r border-black w-24 col-span-1">Month</th>
              <th className="py-1 px-2 text-right w-28 col-span-1">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            <tr className="min-h-36">
              <td className="py-3 px-2 border-r border-black text-center font-bold text-slate-500">1</td>
              <td className="py-3 px-3 border-r border-black text-left space-y-3">
                <p className="font-bold text-slate-800 text-[12px]">
                  Reimbursement of cost of Diesel Provided for {genset.capacity} DG Set at <strong className="text-slate-900">{genset.siteName}</strong> @ {genset.dieselQuantityPerHour} Ltrs per Hour.
                </p>

                {/* Cost Calculations details sub-box */}
                <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50 space-y-2 mt-4 font-sans text-[11px] print:hidden">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">
                    Diesel Reimbursement Calculation Details
                  </span>
                  <div className="grid grid-cols-5 text-center text-[10px] font-bold text-slate-550 border-b border-slate-200 pb-1 uppercase font-semibold">
                    <div className="text-left">Qty / Hr (A)</div>
                    <div>Cost / Ltr (B)</div>
                    <div>Cost / Hr (C = A×B)</div>
                    <div>Run Hours (D)</div>
                    <div className="text-right">Total Cost (C×D)</div>
                  </div>
                  <div className="grid grid-cols-5 text-center text-[11px] font-semibold font-mono text-slate-700 pt-0.5">
                    <div className="text-left font-sans">{genset.dieselQuantityPerHour} Ltrs</div>
                    <div>₹{invoiceData.fuelPrice.toFixed(2)}</div>
                    <div className="font-bold">₹{invoiceData.costPerHour.toLocaleString('en-IN')}</div>
                    <div className="text-blue-700 font-sans font-extrabold">{invoiceData.durationHrsStr} Hrs ({invoiceData.totalHrsDec.toFixed(2)})</div>
                    <div className="text-right text-slate-900 font-extrabold font-sans">
                      ₹{invoiceData.subtotalCost.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Print view compact calculations details (Always visible on print to look clean) */}
                <div className="hidden print:block text-[10px] text-slate-750 font-sans italic pt-1 text-slate-600">
                  Calculation Details: {genset.dieselQuantityPerHour} Ltrs/Hr × ₹{invoiceData.fuelPrice.toFixed(2)}/Ltr (average price for {priceConfig.zoneName}) = ₹{invoiceData.costPerHour.toFixed(2)}/Hr × {invoiceData.durationHrsStr} Run Hours ({invoiceData.totalHrsDec.toFixed(2)} Hrs) = ₹{invoiceData.subtotalCost.toLocaleString('en-IN')}.
                </div>
              </td>
              <td className="py-3 px-2 border-r border-black text-center font-bold font-sans text-slate-600">
                {invoiceData.billingMonthLabel}
              </td>
              <td className="py-3 px-3 text-right font-bold text-slate-950 font-mono text-[13px] self-start items-start">
                ₹{invoiceData.subtotalCost.toLocaleString('en-IN')}.00
              </td>
            </tr>

            {/* Sub Total compilation right aligns */}
            <tr className="border-t border-black bg-slate-50/50">
              <td colSpan={2} className="py-1.5 px-3 uppercase tracking-wider font-extrabold text-right text-[10px]">
                Sub Total Reimbursement Cost
              </td>
              <td colSpan={2} className="py-1.5 px-3 border-l border-black text-right font-bold font-mono text-[13px]">
                ₹{invoiceData.subtotalCost.toLocaleString('en-IN')}.00
              </td>
            </tr>

            {/* GST breakups rows */}
            {genset.gstType === 'CGST_SGST' ? (
              <>
                <tr>
                  <td colSpan={2} className="py-1 px-3 text-right text-[10px] font-medium text-slate-600 uppercase">
                    SGST @ 9%
                  </td>
                  <td colSpan={2} className="py-1 px-3 border-l border-black text-right font-bold font-mono text-slate-600">
                    ₹{invoiceData.sgst.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-1 px-3 text-right text-[10px] font-medium text-slate-600 uppercase">
                    CGST @ 9%
                  </td>
                  <td colSpan={2} className="py-1 px-3 border-l border-black text-right font-bold font-mono text-slate-600">
                    ₹{invoiceData.cgst.toFixed(2)}
                  </td>
                </tr>
              </>
            ) : (
              <tr>
                <td colSpan={2} className="py-1.5 px-3 text-right text-[10px] font-medium text-slate-600 uppercase">
                  IGST @ 18%
                </td>
                <td colSpan={2} className="py-1.5 px-3 border-l border-black text-right font-bold font-mono text-slate-600">
                  ₹{invoiceData.igst.toFixed(2)}
                </td>
              </tr>
            )}

            {/* Rounded Off Row */}
            <tr>
              <td colSpan={2} className="py-1 px-3 text-right text-[10px] font-medium text-slate-400 uppercase">
                Rounded Off Adjustment
              </td>
              <td colSpan={2} className="py-1 px-3 border-l border-black text-right font-mono text-slate-400">
                ₹{invoiceData.roundedOff.toFixed(2)}
              </td>
            </tr>

            {/* GRAND TOTAL ROW */}
            <tr className="border-t-2 border-black bg-slate-100 font-extrabold">
              <td colSpan={2} className="py-2.5 px-3 text-right text-xs uppercase tracking-wider font-black">
                Grand Total
              </td>
              <td colSpan={2} className="py-2.5 px-3 border-l border-black text-right text-[15px] font-sans text-slate-950">
                {formatCurrency(invoiceData.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Amount in words */}
      <div className="p-2 border border-black mb-4 text-xs font-semibold leading-relaxed bg-slate-50/50">
        <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider mb-0.5">In Words.</span>
        <span className="text-black text-sm italic font-bold select-all">{invoiceData.totalInWords}</span>
      </div>

      {/* Bank particulars & Authorized Signature */}
      <div className="grid grid-cols-2 gap-4 border border-black divide-x divide-black text-xs">
        <div className="p-3 space-y-1.5 bg-slate-50/20">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-0.5 block">
            Settlement Bank Account Details
          </span>
          <div className="grid grid-cols-3 gap-0.5 mt-2 font-medium">
            <span className="text-slate-450 uppercase font-sans text-[9px] block">Bank Name:</span>
            <span className="col-span-2 font-bold text-slate-800">{db.company.bankDetails.bankName}</span>
            
            <span className="text-slate-450 uppercase font-sans text-[9px] block">Branch:</span>
            <span className="col-span-2 font-bold text-slate-800 leading-tight">{db.company.bankDetails.branch}</span>
            
            <span className="text-slate-450 uppercase font-sans text-[9px] block">A/C No.:</span>
            <strong className="col-span-2 font-mono text-black font-bold tracking-wide">{db.company.bankDetails.accountNumber}</strong>
            
            <span className="text-slate-450 uppercase font-sans text-[9px] block">IFSC Code:</span>
            <strong className="col-span-2 font-mono text-black select-all font-semibold">{db.company.bankDetails.ifscCode}</strong>
          </div>
        </div>

        <div className="p-3 text-center flex flex-col justify-between relative min-h-36">
          <div className="text-[10px] font-extrabold text-slate-700 tracking-wider font-sans">
            For {db.company.name || 'ENGINEERS ENTERPRISES'}
          </div>
          
          {/* Optional Signature seal overlay */}
          {includeSeal && db.company.signatureUrl ? (
            <div className="my-1.5 flex justify-center mix-blend-multiply">
              <img referrerPolicy="no-referrer" src={db.company.signatureUrl} alt="Authorized Sign" className="h-16 object-contain" />
            </div>
          ) : (
            <>
              {/* Box for on-screen guidance */}
              <div className="h-16 flex items-center justify-center p-2 border border-dashed border-slate-150 rounded bg-slate-50/50 m-2 text-[10px] text-slate-400 italic print:hidden">
                <span>[ Authorized Signature Box ]</span>
              </div>
              {/* Completely clean empty space for physical manual sign on print */}
              <div className="hidden print:block h-16"></div>
            </>
          )}

          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
            Authorized Person Signature
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-between text-[10px] font-bold text-slate-400">
        <span>E. & O.E.</span>
        <span>Subject to Madurai Jurisdiction</span>
      </div>
    </div>
  );
}

interface InvoicePrintProps {
  db: AppDatabase;
  gensetId: string;
  selectedMonth: string;
  onBack: () => void;
}

export default function InvoicePrint({ db, gensetId, selectedMonth, onBack }: InvoicePrintProps) {
  const [includeSeal, setIncludeSeal] = useState(true);
  const [useLetterhead, setUseLetterhead] = useState(true);

  // Parse list of gensets to print based on special props syntax
  const gensetsToPrint = useMemo(() => {
    if (gensetId === 'all') {
      return db.gensets;
    }
    if (gensetId.startsWith('client-')) {
      const clientId = gensetId.replace('client-', '');
      return db.gensets.filter(g => g.clientId === clientId);
    }
    const single = db.gensets.find(g => g.id === gensetId);
    return single ? [single] : [];
  }, [db.gensets, gensetId]);

  const printableTitle = useMemo(() => {
    if (gensetId === 'all') {
      return `All Active Locations Invoices (${gensetsToPrint.length})`;
    }
    if (gensetId.startsWith('client-')) {
      const clientId = gensetId.replace('client-', '');
      const client = db.clients.find(c => c.id === clientId);
      const cName = client ? `${client.name} - ${client.zone}` : 'Group';
      return `All Invoices for ${cName} (${gensetsToPrint.length})`;
    }
    if (gensetsToPrint.length > 0) {
      return `${gensetsToPrint[0].siteName} Invoice`;
    }
    return 'Invoices List';
  }, [gensetId, gensetsToPrint, db.clients]);

  if (gensetsToPrint.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border text-center">
        <p className="text-rose-500 font-bold">No matching generator sites found.</p>
        <button onClick={onBack} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer">Go Back</button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      
      {/* Configuration bar (HIDDEN ON PRINT MODE natively via CSS) */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 rounded border border-slate-200 text-slate-600 transition shrink-0 cursor-pointer"
            title="Return to list"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Print & Review Area</h2>
            <p className="text-[11px] text-slate-500 leading-tight">{printableTitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Toggles */}
          <div className="flex items-center gap-4 text-[11px] text-slate-600 font-bold border-r border-slate-150 pr-4">
            <button
              onClick={() => setUseLetterhead(!useLetterhead)}
              className="flex items-center gap-1.5 focus:outline-none cursor-pointer"
            >
              {useLetterhead ? <ToggleRight className="h-5 w-5 text-blue-600" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
              Letterhead
            </button>

            <button
              onClick={() => setIncludeSeal(!includeSeal)}
              className="flex items-center gap-1.5 focus:outline-none cursor-pointer"
            >
              {includeSeal ? <ToggleRight className="h-5 w-5 text-blue-600" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
              Seal & Signature
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-1.5 rounded flex items-center gap-1.5 transition shadow-xs w-full sm:w-auto justify-center cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print All {gensetsToPrint.length > 1 ? `(${gensetsToPrint.length} Bills)` : ''} / Save PDF
          </button>
        </div>
      </div>

      {/* Actual A4 Bills layout blocks, optimized for full A4 print with CSS */}
      <div className="flex flex-col items-center gap-8 bg-slate-150 p-2 sm:p-4 rounded-xl print:bg-white print:p-0">
        
        {gensetsToPrint.map((g) => (
          <InvoicePage 
            key={g.id}
            db={db}
            gensetId={g.id}
            selectedMonth={selectedMonth}
            useLetterhead={useLetterhead}
            includeSeal={includeSeal}
            isMultiPrint={gensetsToPrint.length > 1}
          />
        ))}

      </div>

    </div>
  );
}
