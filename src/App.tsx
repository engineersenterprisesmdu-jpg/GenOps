/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppDatabase } from './types';
import { INITIAL_DATABASE } from './utils/seedData';
import Dashboard from './components/Dashboard';
import MasterConfig from './components/MasterConfig';
import LogBook from './components/LogBook';
import BillingSheet from './components/BillingSheet';
import Reports from './components/Reports';
import InvoicePrint from './components/InvoicePrint';
import BackupHub from './components/BackupHub';
import PaymentReceipts from './components/PaymentReceipts';
import { auth, db as firestoreDb } from './firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';

import { 
  LayoutDashboard, 
  BookOpen, 
  Calculator, 
  Settings, 
  Database, 
  Menu, 
  X, 
  Fuel,
  Info,
  Calendar,
  Layers,
  FileText,
  Receipt,
  LogIn,
  LogOut,
  Cloud,
  AlertTriangle
} from 'lucide-react';

const STORAGE_KEY = 'engineers_diesel_billing_db_v2';

export default function App() {
  const [db, setDb] = useState<AppDatabase>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.company && Array.isArray(parsed.clients)) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse cached database, seating fallback initial data.', e);
      }
    }
    return INITIAL_DATABASE;
  });

  // Keep track of active workspace tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Detemine if app is running inside a secure iframe preview that restricts popups
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  
  // Track active month-year key: YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-04'); // default seed month

  // Track deep linked genset ID from Dashboard for entry coordination
  const [activeGensetId, setActiveGensetId] = useState<string>('');

  const handleEnterLogs = (gensetId: string, monthKey: string) => {
    setSelectedMonth(monthKey);
    setActiveGensetId(gensetId);
    handleNavigate('logs');
  };

  // For print view: when invoiceGensetId is set, show printable invoice screen
  const [invoiceGensetId, setInvoiceGensetId] = useState<string | null>(null);

  // Mobile menu visibility
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<{ code?: string; message?: string } | null>(null);

  // User sign-in warning alert banner block for first-time / guest users to protect their data
  const [dismissLoginWarning, setDismissLoginWarning] = useState(() => {
    return localStorage.getItem('dismiss_google_login_warning') === 'true';
  });

  // Firestore Database Real-time Synchronisation States
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'disconnected'>('disconnected');
  const [syncErrorReason, setSyncErrorReason] = useState<{ code?: string; message?: string } | null>(null);
  const [showSyncErrorDiagnosis, setShowSyncErrorDiagnosis] = useState(false);

  // Ref to hold the remote string representation of the database to block cyclic writes
  const remoteDbStringRef = useRef<string>('');

  // Ref to track if we have successfully loaded or initialized the cloud state first
  const isCloudLoadedRef = useRef<boolean>(false);

  // Ref to keep the latest db state accessible in callbacks without stale closures
  const dbRef = useRef(db);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  // Set up auth state observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (!user) {
        setSyncStatus('disconnected');
        setSyncErrorReason(null);
        isCloudLoadedRef.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen for realtime cloud updates when logged in
  useEffect(() => {
    if (!currentUser) {
      remoteDbStringRef.current = '';
      setSyncStatus('disconnected');
      isCloudLoadedRef.current = false;
      return;
    }

    setSyncStatus('syncing');
    const docRef = doc(firestoreDb, 'backups', 'active');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        if (remoteData?.database) {
          const remoteDbString = JSON.stringify(remoteData.database);
          setDb(currentLocalDb => {
            const localDbString = JSON.stringify(currentLocalDb);
            if (remoteDbString !== localDbString) {
              console.log('Firebase Realtime Sync: aligned local state with Cloud Firestore!');
              remoteDbStringRef.current = remoteDbString;
              return remoteData.database;
            }
            return currentLocalDb;
          });
        }
        setSyncStatus('synced');
        setSyncErrorReason(null);
        isCloudLoadedRef.current = true;
      } else {
        // First-time sync: if Firestore lacks a backup, save the current local database state to initialize it
        const currentDb = dbRef.current;
        const dbString = JSON.stringify(currentDb);
        remoteDbStringRef.current = dbString;
        
        setSyncStatus('syncing');
        setDoc(docRef, {
          userId: currentUser.uid,
          updatedAt: serverTimestamp(),
          database: currentDb
        }).then(() => {
          setSyncStatus('synced');
          setSyncErrorReason(null);
          isCloudLoadedRef.current = true;
        }).catch(err => {
          console.error('Failed to initialize empty Firebase database:', err);
          setSyncStatus('error');
          setSyncErrorReason({
            code: err?.code || 'unknown',
            message: err?.message || String(err)
          });
        });
      }
    }, (err) => {
      console.warn('Firebase realtime subscription sync error (offline or permissions):', err);
      setSyncStatus('error');
      setSyncErrorReason({
        code: err?.code || 'permission-denied',
        message: err?.message || String(err)
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Sync to localstorage and write to Firebase in real-time on local change
  useEffect(() => {
    const dbString = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, dbString);

    if (currentUser && isCloudLoadedRef.current) {
      // Only write to Firestore if the current state is different from the last remote version we tracked
      if (dbString !== remoteDbStringRef.current) {
        setSyncStatus('syncing');
        remoteDbStringRef.current = dbString;
        const docRef = doc(firestoreDb, 'backups', 'active');
        setDoc(docRef, {
          userId: currentUser.uid,
          updatedAt: serverTimestamp(),
          database: db
        }).then(() => {
          setSyncStatus('synced');
          setSyncErrorReason(null);
        }).catch(err => {
          console.error('Failed to sync state to Cloud Firestore:', err);
          setSyncStatus('error');
          setSyncErrorReason({
            code: err?.code || 'unknown',
            message: err?.message || String(err)
          });
        });
      }
    }
  }, [db, currentUser]);

  const handleUpdateDb = (updater: (prev: AppDatabase) => AppDatabase) => {
    setDb(prev => {
      const next = updater(prev);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleResetDb = () => {
    setDb(INITIAL_DATABASE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATABASE));
  };

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Failed to log in with Google:', err);
      setAuthError({
        code: err?.code || 'unknown',
        message: err?.message || String(err)
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Failed to sign out from Google:', err);
    }
  };

  const handleNavigate = (tab: string) => {
    setInvoiceGensetId(null);
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans" id="applet-container">
      
      {/* Printable Overrides (Natively hides sidebar and dashboard structure during print) */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          @page landscape-sheet {
            size: A4 landscape !important;
            margin: 0 !important;
          }
          body, html, #root, #applet-container, main {
            background: white !important;
            color: black !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          aside, nav, header, footer, button, select, option, .print\\:hidden {
            display: none !important;
          }
          #consolidated-report-overlay {
            page: landscape-sheet !important;
            position: relative !important;
            background: white !important;
            backdrop-filter: none !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }
          #billing-invoice-box, #printable-report-card {
            position: relative !important;
            display: block !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            border: none !important;
            box-shadow: none !important;
            padding: 12mm 15mm !important;
            margin: 0 auto !important;
            background: white !important;
            color: black !important;
            page-break-after: auto !important;
            box-sizing: border-box !important;
          }
          #consolidated-auditor-card {
            page: landscape-sheet !important;
            position: relative !important;
            display: block !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            border: none !important;
            box-shadow: none !important;
            padding: 12mm 15mm !important;
            margin: 0 auto !important;
            background: white !important;
            color: black !important;
            page-break-after: auto !important;
            box-sizing: border-box !important;
          }
          table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
            table-layout: auto !important;
          }
          th, td {
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            white-space: normal !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          .print-invoice-page {
            page-break-after: always !important;
            break-after: page !important;
          }
          .print-invoice-page:last-of-type {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      {/* Sidebar for Left Navigation (Hidden on native Print) */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col border-r border-slate-800 print:hidden z-10 font-sans">
        
        {/* Brand Banner */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white font-bold shrink-0">
              <Fuel className="h-4 w-4" />
            </span>
            <div>
              <span className="text-sm font-extrabold text-white block uppercase tracking-[0.16em]">
                ENGINEERS
              </span>
              <span className="text-[9px] block font-bold text-slate-400 uppercase tracking-[0.2em] -mt-0.5">
                GEN SOLUTIONS
              </span>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation lists (Desktop / Mobile view toggled) */}
        <nav className={`flex-1 py-4 px-3 space-y-1 ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          
          <button
            onClick={() => handleNavigate('dashboard')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'dashboard' && !invoiceGensetId
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-350 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>

          <button
            onClick={() => handleNavigate('logs')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'logs' && !invoiceGensetId
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-350 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Gen Log Book
          </button>

          <button
            onClick={() => handleNavigate('billing')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'billing' && !invoiceGensetId
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-350 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calculator className="h-4 w-4" />
            Billing
          </button>

          <button
            onClick={() => handleNavigate('payments')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'payments' && !invoiceGensetId
                ? 'bg-blue-600 text-white shadow-sm font-bold' 
                : 'text-slate-350 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Receipt className="h-4 w-4 text-emerald-400" />
            Receipts
          </button>

          <button
            onClick={() => handleNavigate('reports')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'reports' && !invoiceGensetId
                ? 'bg-blue-600 text-white shadow-sm font-bold' 
                : 'text-slate-350 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="h-4 w-4 text-emerald-400" />
            Report
          </button>

          <button
            onClick={() => handleNavigate('config')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'config' && !invoiceGensetId
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-350 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="h-4 w-4" />
            Master Configs
          </button>

          <button
            onClick={() => handleNavigate('backup')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'backup' && !invoiceGensetId
                ? 'bg-blue-600 text-white shadow-sm'  
                : 'text-slate-350 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Database className="h-4 w-4" />
            Sync Center
          </button>

        </nav>

        {/* Dynamic Context and App Footer/ID block in sidebar (Desktop only) */}
        <div className="hidden md:block p-3 border-t border-slate-800 bg-slate-900">
          
          {/* Firebase Sync Profile */}
          <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 mb-3 text-left">
            <p className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider mb-1.5 flex items-center justify-between">
              <span>Cloud Sync status</span>
              <span>
                {syncStatus === 'synced' && <span className="text-[10px] font-bold text-emerald-400">Synced ✓</span>}
                {syncStatus === 'syncing' && <span className="text-[10px] font-bold text-sky-400 animate-pulse">Syncing...</span>}
                {syncStatus === 'error' && <span className="text-[10px] font-bold text-rose-400">Sync Error!</span>}
                {syncStatus === 'disconnected' && <span className="text-[10px] font-bold text-slate-500">Local Only</span>}
              </span>
            </p>
            {syncStatus === 'error' && (
              <button
                type="button"
                onClick={() => setShowSyncErrorDiagnosis(true)}
                className="w-full mb-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 p-2 rounded text-left text-rose-200 cursor-pointer text-[10px] transition font-bold leading-snug animate-pulse"
              >
                ⚠️ Firestore Sync Blocked
                <span className="block text-[8px] text-rose-300 font-medium mt-0.5 font-mono truncate">
                  Error: {syncErrorReason?.code || 'permission-denied'}
                </span>
                <span className="block text-[8px] text-rose-450 hover:text-rose-250 underline mt-1 text-right">
                  Tap to resolve ➔
                </span>
              </button>
            )}
            {authLoading ? (
              <p className="text-[11px] text-slate-500">Connecting...</p>
            ) : currentUser ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt="Avatar" 
                      className="h-5 w-5 rounded-full border border-slate-700 font-sans"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="p-1 bg-slate-800 text-slate-300 rounded text-[9px] font-black uppercase font-mono">
                      User
                    </span>
                  )}
                  <div className="truncate flex-1">
                    <span className="text-[11px] font-bold text-slate-200 block truncate font-sans" title={currentUser.email || ''}>
                      {currentUser.displayName || currentUser.email}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-1 py-1 bg-slate-800/80 hover:bg-slate-850 text-slate-400 hover:text-rose-400 font-bold text-[10px] rounded-md transition cursor-pointer"
                >
                  <LogOut className="h-3 w-3" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 animate-fade-in" id="auth-sidebar-buttons">
                <p className="text-[10px] text-slate-400 leading-tight font-sans">
                  Sign in with Google to synchronize your logs across any device!
                </p>
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10.5px] rounded-lg transition shadow-xs cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In with Google
                </button>
                {isInIframe && (
                  <p className="text-[9px] text-amber-450 bg-amber-950/40 p-1.5 rounded leading-normal border border-amber-900/30 font-medium">
                    ⚠️ Popups are blocked inside iframes. Please select <strong className="text-amber-300">"Open in New Tab"</strong> at the top right of your browser viewer to login smoothly!
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 mb-3 text-left">
            <p className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider mb-1">State Context</p>
            <p className="text-xs font-semibold text-slate-200">Standalone Billing</p>
            <p className="text-[10px] text-blue-400 mt-1 font-medium">Cycle: {selectedMonth ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'April 2026'}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">ENGINEERS LOGS V2.5</p>
            <p className="text-[8px] text-slate-600">Standalone Portable Design</p>
          </div>
        </div>

      </aside>

       {/* Main active work layout (Hidden on native Print only if rendering printed sub-box) */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full transition-all duration-300" style={{ minWidth: 0 }}>
        
        {!currentUser && !dismissLoginWarning && (
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start gap-4 animate-fade-in print:hidden" id="google-login-warning-banner">
            <div className="p-3 bg-amber-500/10 rounded-xl shrink-0 text-amber-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <h4 className="text-sm font-black text-amber-900 tracking-tight flex flex-wrap items-center gap-1.5 font-sans">
                <span>Standalone Mode: Enable Secure Cloud Database Sync</span>
                <span className="text-[9px] bg-amber-200/60 text-amber-850 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-sans">Unsaved Changes Risk</span>
              </h4>
              <p className="text-xs text-amber-800 font-medium leading-relaxed font-sans">
                You are currently running in local storage mode. Your fuel logs, generator readings, payments, and generated billing invoices are stored <strong className="text-amber-950 font-extrabold">only in your local browser storage</strong>. If you clear your browser cache, change browsers, or format your device, <strong className="text-rose-700 font-extrabold">all your data will be permanently lost</strong>.
              </p>
              <p className="text-xs text-slate-600 font-medium font-sans">
                Log in with your Google account to back up and synchronize all records instantly to the secure cloud!
              </p>
              
              {isInIframe && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-150/40 p-2.5 rounded-lg border border-amber-200/50 font-medium leading-relaxed font-sans">
                  <span className="font-bold">⚠️ Notice for Preview Mode:</span> Popups are restricted inside this iframe viewer by third-party browser security policies. Please click the <strong className="text-amber-900 font-bold">"Open in New Tab"</strong> button at the top-right corner of your browser view before signing in.
                </div>
              )}
            </div>
            
            <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-amber-200/60">
              <button
                type="button"
                onClick={handleSignIn}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-lg shadow-sm cursor-pointer transition-all active:scale-[0.98] font-sans"
              >
                <LogIn className="h-4 w-4" />
                Connect Google Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissLoginWarning(true);
                  localStorage.setItem('dismiss_google_login_warning', 'true');
                }}
                className="flex-1 md:flex-initial px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-bold text-xs rounded-lg transition-all text-center cursor-pointer font-sans"
              >
                Continue Offline
              </button>
            </div>
          </div>
        )}

        {invoiceGensetId ? (
          <InvoicePrint
            db={db}
            gensetId={invoiceGensetId}
            selectedMonth={selectedMonth}
            onBack={() => setInvoiceGensetId(null)}
          />
        ) : (
          (() => {
            switch (activeTab) {
              case 'dashboard':
                return (
                  <Dashboard
                    db={db}
                    onNavigate={handleNavigate}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
                    onUpdateDb={handleUpdateDb}
                    onEnterLogs={handleEnterLogs}
                  />
                );
              case 'logs':
                return (
                  <LogBook
                    db={db}
                    onUpdateDb={handleUpdateDb}
                    selectedMonth={selectedMonth}
                    activeGensetId={activeGensetId}
                    setActiveGensetId={setActiveGensetId}
                  />
                );
              case 'billing':
                return (
                  <BillingSheet
                    db={db}
                    onUpdateDb={handleUpdateDb}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
                    onSelectInvoice={(gId) => setInvoiceGensetId(gId)}
                  />
                );
              case 'payments':
                return (
                  <PaymentReceipts
                    db={db}
                    onUpdateDb={handleUpdateDb}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
                  />
                );
              case 'reports':
                return (
                  <Reports
                    db={db}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
                  />
                );
              case 'config':
                return (
                  <MasterConfig
                    db={db}
                    onUpdateDb={handleUpdateDb}
                  />
                );
              case 'backup':
                return (
                  <BackupHub
                    db={db}
                    onUpdateDb={handleUpdateDb}
                    onResetDb={handleResetDb}
                    currentUser={currentUser}
                    onSignIn={handleSignIn}
                    onSignOut={handleSignOut}
                  />
                );
              default:
                return (
                  <div className="text-center text-slate-500 py-12">
                     Workspace Tab Not Found.
                  </div>
                );
            }
          })()
        )}

      </main>

      {/* Google Auth Diagnostician & Troubleshooter Modal */}
      {authError && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="auth-diagnostics-modal">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-6 flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl shrink-0">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black tracking-tight">Google Sign-In Troubleshooter</h3>
                <p className="text-amber-100 text-xs mt-1 font-medium">
                  We identified an issue protecting your Google Authentication flow.
                </p>
              </div>
              <button 
                onClick={() => setAuthError(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/85 hover:text-white transition cursor-pointer"
                title="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-750 text-sm leading-relaxed">
              
              {/* Error Codes details */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-sans space-y-2">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 font-mono">Error Code</span>
                  <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                    {authError.code}
                  </span>
                </div>
                <div className="pt-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 font-mono block mb-1">Details</span>
                  <p className="text-xs text-slate-650 font-mono bg-slate-900 text-slate-200 p-2.5 rounded-lg overflow-auto max-h-24 leading-normal">
                    {authError.message}
                  </p>
                </div>
              </div>

              {/* Dynamic Solution logic based on error description */}
              {authError.code === 'auth/unauthorized-domain' ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-l-4 border-blue-500 pl-3">
                    <h4 className="font-extrabold text-blue-900 text-sm">Why did this happen?</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Firebase secure login restricts Google single sign-on requests exclusively to domains you have explicitly greenlisted (whitelisted). Currently, your AI Studio preview web address is not added in your Firebase project.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-extrabold text-slate-940 text-xs uppercase tracking-wider text-slate-600">How to fix it (3 step process):</h4>
                    <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-700">
                      <li>
                        Go to your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline">Firebase Console</a> and open your project.
                      </li>
                      <li>
                        Navigate to <strong>Authentication</strong> (left sidebar) ➔ <strong>Settings</strong> tab ➔ <strong>Authorized Domains</strong> section.
                      </li>
                      <li>
                        Click <strong>Add domain</strong>, paste the following current domain, and click <strong>Add</strong>:
                        <div className="bg-slate-100 border border-slate-300 p-2 rounded mt-1.5 flex items-center justify-between font-mono font-bold text-slate-900">
                          <span>{window.location.host}</span>
                          <button 
                            type="button" 
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.host);
                              alert('Copied domain to clipboard!');
                            }}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-[10px] cursor-pointer"
                          >
                            Copy Domain
                          </button>
                        </div>
                      </li>
                    </ol>
                  </div>

                  <div className="bg-blue-50 border border-blue-150 p-3.5 rounded-xl text-xs text-blue-800 space-y-1">
                    <p className="font-bold">💡 Pro-Tip for Preview environments:</p>
                    <p className="leading-normal">
                      Instead of adding individual temporary domains, you can add <strong>asia-east1.run.app</strong> (or simply <strong>run.app</strong>) in Firebase to automatically authorize all AI Studio preview urls instantly!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-l-4 border-amber-500 pl-3">
                    <h4 className="font-extrabold text-amber-900 text-sm">Why did this happen?</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      This is generally caused either by browser popup-blocking policies (especially when running inside iframes) or because the domain has not been registered inside your Firebase project's <strong>Authorized Domains</strong>.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h4 className="font-extrabold text-slate-940 text-xs uppercase tracking-wider text-slate-600">Quick troubleshooting checklist:</h4>
                    <ul className="space-y-2.5 text-xs text-slate-700">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">1.</span>
                        <div>
                          <strong>Check Authorized Domains (Firebase Console):</strong> Ensure that <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold">{window.location.host}</span> is added under <strong>Firebase Console ➔ Authentication ➔ Settings ➔ Authorized Domains</strong>.
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">2.</span>
                        <div>
                          <strong>Exit the iframe / Slideout Viewer:</strong> Popups inside iframes are strictly blocked by browsers. Click the <strong>"Open in New Tab"</strong> button at the top right of this browser pane and try signing in there.
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">3.</span>
                        <div>
                          <strong>Disable Ad Blockers / Brave Shield:</strong> Third-party blockers might block the authentication callback scripts running inside Firebase popups. Try turning them off temporarily for this tab.
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

            </div>

            {/* Footer buttons */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <a 
                href="https://console.firebase.google.com/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-705 text-xs font-bold rounded-lg transition"
              >
                Go to Firebase Console
              </a>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg shadow cursor-pointer transition"
              >
                Dismiss & Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Firestore Rules Sync troubleshooter modal */}
      {showSyncErrorDiagnosis && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="firestore-sync-diagnostics-modal">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white p-6 flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl shrink-0">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black tracking-tight">Cloud Database Sync Troubleshooter</h3>
                <p className="text-indigo-100 text-xs mt-1 font-medium">
                  We detected that your transactions are failing to save in the cloud. Let's fix this in 2 minutes!
                </p>
              </div>
              <button 
                onClick={() => setShowSyncErrorDiagnosis(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/85 hover:text-white transition cursor-pointer"
                title="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-750 text-sm leading-relaxed">
              
              {/* Error Details */}
              <div className="bg-rose-50 border border-rose-150 rounded-xl p-4 font-sans space-y-2">
                <div className="flex justify-between items-center border-b border-rose-200/60 pb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 font-mono">Error Code</span>
                  <span className="text-xs font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                    {syncErrorReason?.code || 'permission-denied'}
                  </span>
                </div>
                <div className="pt-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 font-mono block mb-1">Error Message</span>
                  <p className="text-xs text-rose-900 font-mono bg-rose-950 text-rose-100 p-2.5 rounded-lg overflow-auto max-h-24 leading-normal">
                    {syncErrorReason?.message || 'Missing or insufficient permissions. This occurs when the Firestore database rules block read or write operations.'}
                  </p>
                </div>
              </div>

              {/* Main troubleshooting instruction */}
              <div className="space-y-4">
                <div className="border-l-4 border-amber-500 pl-3">
                  <h4 className="font-extrabold text-amber-900 text-sm">Why did this happen?</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-normal">
                    You have successfully created your Firestore database in the Firebase Console! However, by default, Firebase initializes standard databases in <strong>"Locked Mode"</strong>, which completely blocks all external reads and writes. To allow your authenticated account to backup and restore billing records, you must publish the secure security rules below.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider text-slate-500">Step-by-step Solution:</h4>
                  <ol className="list-decimal pl-5 space-y-3.5 text-xs text-slate-700">
                    <li>
                      Open your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline">Firebase Console</a>, and navigate into your project.
                    </li>
                    <li>
                      In the left-hand menu, select <strong>Firestore Database</strong>.
                    </li>
                    <li>
                      Click on the <strong>Rules</strong> tab at the top of the Firestore screen.
                    </li>
                    <li>
                      Copy the security rules below, paste them into the code editor on that screen, and click <strong>Publish</strong>:
                      
                      <div className="mt-2.5 border border-slate-300 rounded-lg overflow-hidden bg-slate-900 text-slate-200">
                        <div className="bg-slate-800 px-3 py-1.5 border-b border-slate-700 flex justify-between items-center text-[10px] font-mono text-slate-400">
                          <span>firestore.rules</span>
                          <button 
                            type="button" 
                            onClick={() => {
                              const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
    
    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_-]+$');
    }
    
    function isSignedIn() {
      return request.auth != null;
    }

    function isValidUserBackup(data) {
      return data.userId is string
        && data.userId.size() <= 128
        && data.database is map;
    }

    match /backups/{backupDocId} {
      allow read, delete: if isSignedIn() && isValidId(backupDocId);
      allow create, update: if isSignedIn() && isValidId(backupDocId) 
        && isValidUserBackup(request.resource.data);
    }
  }
}`;
                              navigator.clipboard.writeText(rules);
                              alert('Secure Security Rules copied to clipboard!');
                            }}
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded selection:bg-none cursor-pointer transition text-slate-200"
                          >
                            Copy Rules Block
                          </button>
                        </div>
                        <pre className="p-3 text-[10.5px] font-mono text-slate-300 overflow-auto max-h-56 select-all scrollbar-thin text-left leading-normal">{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
    
    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_-]+$');
    }
    
    function isSignedIn() {
      return request.auth != null;
    }

    function isValidUserBackup(data) {
      return data.userId is string
        && data.userId.size() <= 128
        && data.database is map;
    }

    match /backups/{backupDocId} {
      allow read, delete: if isSignedIn() && isValidId(backupDocId);
      allow create, update: if isSignedIn() && isValidId(backupDocId) 
        && isValidUserBackup(request.resource.data);
    }
  }
}`}</pre>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <a 
                href="https://console.firebase.google.com/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-705 text-xs font-bold rounded-lg transition"
              >
                Go to Firebase Console
              </a>
              <button
                type="button"
                onClick={() => setShowSyncErrorDiagnosis(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg shadow cursor-pointer transition"
              >
                Dismiss & Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
