/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { AppDatabase } from '../types';
import { User, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db as firestoreDb, activeConfig } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { 
  Download, 
  Upload, 
  Trash2, 
  HelpCircle, 
  Cpu, 
  Database,
  Cloud,
  CloudUpload,
  CloudDownload,
  Calendar,
  LogIn,
  LogOut,
  Info,
  Sliders,
  Key,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface BackupHubProps {
  db: AppDatabase;
  onUpdateDb: (updater: (prev: AppDatabase) => AppDatabase) => void;
  onResetDb: () => void;
  currentUser?: User | null;
  onSignIn?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
}

export default function BackupHub({ 
  db, 
  onUpdateDb, 
  onResetDb, 
  currentUser, 
  onSignIn, 
  onSignOut 
}: BackupHubProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  
  // Cloud sync states
  const [cloudStatus, setCloudStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);

  // Configuration Manager states
  const [showConfigKeysForm, setShowConfigKeysForm] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [configFields, setConfigFields] = useState({
    projectId: activeConfig.projectId || '',
    apiKey: activeConfig.apiKey || '',
    authDomain: activeConfig.authDomain || '',
    storageBucket: activeConfig.storageBucket || '',
    messagingSenderId: activeConfig.messagingSenderId || '',
    appId: activeConfig.appId || '',
    firestoreDatabaseId: activeConfig.firestoreDatabaseId || '',
  });

  const [configSavedStatus, setConfigSavedStatus] = useState<{ type: 'idle' | 'success' | 'reset-success' | 'error'; message: string }>({ type: 'idle', message: '' });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configFields.projectId || !configFields.apiKey) {
      setConfigSavedStatus({
        type: 'error',
        message: 'Project ID and API Key are mandatory to configure a custom Firebase connection.'
      });
      return;
    }

    try {
      localStorage.setItem('custom_firebase_config', JSON.stringify(configFields));
      setConfigSavedStatus({
        type: 'success',
        message: 'Successfully saved custom Firebase configuration overrides! The application is reloading now to apply change...'
      });
      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (err: any) {
      setConfigSavedStatus({
        type: 'error',
        message: `Failed to write settings database: ${err.message}`
      });
    }
  };

  const handleResetConfig = () => {
    if (confirm('Are you sure you want to discard your custom Firebase keys and reload using default app credentials?')) {
      localStorage.removeItem('custom_firebase_config');
      setConfigSavedStatus({
        type: 'reset-success',
        message: 'Discarded personal configuration. Purging credentials now... Reloading page...'
      });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  };

  // Check last sync date automatically on load if user is logged in
  useEffect(() => {
    const fetchSyncStatus = async () => {
      if (!currentUser) return;
      try {
        const docRef = doc(firestoreDb, 'users', currentUser.uid, 'backups', 'active');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const payload = snap.data();
          if (payload?.updatedAt) {
            const date = payload.updatedAt.toDate ? payload.updatedAt.toDate() : new Date(payload.updatedAt);
            setLastSyncDate(date.toLocaleString());
          }
        }
      } catch (err) {
        console.warn('Sync status check warning. If offline, this is expected.', err);
      }
    };
    fetchSyncStatus();
  }, [currentUser]);

  // Cloud backup to Firestore
  const handleCloudBackup = async () => {
    if (!currentUser) return;
    setCloudStatus({ type: 'loading', message: 'Syncing your database records securely to Cloud Firestore...' });
    
    const docRef = doc(firestoreDb, 'users', currentUser.uid, 'backups', 'active');
    try {
      await setDoc(docRef, {
        userId: currentUser.uid,
        updatedAt: serverTimestamp(),
        database: db
      });
      setCloudStatus({
        type: 'success',
        message: 'Your generator log system is fully back up online! You can retrieve this data instantly from any device.'
      });
      setLastSyncDate(new Date().toLocaleString());
    } catch (err: any) {
      setCloudStatus({
        type: 'error',
        message: `Cloud sync failed. ${err.message}`
      });
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/backups/active`);
      } catch (logErr) {}
    }
  };

  // Cloud restore from Firestore
  const handleCloudRestore = async () => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to download and restore from Cloud? This will overwrite any unsaved local edits.')) {
      return;
    }
    setCloudStatus({ type: 'loading', message: 'Connecting to Cloud secure node and querying backup file...' });
    
    const docRef = doc(firestoreDb, 'users', currentUser.uid, 'backups', 'active');
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const payload = snap.data();
        if (payload?.database) {
          onUpdateDb(() => payload.database);
          setCloudStatus({
            type: 'success',
            message: 'Database recovered successfully! Local configuration aligned with Cloud Server.'
          });
          if (payload.updatedAt) {
            const date = payload.updatedAt.toDate ? payload.updatedAt.toDate() : new Date(payload.updatedAt);
            setLastSyncDate(date.toLocaleString());
          }
        } else {
          setCloudStatus({
            type: 'error',
            message: 'Backup file exists, but it did not contain a valid database configuration.'
          });
        }
      } else {
        setCloudStatus({
          type: 'error',
          message: 'No active backups found for your account on the Cloud. Please save a backup first.'
        });
      }
    } catch (err: any) {
      setCloudStatus({
        type: 'error',
        message: `Failed to restore backup. ${err.message}`
      });
      try {
        handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}/backups/active`);
      } catch (logErr) {}
    }
  };

  // Handle export to JSON file
  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(db, null, 2);
      const today = new Date().toISOString().slice(0, 10);
      const filename = `engineers_diesel_log_db_${today}.json`;
      
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setImportStatus({
        type: 'success',
        message: `Database successfully compiled and downloaded as "${filename}". Save this directly onto your Pen Drive!`
      });
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: `Failed to compile backup. Error: ${err.message}`
      });
    }
  };

  // Handle import of JSON file
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as AppDatabase;

        // Perform schema validations to avoid importing broken details
        if (!parsed.company || !Array.isArray(parsed.clients) || !Array.isArray(parsed.gensets) || !Array.isArray(parsed.siteLogs)) {
          throw new Error('Selected backup file is invalid or uses an legacy data model.');
        }

        // Save into state & localstorage
        onUpdateDb(() => parsed);

        setImportStatus({
          type: 'success',
          message: 'Database imported successfully! All monthly meter logs, prices, and settings are synchronized.'
        });
      } catch (err: any) {
        setImportStatus({
          type: 'error',
          message: `Failed to import selected file. ${err.message}`
        });
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetToSeed = () => {
    if (confirm('Are you sure you want to reset the database to sample seed data? This will overwrite Salem DO & Kottayam DO records.')) {
      onResetDb();
      setImportStatus({
        type: 'success',
        message: 'Successfully purged and restored to demo Salem DO & Kottayam DO files.'
      });
    }
  };

  return (
    <div className="space-y-4 shadow-3xl" id="portability-tab">
      
      {/* Header Panel */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-1.5 font-sans">
            <Database className="h-5.5 w-5.5 text-blue-600 font-bold" />
            Generator Data Synchronization Center
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Synchronize your generator log systems either offline via USB Pen Drives or online across all devices.
          </p>
        </div>
      </div>

      {/* Cloud Sync Section */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-black text-[9px] uppercase tracking-wider rounded-full font-mono">
                Enterprise Cloud Sync
              </span>
              <span className={`flex h-2 w-2 rounded-full ${currentUser ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            </div>
            <h2 className="text-base font-extrabold tracking-wide flex items-center gap-2 font-sans">
              <Cloud className="h-5 w-5 text-indigo-400 shrink-0" />
              Secure Firebase Sync & Real-time Mirroring
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-normal font-sans">
              Log in with Google for automated, hands-off cloud sync. Every generator log book edit, client update, or billing rate adjustment you make is instantly persisted to Cloud Firestore and mirrored across all your tablets, phones, or machines running this application!
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-3 font-sans">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wide">Sync Connected</span>
                  <span className="text-xs font-semibold text-slate-200 block truncate max-w-[150px]" title={currentUser.email || ''}>
                    {currentUser.displayName || currentUser.email}
                  </span>
                </div>
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer transition border border-slate-700"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              onSignIn && (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg shadow hover:shadow-md transition cursor-pointer"
                >
                  <LogIn className="h-4 w-4" />
                  Connect Google Account
                </button>
              )
            )}
          </div>
        </div>

        {/* Cloud sync actions (Only shown when logged in) */}
        {currentUser && (
          <div className="border-t border-slate-800/80 p-4 sm:p-5 bg-slate-950/40 font-sans">
            
            <div className="bg-emerald-950/30 border border-emerald-550/30 p-3 rounded-lg mb-4 text-xs flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="text-emerald-250">
                <span className="font-extrabold uppercase text-[10px] tracking-wider block">Live Cloud Stream Online</span>
                <span className="text-[11px] opacity-90 mt-0.5 block">
                  Automatic, hands-free synchronization is active. All of your generator logs and settings are instantly mirroring to Firestore as you work!
                </span>
              </div>
            </div>

            {cloudStatus.type !== 'idle' && (
              <div className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs mb-4 ${
                cloudStatus.type === 'loading'
                  ? 'bg-blue-950/40 border-blue-900/50 text-blue-200'
                  : cloudStatus.type === 'success'
                  ? 'bg-emerald-950/30 border-emerald-900/40 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-900/40 text-rose-250'
              }`}>
                <div className="pt-0.5">●</div>
                <div>
                  <p className="font-extrabold uppercase tracking-wider text-[10px]">
                    {cloudStatus.type === 'loading' ? 'Cloud Sync in Progress' : cloudStatus.type === 'success' ? 'Cloud Transaction Success' : 'Cloud Error'}
                  </p>
                  <p className="mt-0.5 text-[11px] opacity-90">{cloudStatus.message}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Push backup to firebase */}
              <div className="p-3.5 bg-slate-900/50 rounded-xl border border-slate-800/60 flex items-start gap-4">
                <div className="p-2.5 bg-indigo-950 text-indigo-400 rounded-lg border border-indigo-900 shrink-0">
                  <CloudUpload className="h-5.5 w-5.5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Push to Cloud Storage</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Saves your current local generator log database to secure Cloud Firestore. Overwrites your previous online backup.
                  </p>
                  <button
                    type="button"
                    onClick={handleCloudBackup}
                    disabled={cloudStatus.type === 'loading'}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-[11.5px] px-3.5 py-1.5 rounded-lg transition mt-1 shadow-xs cursor-pointer"
                  >
                    Backup to Cloud
                  </button>
                </div>
              </div>

              {/* Retrieve backup from firebase */}
              <div className="p-3.5 bg-slate-900/50 rounded-xl border border-slate-800/60 flex items-start gap-4">
                <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-900 shrink-0">
                  <CloudDownload className="h-5.5 w-5.5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Pull from Cloud Storage</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Downloads and overwrites your local browser memory with the active backup file stored securely in the cloud.
                  </p>
                  <button
                    type="button"
                    onClick={handleCloudRestore}
                    disabled={cloudStatus.type === 'loading'}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-[11.5px] px-3.5 py-1.5 rounded-lg transition mt-1 shadow-xs cursor-pointer"
                  >
                    Load Backup from Cloud
                  </button>
                </div>
              </div>
            </div>

            {lastSyncDate && (
              <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                <span>Last Cloud Server Backup: <strong className="text-slate-200">{lastSyncDate}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>

      {importStatus.type !== 'idle' && (
        <div className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
          importStatus.type === 'success' 
            ? 'bg-emerald-50 border-emerald-150 text-emerald-800' 
            : 'bg-rose-50 border-rose-150 text-rose-800'
        }`}>
          <div className="pt-0.5 font-bold text-slate-600">●</div>
          <div>
            <p className="font-extrabold">{importStatus.type === 'success' ? 'Task Completed' : 'Operation Error'}</p>
            <p className="mt-0.5 text-[11px] opacity-90">{importStatus.message}</p>
          </div>
        </div>
      )}

      {/* Main portability cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Sync panel actions */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-150 pb-2 uppercase tracking-wider">
            <Cpu className="h-4.5 w-4.5 text-blue-600 font-bold" />
            USB / Offline Backup Operations
          </h2>

          <div className="space-y-4 text-sans">
            {/* Export */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-150 flex items-start gap-4">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-lg shrink-0">
                <Download className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-sm font-bold text-slate-800">Export All Log Sheets</h3>
                <p className="text-xs text-slate-500">
                  Dumps all configurations, daily readings, GST parameters, fuel charts into a tiny file. Copies perfectly to USB flash drives.
                </p>
                <button
                  type="button"
                  onClick={handleExport}
                  id="export-database-btn"
                  className="bg-blue-650 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition mt-1 shadow-xs cursor-pointer font-sans"
                >
                  Download DB File (.json)
                </button>
              </div>
            </div>

            {/* Import */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-150 flex items-start gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
                <Upload className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-sm font-bold text-slate-800">Import Log Sheets</h3>
                <p className="text-xs text-slate-500">
                  Select and restore an exported database file from your USB Pen Drive to continue editing on this machine.
                </p>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportFile}
                  accept=".json"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleImportClick}
                  id="import-database-btn"
                  className="bg-emerald-650 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition mt-1 shadow-xs cursor-pointer font-sans"
                >
                  Select Database File
                </button>
              </div>
            </div>

            {/* Restore / purge seed */}
            <div className="p-4 bg-rose-50/20 rounded-xl border border-rose-150/50 flex items-start gap-4">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-lg shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 flex-1 p-1">
                <h3 className="text-sm font-bold text-slate-800">Erase & Reload Salem, Kottayam Demo Logs</h3>
                <p className="text-xs text-slate-500">
                  Wipes your current in-browser database and replaces it with the default seed logs shown in Excel images. Useful to refresh mock runs.
                </p>
                <button
                  type="button"
                  onClick={handleResetToSeed}
                  id="reset-database-btn"
                  className="text-rose-600 hover:text-rose-700 text-xs font-bold underline font-sans cursor-pointer"
                >
                  Purge and Reload Defaults
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Explain guidelines card */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-150 pb-2 uppercase tracking-wider">
            <HelpCircle className="h-4.5 w-4.5 text-orange-500 font-bold" />
            Pen Drive (USB) Shifting Guide
          </h2>
          <p className="text-[11px] text-slate-500 leading-normal font-sans">
            To operate this billing generator across **2 to 3 standalone computer networks** seamlessly without any internet connection:
          </p>

          <div className="space-y-2.5 pt-1 font-sans">
            
            <div className="flex items-start gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-extrabold text-blue-800">
                1
              </span>
              <div className="text-[11px]">
                <h4 className="font-bold text-slate-800 uppercase tracking-wide">Work on Computer A</h4>
                <p className="text-slate-500 text-[10.5px] leading-normal">
                  Update daily generator readings, check tally balances, and finalize calculations. Run your day-to-day operations.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-extrabold text-blue-800">
                2
              </span>
              <div className="text-[11px]">
                <h4 className="font-bold text-slate-800 uppercase tracking-wide">Export to Pen Drive</h4>
                <p className="text-slate-500 text-[10.5px] leading-normal">
                  Click "Download DB File" above. Copy the downloaded `.json` file directly onto your USB Pen Drive.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-extrabold text-blue-800">
                3
              </span>
              <div className="text-[11px]">
                <h4 className="font-bold text-slate-800 uppercase tracking-wide">Import on Computer B</h4>
                <p className="text-slate-500 text-[10.5px] leading-normal">
                  Go to Computer B, open this app, and select the file from your USB. Computer B will instantly synchronize 100% of the logs.
                </p>
              </div>
            </div>

          </div>

          <div className="p-2.5 bg-amber-50/50 rounded border border-amber-100 flex gap-2 font-sans">
            <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-900 leading-normal">
              Your database automatically persists inside your browser's private local state. Data is <strong>safely preserved locally</strong> even when restarted. Only use the Pen Drive when transferring to another machine.
            </p>
          </div>
        </div>

      </div>

      {/* Advanced Custom Firebase Connection Panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 font-sans">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-3">
          <div className="flex items-start gap-2.5">
            <span className="p-2 bg-slate-100 text-slate-755 rounded-lg shrink-0">
              <Sliders className="h-5 w-5 text-indigo-650 font-bold" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                Firebase Connection Setup
                {localStorage.getItem('custom_firebase_config') ? (
                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 text-[9px] font-black uppercase rounded-md tracking-wider animate-pulse">
                    Custom Config Overrides Active
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 text-[9px] font-bold uppercase rounded-md tracking-wider">
                    Default Project Active
                  </span>
                )}
              </h2>
              <p className="text-slate-500 text-[11px] mt-0.5 leading-normal">
                Check details or configure the application to connect to custom databases for login and cloud synchronization.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowConfigKeysForm(!showConfigKeysForm)}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 font-bold text-xs rounded-lg transition shrink-0 cursor-pointer border border-slate-200 flex items-center gap-1.5"
          >
            <Key className="h-3.5 w-3.5 text-slate-500" />
            {showConfigKeysForm ? 'Collapse Connection settings' : 'Configure Custom project keys'}
          </button>
        </div>

        {/* Current Active Settings Summary Badge Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-150 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-extrabold">Active Project ID</span>
            <span className="font-semibold text-slate-800 block mt-0.5 truncate font-mono">{activeConfig.projectId || 'None'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-extrabold">Active API Key</span>
            <span className="font-semibold text-slate-800 block mt-0.5 truncate font-mono">
              {activeConfig.apiKey ? `${activeConfig.apiKey.substring(0, 8)}...` : 'None'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-extrabold">Auth Domain Host</span>
            <span className="font-semibold text-slate-800 block mt-0.5 truncate font-mono">{activeConfig.authDomain || 'None'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-extrabold">Firestore DB Instance</span>
            <span className="font-semibold text-slate-800 block mt-0.5 truncate font-mono text-indigo-700 font-bold">
              {activeConfig.firestoreDatabaseId || '(default Standard Database)'}
            </span>
          </div>
        </div>

        {configSavedStatus.type !== 'idle' && (
          <div className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
            configSavedStatus.type === 'success' || configSavedStatus.type === 'reset-success'
              ? 'bg-emerald-50 border-emerald-150 text-emerald-800'
              : 'bg-rose-50 border-rose-150 text-rose-800'
          }`}>
            <RefreshCw className={`h-4 w-4 shrink-0 mt-0.5 ${(configSavedStatus.type === 'success' || configSavedStatus.type === 'reset-success') ? 'animate-spin' : ''}`} />
            <div>
              <p className="font-extrabold uppercase text-[10px] tracking-wide">
                {configSavedStatus.type === 'success' ? 'Settings Saved' : configSavedStatus.type === 'reset-success' ? 'Settings purged' : 'Validation Error'}
              </p>
              <p className="mt-0.5 text-[11px] opacity-95">{configSavedStatus.message}</p>
            </div>
          </div>
        )}

        {showConfigKeysForm && (
          <form onSubmit={handleSaveConfig} className="space-y-4 border-t border-slate-150 pt-3 animate-fade-in">
            
            <div className="bg-blue-50/70 border border-blue-150 p-3 rounded-lg text-blue-850 text-xs flex gap-2.5">
              <Info className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">Database & Auth Hosting Portability:</span>
                <span className="block mt-0.5 opacity-90">
                  By default, the application is set up with your <strong>gen-log-book</strong> project. You can override these keys under your private browser profile by specifying custom credentials below. This is highly useful for standalone testing, private builds, or if you rotate your Firebase API credentials later.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project ID */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">
                  Project ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={configFields.projectId}
                  onChange={(e) => setConfigFields(prev => ({ ...prev, projectId: e.target.value.trim() }))}
                  placeholder="e.g. gen-log-book"
                  className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg text-slate-800 font-mono placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/25 outline-hidden"
                />
              </div>

              {/* API Key */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide flex justify-between">
                  <span>API Key <span className="text-rose-500">*</span></span>
                  <button 
                    type="button" 
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-[10px] text-blue-600 hover:underline font-bold capitalize cursor-pointer font-sans"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </label>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  required
                  value={configFields.apiKey}
                  onChange={(e) => setConfigFields(prev => ({ ...prev, apiKey: e.target.value.trim() }))}
                  placeholder="AIzaSy..."
                  className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg text-slate-800 font-mono placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/25 outline-hidden"
                />
              </div>

              {/* Auth Domain */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide mt-1">
                  Auth Domain Host
                </label>
                <input
                  type="text"
                  value={configFields.authDomain}
                  onChange={(e) => setConfigFields(prev => ({ ...prev, authDomain: e.target.value.trim() }))}
                  placeholder="e.g. gen-log-book.firebaseapp.com"
                  className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg text-slate-800 font-mono placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/25 outline-hidden"
                />
              </div>

              {/* App ID */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide mt-1">
                  App ID (Web Application ID)
                </label>
                <input
                  type="text"
                  value={configFields.appId}
                  onChange={(e) => setConfigFields(prev => ({ ...prev, appId: e.target.value.trim() }))}
                  placeholder="e.g. 1:337575704424:web:3ba..."
                  className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg text-slate-800 font-mono placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/25 outline-hidden"
                />
              </div>

              {/* Storage Bucket */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide mt-1">
                  Storage Bucket
                </label>
                <input
                  type="text"
                  value={configFields.storageBucket}
                  onChange={(e) => setConfigFields(prev => ({ ...prev, storageBucket: e.target.value.trim() }))}
                  placeholder="e.g. gen-log-book.firebasestorage.app"
                  className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg text-slate-800 font-mono placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/25 outline-hidden"
                />
              </div>

              {/* Messaging Sender ID */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide mt-1">
                  Messaging Sender ID
                </label>
                <input
                  type="text"
                  value={configFields.messagingSenderId}
                  onChange={(e) => setConfigFields(prev => ({ ...prev, messagingSenderId: e.target.value.trim() }))}
                  placeholder="e.g. 337575704424"
                  className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg text-slate-800 font-mono placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/25 outline-hidden"
                />
              </div>

              {/* Custom Database ID */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide mt-1">
                  Firestore Database Name (Optional)
                </label>
                <input
                  type="text"
                  value={configFields.firestoreDatabaseId}
                  onChange={(e) => setConfigFields(prev => ({ ...prev, firestoreDatabaseId: e.target.value.trim() }))}
                  placeholder="Leave empty for production default database instance (Recommended unless using Multiple Multi-Tenant DBs)"
                  className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg text-slate-800 font-mono placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/25 outline-hidden"
                />
                <p className="text-[10px] text-slate-500 mt-1 leading-normal italic">
                  Leave empty if you are using standard database. Enterprise multi-tenant Firestore instances may need a customized database identifier.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3.5 border-t border-slate-150 pt-3.5">
              {localStorage.getItem('custom_firebase_config') && (
                <button
                  type="button"
                  onClick={handleResetConfig}
                  className="w-full sm:w-auto px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold text-xs rounded-lg transition shrink-0 cursor-pointer border border-rose-100 uppercase tracking-wider"
                >
                  Discard Custom Keys
                </button>
              )}
              
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg transition shrink-0 cursor-pointer uppercase tracking-wider shadow-xs"
              >
                Save overrides & apply
              </button>
            </div>

          </form>
        )}

      </div>

    </div>
  );
}
