/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { AppDatabase, SiteLog, LogEntry, Genset } from '../types';
import { 
  parseMeterToMinutes, 
  formatMinutesToTime, 
  formatMinutesToDecimal, 
  calculateDurationMinutes 
} from '../utils/time';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Save, 
  AlertCircle, 
  CheckCircle, 
  Sparkles,
  ChevronRight,
  TrendingUp,
  Activity,
  Calculator,
  Eye,
  PenTool,
  Lock,
  Unlock,
  Check,
  Building,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';

interface LogBookProps {
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
  selectedMonth: string;
}

export default function LogBook({ db, onUpdateDb, selectedMonth }: LogBookProps) {
  // Main modes: 'entry' (for Data Entry) or 'view' (for viewing logs)
  const [currentMode, setCurrentMode] = useState<'entry' | 'view'>('entry');

  // Unified selections for guided workflow
  const [selectedDo, setSelectedDo] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(selectedMonth);
  const [selectedGensetId, setSelectedGensetId] = useState<string>('');

  // Auto-fill states for timings entering
  const [newStart, setNewStart] = useState<string>('00:00');
  const [newEnd, setNewEnd] = useState<string>('00:00');
  
  // Date selection state restricted to months
  const [newEntryDate, setNewEntryDate] = useState<string>(() => {
    return `${selectedMonthKey}-01`;
  });

  // Meter Format Converter widget helper state
  const [convertInput, setConvertInput] = useState('');
  const [convertedOutput, setConvertedOutput] = useState({ time: '00:00', decimal: '0.0' });

  // 1. Compute list of unique DO (zones) from all client records
  const dosList = useMemo(() => {
    const zones = new Set(db.clients.map(c => c.zone).filter(Boolean));
    return Array.from(zones);
  }, [db.clients]);

  // Sync default guided selections
  useEffect(() => {
    if (dosList.length > 0 && !selectedDo) {
      setSelectedDo(dosList[0]);
    }
  }, [dosList, selectedDo]);

  useEffect(() => {
    if (selectedDo) {
      const filteredClients = db.clients.filter(c => c.zone === selectedDo);
      if (filteredClients.length > 0) {
        if (!filteredClients.some(c => c.id === selectedClientId)) {
          setSelectedClientId(filteredClients[0].id);
        }
      } else {
        setSelectedClientId('');
      }
    }
  }, [selectedDo, db.clients, selectedClientId]);

  useEffect(() => {
    if (selectedClientId) {
      const filteredGensets = db.gensets.filter(g => g.clientId === selectedClientId);
      if (filteredGensets.length > 0) {
        if (!filteredGensets.some(g => g.id === selectedGensetId)) {
          setSelectedGensetId(filteredGensets[0].id);
        }
      } else {
        setSelectedGensetId('');
      }
    }
  }, [selectedClientId, db.gensets, selectedGensetId]);

  // Handle parent month selection synchronization
  useEffect(() => {
    setSelectedMonthKey(selectedMonth);
    setNewEntryDate(`${selectedMonth}-01`);
  }, [selectedMonth]);

  // Sync date when month key is selected locally
  useEffect(() => {
    setNewEntryDate(`${selectedMonthKey}-01`);
  }, [selectedMonthKey]);

  // Helper function to fetch the previous month's string key
  const getPreviousMonthKey = (monthKey: string): string => {
    if (!monthKey) return '';
    const [yearStr, monthStr] = monthKey.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);
    month = month - 1;
    if (month === 0) {
      month = 12;
      year = year - 1;
    }
    return `${year}-${month.toString().padStart(2, '0')}`;
  };

  // Helper routine to look up the closing meter reading of the previous month
  const getAutoStartMeter = (gensetId: string, monthKey: string): { value: string; isFromPrevious: boolean; prevMonth: string } => {
    // First, check if there is an actual saved log in key database
    const savedLog = db.siteLogs.find(l => l.gensetId === gensetId && l.monthKey === monthKey);
    if (savedLog && savedLog.startMeter && savedLog.startMeter !== '0.0') {
      return { value: savedLog.startMeter, isFromPrevious: false, prevMonth: '' };
    }
    
    // Check previous month's closing reading
    const prevMonth = getPreviousMonthKey(monthKey);
    const prevLog = db.siteLogs.find(l => l.gensetId === gensetId && l.monthKey === prevMonth);
    if (prevLog && prevLog.endMeter && prevLog.endMeter !== '0.0') {
      return { value: prevLog.endMeter, isFromPrevious: true, prevMonth };
    }
    return { value: '0.0', isFromPrevious: false, prevMonth: '' };
  };

  // 12-month sequence centering selected month
  const availableMonthsList = useMemo(() => {
    const list = [];
    const [yearStr, monthStr] = selectedMonth.split('-');
    const middleYear = parseInt(yearStr, 10);
    const middleMonth = parseInt(monthStr, 10);
    
    // 8 months back, 4 months forward
    for (let i = -8; i <= 4; i++) {
      const d = new Date(middleYear, middleMonth - 1 + i, 1);
      const yStr = d.getFullYear();
      const mStr = (d.getMonth() + 1).toString().padStart(2, '0');
      const key = `${yStr}-${mStr}`;
      list.push({
        key,
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      });
    }
    return list;
  }, [selectedMonth]);

  // Retrive the active log record
  const currentSiteLog = useMemo(() => {
    if (!selectedGensetId || !selectedMonthKey) return null;
    
    let log = db.siteLogs.find(l => l.gensetId === selectedGensetId && l.monthKey === selectedMonthKey);
    if (!log) {
      const autoStart = getAutoStartMeter(selectedGensetId, selectedMonthKey);
      log = {
        id: `temp-${selectedGensetId}-${selectedMonthKey}`,
        gensetId: selectedGensetId,
        monthKey: selectedMonthKey,
        startMeter: autoStart.value,
        endMeter: autoStart.value, // initialize to same
        entries: [],
        isSubmitted: false
      };
    }
    return log;
  }, [db.siteLogs, selectedGensetId, selectedMonthKey]);

  // Compute stats on last month info
  const lastMonthInfo = useMemo(() => {
    if (!selectedGensetId || !selectedMonthKey) return { hasPrev: false, prevMonth: '', endMeter: '0.0' };
    const prevMonth = getPreviousMonthKey(selectedMonthKey);
    const prevLog = db.siteLogs.find(l => l.gensetId === selectedGensetId && l.monthKey === prevMonth);
    
    if (prevLog && prevLog.endMeter && prevLog.endMeter !== '0.0') {
      return {
        hasPrev: true,
        prevMonth,
        endMeter: prevLog.endMeter
      };
    }
    return { hasPrev: false, prevMonth: '', endMeter: '0.0' };
  }, [db.siteLogs, selectedGensetId, selectedMonthKey]);

  // Info details of active components
  const activeGenset = useMemo(() => {
    return db.gensets.find(g => g.id === selectedGensetId);
  }, [db.gensets, selectedGensetId]);

  const activeClient = useMemo(() => {
    return db.clients.find(c => c.id === selectedClientId);
  }, [db.clients, selectedClientId]);

  // Handle saving the log safely
  const saveLogRecord = (updatedLog: SiteLog) => {
    onUpdateDb(prev => {
      const idx = prev.siteLogs.findIndex(
        l => l.gensetId === selectedGensetId && l.monthKey === selectedMonthKey
      );
      let newLogs = [...prev.siteLogs];
      
      const finalizedPayload = {
        ...updatedLog,
        id: idx >= 0 ? prev.siteLogs[idx].id : `log-${selectedGensetId}-${selectedMonthKey}`,
        gensetId: selectedGensetId,
        monthKey: selectedMonthKey
      };

      if (idx >= 0) {
        newLogs[idx] = finalizedPayload;
      } else {
        newLogs.push(finalizedPayload);
      }
      return { ...prev, siteLogs: newLogs };
    });
  };

  // Convert input utility
  const handleConvertInput = (val: string) => {
    setConvertInput(val);
    const mins = parseMeterToMinutes(val);
    setConvertedOutput({
      time: formatMinutesToTime(mins),
      decimal: formatMinutesToDecimal(mins, 2)
    });
  };

  // Safe manual meter fields update
  const handleMeterFieldChange = (field: 'start' | 'end', val: string) => {
    if (!currentSiteLog) return;
    const updated = {
      ...currentSiteLog,
      startMeter: field === 'start' ? val : currentSiteLog.startMeter,
      endMeter: field === 'end' ? val : currentSiteLog.endMeter
    };
    saveLogRecord(updated);
  };

  // Appending timing entry row
  const handleAppendClockRow = () => {
    if (!currentSiteLog || !newStart || !newEnd || !newEntryDate) return;
    
    const durationMins = calculateDurationMinutes(newStart, newEnd);
    const newEntry: LogEntry = {
      id: `entry-${Date.now()}`,
      date: newEntryDate,
      startTime: newStart,
      endTime: newEnd,
      durationMinutes: durationMins
    };

    const updated = {
      ...currentSiteLog,
      entries: [...(currentSiteLog.entries || []), newEntry]
    };

    saveLogRecord(updated);

    // Reset timings for fast sequential logging
    setNewStart('00:00');
    setNewEnd('00:00');
  };

  // Remove timing entry
  const handleRemoveClockRow = (entryId: string) => {
    if (!currentSiteLog) return;
    const updated = {
      ...currentSiteLog,
      entries: (currentSiteLog.entries || []).filter(e => e.id !== entryId)
    };
    saveLogRecord(updated);
  };

  // Final submit state toggling
  const handleToggleSubmitState = (submitState: boolean) => {
    if (!currentSiteLog) return;
    const updated = {
      ...currentSiteLog,
      isSubmitted: submitState
    };
    saveLogRecord(updated);
  };

  // Aggregate duration totals helper
  const grandTotalMins = useMemo(() => {
    if (!currentSiteLog || !currentSiteLog.entries) return 0;
    return currentSiteLog.entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  }, [currentSiteLog]);

  // Compute difference based on start meter / end meter
  const meterDifferenceMins = useMemo(() => {
    if (!currentSiteLog) return 0;
    const startM = parseMeterToMinutes(currentSiteLog.startMeter);
    const endM = parseMeterToMinutes(currentSiteLog.endMeter);
    return Math.max(0, endM - startM);
  }, [currentSiteLog]);

  const doesTallySynchronize = Math.abs(grandTotalMins - meterDifferenceMins) < 1.0;

  // Formatting output string for display
  const formatMonthKeyLabel = (mKey: string) => {
    const [year, month] = mKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-4 font-sans" id="guided-logbook-container">
      
      {/* 1. Mode Bar: Segmented Switch for 'Entry' and 'View' */}
      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5 text-blue-400">
            <FileSpreadsheet className="h-4 w-4" />
            Log Book Register System
          </h2>
          <p className="text-[10px] text-slate-400">
            Record client periods or compile audits across Divisional Offices (DOs).
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 gap-1 text-xs">
          <button
            onClick={() => setCurrentMode('entry')}
            className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              currentMode === 'entry' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
            Entry (Write Mode)
          </button>
          
          <button
            onClick={() => setCurrentMode('view')}
            className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              currentMode === 'view' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            View (Inspect Mode)
          </button>
        </div>
      </div>

      {/* 2. Unified Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Left Side: Guided workflow controllers */}
        <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Building className="h-4 w-4 text-blue-600" />
              Guided Selector
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Filter location chronologically.</p>
          </div>

          {/* D.O Step selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span>1.</span> Select DO (Division Office)
            </label>
            <select
              value={selectedDo}
              onChange={(e) => setSelectedDo(e.target.value)}
              className="w-full text-xs font-bold rounded-lg border border-slate-200 p-2 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {dosList.length === 0 ? (
                <option value="">No DO Available</option>
              ) : (
                dosList.map(doName => (
                  <option key={doName} value={doName}>{doName}</option>
                ))
              )}
            </select>
          </div>

          {/* Client Step selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span>2.</span> Select Client Particulars
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full text-xs font-bold rounded-lg border border-slate-200 p-2 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              disabled={!selectedDo}
            >
              {db.clients.filter(c => c.zone === selectedDo).length === 0 ? (
                <option value="">No Clients Listed</option>
              ) : (
                db.clients
                  .filter(c => c.zone === selectedDo)
                  .map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))
              )}
            </select>
          </div>

          {/* Month selective Step */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span>3.</span> Select Month Period
            </label>
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="w-full text-xs font-bold rounded-lg border border-slate-200 p-2 bg-slate-50 text-slate-850 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {availableMonthsList.map(item => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </div>

          {/* Site selective Step */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span>4.</span> Select Generator Site
            </label>
            <select
              value={selectedGensetId}
              onChange={(e) => setSelectedGensetId(e.target.value)}
              className="w-full text-xs font-black rounded-lg border border-blue-200 p-2 bg-blue-50/40 text-blue-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              disabled={!selectedClientId}
            >
              {db.gensets.filter(g => g.clientId === selectedClientId).length === 0 ? (
                <option value="">No active sites listed</option>
              ) : (
                db.gensets
                  .filter(g => g.clientId === selectedClientId)
                  .map(g => (
                    <option key={g.id} value={g.id}>
                      {g.siteName} ({g.capacity})
                    </option>
                  ))
              )}
            </select>
          </div>

          {/* Handy Format Converter */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <h4 className="text-[10px] font-extrabold text-slate-650 uppercase flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Easy Conversion Converter
            </h4>
            <p className="text-[9px] text-slate-400 leading-normal">
              Convert decimals to standard hours structure easily (e.g., enter 10.5 for 10:30 Hrs).
            </p>
            <input
              type="text"
              placeholder="e.g. 19.5 or 124:30"
              value={convertInput}
              onChange={(e) => handleConvertInput(e.target.value)}
              className="w-full text-xs rounded border border-slate-200 p-1.5 focus:outline-none"
            />
            {convertInput && (
              <div className="grid grid-cols-2 gap-2 bg-amber-50/50 p-2 rounded border border-amber-100 text-[10px] font-mono text-slate-700">
                <div>
                  <span className="block text-[8px] uppercase text-slate-400">As Time</span>
                  <strong>{convertedOutput.time} Hrs</strong>
                </div>
                <div>
                  <span className="block text-[8px] uppercase text-slate-400">As Decimal</span>
                  <strong>{convertedOutput.decimal} Hrs</strong>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Tabular displays & functional triggers */}
        <div className="lg:col-span-3 space-y-4">
          
          {selectedGensetId && currentSiteLog && activeGenset ? (
            
            currentMode === 'entry' ? (
              
              /* =========================================
                 DATA ENTRY VIEW 
                 ========================================= */
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
                
                {/* Header Information strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-150 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-2 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase rounded-md">
                        Data Entry Mode
                      </span>
                      <h2 className="text-base font-black text-slate-800">{activeGenset.siteName} SITE</h2>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Division: <strong className="text-slate-700">{selectedDo}</strong> | 
                      Billing Cycle: <strong className="text-slate-700">{formatMonthKeyLabel(selectedMonthKey)}</strong>
                    </p>
                  </div>

                  {/* Submission locks check banner */}
                  {currentSiteLog.isSubmitted ? (
                    <div className="bg-red-50 text-red-800 text-xs font-bold p-2 px-3 rounded-lg border border-red-100 flex items-center gap-2">
                      <Lock className="h-4 w-4 shrink-0" />
                      <div>
                        <span className="block uppercase text-[10px]">Logged & Locked</span>
                        <span className="text-[9px] text-red-500 font-normal">Unlock down below to edit details</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 text-emerald-800 text-xs font-bold p-2 px-3 rounded-lg border border-emerald-100 flex items-center gap-2">
                      <Unlock className="h-4 w-4 shrink-0" />
                      <div>
                        <span className="block uppercase text-[10px]">Active Draft status</span>
                        <span className="text-[9px] text-emerald-600 font-normal">Safe to add timing values</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Automation Info Notification for start reading tracking */}
                {lastMonthInfo.hasPrev && (
                  <div className="bg-blue-50/80 rounded-xl border border-blue-100 p-2.5 px-3 flex items-start gap-2 text-xs">
                    <Sparkles className="h-4 w-4 text-blue-650 shrink-0 mt-0.5" />
                    <div className="text-blue-800 text-[11px] leading-relaxed">
                      <strong>💡 Smart Auto-Fill Enabled:</strong> Standard start meter reading is loaded directly from the closing reading of the last month (<strong>{lastMonthInfo.endMeter} Hours</strong> recorded during <strong>{formatMonthKeyLabel(lastMonthInfo.prevMonth)}</strong>).
                    </div>
                  </div>
                )}

                {/* Meter readings inputs */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Starting Meter Reading (Hrs)
                      </label>
                      {lastMonthInfo.hasPrev && (
                        <span className="text-[9.5px] font-black text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 shrink-0 uppercase tracking-wide">
                          Prev Clos: {lastMonthInfo.endMeter} Hrs
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={currentSiteLog.startMeter}
                      onChange={(e) => handleMeterFieldChange('start', e.target.value)}
                      disabled={!!currentSiteLog.isSubmitted}
                      className="w-full text-xs font-bold p-2 rounded border border-slate-200 bg-white font-mono focus:outline-none"
                      placeholder="e.g. 197.30"
                    />
                    <p className="text-[9px] text-slate-400">Loads from previous closing value.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Closing Meter Reading (Hrs)
                    </label>
                    <input
                      type="text"
                      value={currentSiteLog.endMeter}
                      onChange={(e) => handleMeterFieldChange('end', e.target.value)}
                      disabled={!!currentSiteLog.isSubmitted}
                      className="w-full text-xs font-bold p-2 rounded border border-slate-200 bg-white font-mono focus:outline-none"
                      placeholder="e.g. 205.10"
                    />
                    <p className="text-[9px] text-slate-400">Enter final month physical reading.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Calculated Difference
                    </label>
                    <div className="p-2 border border-slate-200 rounded text-xs font-bold font-mono bg-white flex justify-between items-center text-slate-800 h-9">
                      <span>{formatMinutesToTime(meterDifferenceMins)} Hrs</span>
                      <span className="text-slate-400 text-[10px]">({formatMinutesToDecimal(meterDifferenceMins, 2)} decimals)</span>
                    </div>
                    <p className="text-[9px] text-slate-400">Derived from physical meter check.</p>
                  </div>
                </div>

                {/* Clock timing records section */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-blue-600" />
                      Generator Clock Timings List
                    </h3>
                    <div className="text-left sm:text-right flex flex-col sm:items-end gap-0.5 text-xs font-medium text-slate-500">
                      <div>Clock Log: <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">{formatMinutesToTime(grandTotalMins)} Hrs</span></div>
                      <div className="mt-1">Meter Run: <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">{formatMinutesToTime(meterDifferenceMins)} Hrs</span></div>
                      <div className="mt-1 font-semibold">
                        Difference: {' '}
                        {meterDifferenceMins - grandTotalMins === 0 ? (
                          <span className="text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded font-mono font-bold">0 Hrs (Perfect Match)</span>
                        ) : meterDifferenceMins - grandTotalMins > 0 ? (
                          <span className="text-rose-750 bg-rose-50 px-1.5 py-0.5 rounded font-mono font-bold">+{formatMinutesToTime(meterDifferenceMins - grandTotalMins)} Hrs remaining</span>
                        ) : (
                          <span className="text-amber-705 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-bold">-{formatMinutesToTime(grandTotalMins - meterDifferenceMins)} Hrs over-logged</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Log entries table */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 text-[10px] font-extrabold uppercase tracking-wide">
                          <th className="py-2.5 px-3 text-center w-12">SL</th>
                          <th className="py-2.5 px-3">Run Date</th>
                          <th className="py-2.5 px-3">Start Clock</th>
                          <th className="py-2.5 px-3">End Clock</th>
                          <th className="py-2.5 px-3 text-right">Run Duration</th>
                          <th className="py-2.5 px-3 text-center w-16">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-mono text-slate-700">
                        {(!currentSiteLog.entries || currentSiteLog.entries.length === 0) ? (
                          <tr>
                            <td colSpan={6} className="py-8 font-sans text-center text-slate-450 italic bg-white leading-normal">
                              No clock entries added yet. Use the quick-add form below to record generator running logs.
                            </td>
                          </tr>
                        ) : (
                          currentSiteLog.entries.map((entry, index) => {
                            const entryLabelDate = entry.date ? new Date(entry.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
                            return (
                              <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                                <td className="py-2.5 px-3 text-center font-sans text-slate-400 font-bold">{index + 1}</td>
                                <td className="py-2.5 px-3 text-slate-705 font-medium font-sans">{entryLabelDate}</td>
                                <td className="py-2.5 px-3 font-semibold">{entry.startTime} Hrs</td>
                                <td className="py-2.5 px-3 font-semibold">{entry.endTime} Hrs</td>
                                <td className="py-2.5 px-3 text-right font-extrabold text-blue-750">
                                  {formatMinutesToTime(entry.durationMinutes)} Hrs
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    onClick={() => handleRemoveClockRow(entry.id)}
                                    disabled={!!currentSiteLog.isSubmitted}
                                    className="text-slate-400 hover:text-red-650 p-1 transition rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <Trash2 className="h-4 w-4 mx-auto" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}

                        {currentSiteLog.entries && currentSiteLog.entries.length > 0 && (
                          <tr className="bg-slate-50 font-sans font-extrabold text-slate-800 border-t border-slate-200">
                            <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-xs tracking-wider">
                              Grand Total Log Hours:
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-blue-700 text-sm font-black">
                              {formatMinutesToTime(grandTotalMins)} Hrs
                            </td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add timing form block */}
                  {!currentSiteLog.isSubmitted ? (
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5 mt-2">
                      <h4 className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest pl-1">
                        Add Generator Clock Timing Record
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                            Running Date
                          </label>
                          <input
                            type="date"
                            value={newEntryDate}
                            min={`${selectedMonthKey}-01`}
                            max={`${selectedMonthKey}-31`}
                            onChange={(e) => setNewEntryDate(e.target.value)}
                            className="w-full text-xs font-semibold p-1.5 rounded border border-slate-200 bg-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                            Start Clock (Time)
                          </label>
                          <input
                            type="time"
                            value={newStart}
                            onChange={(e) => setNewStart(e.target.value)}
                            className="w-full text-xs font-semibold p-1.5 rounded border border-slate-200 bg-white font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                            End Clock (Time)
                          </label>
                          <input
                            type="time"
                            value={newEnd}
                            onChange={(e) => setNewEnd(e.target.value)}
                            className="w-full text-xs font-semibold p-1.5 rounded border border-slate-200 bg-white font-mono"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleAppendClockRow}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3.5 rounded-lg flex items-center justify-center gap-1 transition-all h-8.5 w-full cursor-pointer uppercase tracking-wider text-center"
                        >
                          <Plus className="h-4 w-4" />
                          Append Log Row
                        </button>

                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center text-xs text-red-800 leading-normal font-sans">
                      ⚠️ Data Entry is locked because this site log sheet has been **submitted**. Please retract submission to adjust or add new logs.
                    </div>
                  )}
                </div>

                {/* Audit & Submit options zone as explicitly requested */}
                <div className="border-t border-slate-150 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded ${doesTallySynchronize ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} text-[10px] font-bold uppercase`}>
                      {doesTallySynchronize ? '● Fully Tallied' : '● Unbalanced'}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium leading-tight">
                      {doesTallySynchronize 
                        ? 'Clock matches physical start/end differences' 
                        : 'Discrepancy detected between clock registers and physical meter meters'
                      }
                    </span>
                  </div>

                  {currentSiteLog.isSubmitted ? (
                    <button
                      type="button"
                      onClick={() => handleToggleSubmitState(false)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs p-2 px-4 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Unlock className="h-4 w-4" />
                      Retract & Re-open Entry Mode
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleSubmitState(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs p-2 px-5 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer uppercase tracking-wider"
                    >
                      <Check className="h-4.5 w-4.5" />
                      Submit & Lock Log Sheet
                    </button>
                  )}

                </div>

              </div>
            ) : (
              
              /* =========================================
                 METER & CLOCK VIEWER MODE 
                 ========================================= */
              <div className="bg-white p-5 rounded-xl border border-slate-150 shadow-sm space-y-4">
                
                {/* View Details Header strip */}
                <div className="border-b border-slate-150 pb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="p-1 px-2.5 bg-indigo-100 text-indigo-900 text-[10px] font-bold rounded uppercase">
                      Inspect & View Mode
                    </span>
                    <h2 className="text-base font-extrabold text-slate-900 mt-1 block">{activeGenset.siteName} (Period Register)</h2>
                    <p className="text-xs text-slate-450">
                      DO Zone: <strong>{selectedDo}</strong> | Billing cycle: <strong className="text-slate-650">{formatMonthKeyLabel(selectedMonthKey)}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Log State</span>
                    {currentSiteLog.isSubmitted ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded uppercase block mt-0.5">
                        ● Submitted 🔒
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-extrabold text-[10px] rounded uppercase block mt-0.5">
                        ● Draft (Not Submitted)
                      </span>
                    )}
                  </div>
                </div>

                {/* Audit & statistics card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-150">
                    <span className="text-[9px] uppercase text-slate-400 block font-bold leading-none">Starting Reading</span>
                    <span className="block mt-1.5 text-slate-800 font-mono text-sm font-bold">{currentSiteLog.startMeter} Hours</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-150">
                    <span className="text-[9px] uppercase text-slate-400 block font-bold leading-none">Closing Reading</span>
                    <span className="block mt-1.5 text-slate-800 font-mono text-sm font-bold">{currentSiteLog.endMeter} Hours</span>
                  </div>
                  <div className="p-3 bg-blue-10/20 rounded-lg border border-blue-100">
                    <span className="text-[9px] uppercase text-blue-600 block font-bold leading-none">Overall Run Hours</span>
                    <span className="block mt-1.5 text-blue-900 font-mono text-sm font-black">{formatMinutesToTime(grandTotalMins)} Hours</span>
                  </div>
                </div>

                {/* Log Entry Timing sheets table */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest block py-1.5">
                    Chronological Clock timings log sheet
                  </h4>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-450 text-[10px] font-bold uppercase tracking-wide">
                          <th className="py-2 px-3 text-center w-12">No</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-1.5 px-3">Start clock</th>
                          <th className="py-1.5 px-3">End clock</th>
                          <th className="py-1.5 px-3 text-right">Computed Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-700 bg-white">
                        {(!currentSiteLog.entries || currentSiteLog.entries.length === 0) ? (
                          <tr>
                            <td colSpan={5} className="py-6 italic text-center text-slate-400 bg-slate-50/20 font-sans">
                              No log timings entered for selected billing cycle period.
                            </td>
                          </tr>
                        ) : (
                          currentSiteLog.entries.map((entry, idx) => {
                            const entryLabelDate = entry.date ? new Date(entry.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
                            return (
                              <tr key={entry.id} className="hover:bg-slate-50/40">
                                <td className="py-2 px-3 text-center text-slate-400 font-sans">{idx + 1}</td>
                                <td className="py-2 px-3 font-sans text-slate-700 font-medium">{entryLabelDate}</td>
                                <td className="py-2 px-3 text-slate-650">{entry.startTime} Hrs</td>
                                <td className="py-2 px-3 text-slate-650">{entry.endTime} Hrs</td>
                                <td className="py-2 px-3 text-right font-bold text-blue-600">
                                  {formatMinutesToTime(entry.durationMinutes)} Hrs
                                </td>
                              </tr>
                            );
                          })
                        )}

                        {currentSiteLog.entries && currentSiteLog.entries.length > 0 && (
                          <tr className="bg-slate-50/70 text-slate-800 font-sans font-black border-t border-slate-200">
                            <td colSpan={4} className="py-3 px-3 text-right uppercase text-[10px] tracking-wide">
                              Grand Cumulative Run Duration:
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-lg text-blue-700">
                              {formatMinutesToTime(grandTotalMins)} Hrs
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit verification report stamp */}
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-150 flex items-start gap-2 text-xs">
                  <CheckCircle className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${doesTallySynchronize ? 'text-emerald-600' : 'text-amber-500 animate-pulse'}`} />
                  <div>
                    <strong className="block uppercase text-[10px] text-slate-700 tracking-wide">
                      Verification Summary Checklist
                    </strong>
                    <div className="text-[11px] text-slate-500 mt-1 leading-normal font-sans">
                      Comparing the total written clock sheet times (<strong>{formatMinutesToTime(grandTotalMins)} Hrs</strong>) with the physically reported generator meter readings difference (<strong>{formatMinutesToTime(meterDifferenceMins)} Hrs</strong>) calculated based on start rate {currentSiteLog.startMeter} and closing rate {currentSiteLog.endMeter} hours.
                    </div>
                  </div>
                </div>

              </div>
            )

          ) : (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs animate-pulse">
              <Activity className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 font-bold text-xs uppercase tracking-wide">
                Select Particulars in the guided workflow panel
              </p>
              <p className="text-slate-400 text-[10px] mt-1">
                Choose the DO zone first and choose clients and corresponding generators to display records.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
