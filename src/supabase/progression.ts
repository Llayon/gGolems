import type { User } from '@supabase/supabase-js';
import type { Locale } from '../i18n/types';
import { getSupabaseClient, getSupabaseStatus } from './client';

export type PlayerProfile = {
    id: string;
    callsign: string;
    preferred_locale: Locale;
    created_at: string;
    updated_at: string;
    last_seen_at: string;
};

export type PlayerProgress = {
    player_id: string;
    xp: number;
    credits: number;
    matches_played: number;
    matches_won: number;
    last_match_mode: string | null;
    last_match_result: 'win' | 'loss' | null;
    last_match_blue: number;
    last_match_red: number;
    created_at: string;
    updated_at: string;
};

export type PilotAccountSnapshot = {
    userId: string;
    callsign: string;
    isAnonymous: boolean;
    profile: PlayerProfile;
    progress: PlayerProgress;
};

export type MatchRecordInput = {
    mode: string;
    won: boolean;
    blueScore: number;
    redScore: number;
};

function describeError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return typeof error === 'string' ? error : fallback;
}

function buildDefaultCallsign(userId: string) {
    return `PILOT-${userId.slice(0, 8).toUpperCase()}`;
}

function getAnonymousFlag(user: User) {
    return Boolean(
        (user as User & { is_anonymous?: boolean }).is_anonymous
        || user.app_metadata?.provider === 'anonymous'
    );
}

async function ensureSessionUser() {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not configured.');
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
        throw new Error(describeError(sessionError, 'Failed to load Supabase session.'));
    }

    if (sessionData.session?.user) {
        return sessionData.session.user;
    }

    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) {
        throw new Error(describeError(error, 'Failed to create Supabase guest session.'));
    }

    return data.user;
}

async function ensureProfile(user: User, locale: Locale) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not configured.');
    }

    const now = new Date().toISOString();
    const callsign = typeof user.user_metadata?.callsign === 'string' && user.user_metadata.callsign.trim().length > 0
        ? user.user_metadata.callsign.trim().slice(0, 24)
        : buildDefaultCallsign(user.id);

    const { error: upsertError } = await client.from('profiles').upsert({
        id: user.id,
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
        .eq('id', user.id)
        .single();

    if (error || !data) {
        throw new Error(describeError(error, 'Failed to load Supabase profile.'));
    }

    return data as PlayerProfile;
}

async function ensureProgress(userId: string) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not configured.');
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await client.from('player_progress').upsert({
        player_id: userId,
        updated_at: now
    }, {
        onConflict: 'player_id'
    });

    if (upsertError) {
        throw new Error(describeError(upsertError, 'Failed to upsert Supabase progress.'));
    }

    const { data, error } = await client
        .from('player_progress')
        .select('player_id, xp, credits, matches_played, matches_won, last_match_mode, last_match_result, last_match_blue, last_match_red, created_at, updated_at')
        .eq('player_id', userId)
        .single();

    if (error || !data) {
        throw new Error(describeError(error, 'Failed to load Supabase progress.'));
    }

    return data as PlayerProgress;
}

export async function bootstrapPilotAccount(locale: Locale): Promise<PilotAccountSnapshot | null> {
    if (!getSupabaseStatus().enabled) {
        return null;
    }

    const user = await ensureSessionUser();
    const profile = await ensureProfile(user, locale);
    const progress = await ensureProgress(user.id);

    return {
        userId: user.id,
        callsign: profile.callsign,
        isAnonymous: getAnonymousFlag(user),
        profile,
        progress
    };
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

export async function recordPilotMatch(userId: string, result: MatchRecordInput) {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data: existing, error: loadError } = await client
        .from('player_progress')
        .select('matches_played, matches_won, xp, credits')
        .eq('player_id', userId)
        .maybeSingle();

    if (loadError) {
        throw new Error(describeError(loadError, 'Failed to load pilot progress before recording match.'));
    }

    const now = new Date().toISOString();
    const matchesPlayed = (existing?.matches_played ?? 0) + 1;
    const matchesWon = (existing?.matches_won ?? 0) + (result.won ? 1 : 0);
    const xp = (existing?.xp ?? 0) + (result.won ? 125 : 55);
    const credits = (existing?.credits ?? 0) + (result.won ? 60 : 25);

    const { error } = await client.from('player_progress').upsert({
        player_id: userId,
        matches_played: matchesPlayed,
        matches_won: matchesWon,
        xp,
        credits,
        last_match_mode: result.mode,
        last_match_result: result.won ? 'win' : 'loss',
        last_match_blue: result.blueScore,
        last_match_red: result.redScore,
        updated_at: now
    }, {
        onConflict: 'player_id'
    });

    if (error) {
        throw new Error(describeError(error, 'Failed to record pilot match.'));
    }

    return {
        matchesPlayed,
        matchesWon,
        xp,
        credits
    };
}
