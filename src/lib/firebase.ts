import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, type User } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

type FirebaseEnvKey =
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_DATABASE_URL'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_APP_ID';

const REQUIRED_ENV_KEYS: FirebaseEnvKey[] = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

const getEnv = (key: FirebaseEnvKey) => {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const missingFirebaseEnvKeys = REQUIRED_ENV_KEYS.filter((key) => !getEnv(key));

export const isFirebaseConfigured = missingFirebaseEnvKeys.length === 0;

export const firebaseConfigError = isFirebaseConfigured
  ? null
  : `Missing Firebase env vars: ${missingFirebaseEnvKeys.join(', ')}`;

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  databaseURL: getEnv('VITE_FIREBASE_DATABASE_URL'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
};

const app = isFirebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

export const firebaseAuth = app ? getAuth(app) : null;
export const firebaseDb = app ? getDatabase(app) : null;

let ensureAuthPromise: Promise<User> | null = null;

export const ensureAnonymousAuthUser = async () => {
  if (!firebaseAuth) {
    throw new Error(firebaseConfigError ?? 'Firebase Auth is unavailable.');
  }

  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser;
  }

  if (!ensureAuthPromise) {
    ensureAuthPromise = signInAnonymously(firebaseAuth)
      .then((credential) => credential.user)
      .catch((error: unknown) => {
        ensureAuthPromise = null;
        throw error;
      });
  }

  return ensureAuthPromise;
};
