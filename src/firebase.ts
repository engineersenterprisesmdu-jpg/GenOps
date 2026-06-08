import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import localConfig from '../firebase-applet-config.json';

// Fetch dynamic custom config overrides from localStore or default configuration
const getActiveConfig = () => {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('custom_firebase_config') : null;
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.projectId) {
        return {
          apiKey: parsed.apiKey,
          authDomain: parsed.authDomain,
          projectId: parsed.projectId,
          storageBucket: parsed.storageBucket,
          messagingSenderId: parsed.messagingSenderId,
          appId: parsed.appId,
          firestoreDatabaseId: parsed.firestoreDatabaseId || "",
        };
      }
    } catch (e) {
      console.error('Failed to parse custom client-side firebase config:', e);
    }
  }

  const env = (import.meta as any).env || {};
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || localConfig.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain,
    projectId: env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID || localConfig.appId,
    firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || localConfig.firestoreDatabaseId || "",
  };
};

export const activeConfig = getActiveConfig();

const app = initializeApp(activeConfig);
export const db = activeConfig.firestoreDatabaseId 
  ? getFirestore(app, activeConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

