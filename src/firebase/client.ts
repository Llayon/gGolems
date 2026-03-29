import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

type FirebaseLobbyStatus = {
    enabled: boolean;
    missingKeys: string[];
};

const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

type FirebaseEnv = {
    VITE_FIREBASE_API_KEY?: string;
    VITE_FIREBASE_AUTH_DOMAIN?: string;
    VITE_FIREBASE_DATABASE_URL?: string;
    VITE_FIREBASE_PROJECT_ID?: string;
    VITE_FIREBASE_APP_ID?: string;
};

const env = ((import.meta as ImportMeta & { env?: FirebaseEnv }).env ?? {}) as FirebaseEnv;

const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

const missingKeys = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

const status: FirebaseLobbyStatus = {
    enabled: missingKeys.length === 0,
    missingKeys
};

let app: FirebaseApp | null = null;
let database: Database | null = null;

if (status.enabled) {
    app = getApps().length > 0 ? getApp() : initializeApp(config as Record<string, string>);
    database = getDatabase(app);
} else if (isDev && typeof console !== 'undefined') {
    console.info('[firebase] Lobby registry disabled. Missing env keys:', status.missingKeys.join(', '));
}

export function getFirebaseLobbyStatus() {
    return status;
}

export function getFirebaseDatabase() {
    return database;
}
