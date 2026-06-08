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
  Cloud
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

  // For print view: when invoiceGensetId is set, show printable invoice screen
  const [invoiceGensetId, setInvoiceGensetId] = useState<string | null>(null);

  // Mobile menu visibility
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Ref to hold the remote string representation of the database to block cyclic writes
  const remoteDbStringRef = useRef<string>('');

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
    });
    return () => unsubscribe();
  }, []);

  // Listen for realtime cloud updates when logged in
  useEffect(() => {
    if (!currentUser) {
      remoteDbStringRef.current = '';
      return;
    }

    const docRef = doc(firestoreDb, 'users', currentUser.uid, 'backups', 'active');
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
      } else {
        // First-time sync: if Firestore lacks a backup, save the current local database state to initialize it
        const currentDb = dbRef.current;
        const dbString = JSON.stringify(currentDb);
        remoteDbStringRef.current = dbString;
        
        setDoc(docRef, {
          userId: currentUser.uid,
          updatedAt: serverTimestamp(),
          database: currentDb
        }).catch(err => {
          console.error('Failed to initialize empty Firebase database:', err);
        });
      }
    }, (err) => {
      console.warn('Firebase realtime subscription sync error (offline or permissions):', err);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Sync to localstorage and write to Firebase in real-time on local change
  useEffect(() => {
    const dbString = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, dbString);

    if (currentUser) {
      // Only write to Firestore if the current state is different from the last remote version we tracked
      if (dbString !== remoteDbStringRef.current) {
        remoteDbStringRef.current = dbString;
        const docRef = doc(firestoreDb, 'users', currentUser.uid, 'backups', 'active');
        setDoc(docRef, {
          userId: currentUser.uid,
          updatedAt: serverTimestamp(),
          database: db
        }).catch(err => {
          console.error('Failed to sync state to Cloud Firestore:', err);
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
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Failed to log in with Google:', err);
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
            margin: 10mm 12mm 10mm 12mm !important;
          }
          @page landscape-sheet {
            size: A4 landscape !important;
            margin: 8mm 10mm 8mm 10mm !important;
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
            padding: 6mm !important;
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
            padding: 6mm !important;
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
              {currentUser ? (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-600 inline-block" />
              )}
            </p>
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
                  />
                );
              case 'logs':
                return (
                  <LogBook
                    db={db}
                    onUpdateDb={handleUpdateDb}
                    selectedMonth={selectedMonth}
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

    </div>
  );
}
