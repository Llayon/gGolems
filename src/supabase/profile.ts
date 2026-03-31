import type { Locale } from '../i18n/types';
import { getSupabaseClient } from './client';
import type { PlayerProfile } from './types';
import { describeError } from './utils';

function buildDefaultCallsign(userId: string) {
    return `PILOT-${userId.slice(0, 8).toUpperCase()}`;
}

export async function ensurePilotProfile(userId: string, locale: Locale, suggestedCallsign?: string) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not configured.');
    }

    const now = new Date().toISOString();
    const callsign = typeof suggestedCallsign === 'string' && suggestedCallsign.trim().length > 0
        ? suggestedCallsign.trim().slice(0, 24)
        : buildDefaultCallsign(userId);

    const { error: upsertError } = await client.from('profiles').upsert({
        id: userId,
        callsign,
        preferred_locale: locale,
        updated_at: now,
        last_seen_at: now
    }, {
        onConflict: 'id'
    });

    if (upsertError) {
        throw new Error(describeError(upsertError, 'Failed to upsert Supabase profile.'));
    }

    const { data, error } = await client
        .from('profiles')
        .select('id, callsign, preferred_locale, created_at, updated_at, last_seen_at')
        .eq('id', userId)
        .single();

    if (error || !data) {
        throw new Error(describeError(error, 'Failed to load Supabase profile.'));
    }

    return data as PlayerProfile;
}

export async function syncPilotLocale(userId: string, locale: Locale) {
    const client = getSupabaseClient();
    if (!client) return;

    const now = new Date().toISOString();
    const { error } = await client
        .from('profiles')
        .update({
            preferred_locale: locale,
            updated_at: now,
            last_seen_at: now
        })
        .eq('id', userId);

    if (error) {
        throw new Error(describeError(error, 'Failed to update pilot locale.'));
    }
}
