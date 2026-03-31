import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseEnv = {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
};

export type SupabaseIntegrationStatus = {
    enabled: boolean;
    missingKeys: string[];
};

const env = ((import.meta as ImportMeta & { env?: SupabaseEnv }).env ?? {}) as SupabaseEnv;

const config = {
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY
};

const missingKeys = Object.entries({
    VITE_SUPABASE_URL: config.url,
    VITE_SUPABASE_ANON_KEY: config.anonKey
})
    .filter(([, value]) => !value)
    .map(([key]) => key);

const status: SupabaseIntegrationStatus = {
    enabled: missingKeys.length === 0,
    missingKeys
};

let client: SupabaseClient | null = null;

if (status.enabled) {
    client = createClient(config.url!, config.anonKey!, {
        auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true,
            storageKey: 'gGolems.supabase.auth'
        }
    });
}

export function getSupabaseStatus() {
    return status;
}

export function getSupabaseClient() {
    return client;
}
