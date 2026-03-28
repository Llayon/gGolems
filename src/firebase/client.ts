import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

type FirebaseLobbyStatus = {
    enabled: boolean;
    missingKeys: string[];
};

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

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
}

export function getFirebaseLobbyStatus() {
    return status;
}

export function getFirebaseDatabase() {
    return database;
}

