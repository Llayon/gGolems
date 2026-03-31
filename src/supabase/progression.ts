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

export type PlayerMatchRecord = {
    id: string;
    player_id: string;
    mode: string;
    result: 'win' | 'loss';
    blue_score: number;
    red_score: number;
    created_at: string;
};

export type PilotAccountSnapshot = {
    userId: string;
    callsign: string;
    isAnonymous: boolean;
    email: string | null;
    linkedProviders: string[];
    profile: PlayerProfile;
    progress: PlayerProgress;
    recentMatches: PlayerMatchRecord[];
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

function isMissingRelationError(error: unknown) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const code = 'code' in error ? (error as { code?: unknown }).code : undefined;
    const message = 'message' in error ? (error as { message?: unknown }).message : undefined;
    return code === '42P01'
        || code === 'PGRST204'
        || code === 'PGRST205'
        || (typeof message === 'string' && message.toLowerCase().includes('match_results'));
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

function getAuthRedirectUrl() {
    if (typeof window === 'undefined') {
        return undefined;
    }
    return `${window.location.origin}${window.location.pathname}`;
}

async function getLinkedProviders(user: User) {
    const client = getSupabaseClient();
    if (!client) {
        return {
            email: user.email ?? null,
            linkedProviders: []
        };
    }

    const { data } = await client.auth.getUserIdentities();
    const identities = data?.identities ?? user.identities ?? [];
    const emailIdentity = identities.find((identity) => identity.provider === 'email');
    const email = typeof emailIdentity?.identity_data?.email === 'string'
        ? emailIdentity.identity_data.email
        : user.email ?? null;
    const linkedProviders = Array.from(new Set(
        identities
            .map((identity) => identity.provider)
            .filter((provider): provider is string => typeof provider === 'string' && provider !== 'anonymous')
    ));

    return {
        email,
        linkedProviders
    };
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

async function loadRecentMatchResults(userId: string, limit = 5) {
    const client = getSupabaseClient();
    if (!client) {
        return [];
    }

    const { data, error } = await client
        .from('match_results')
        .select('id, player_id, mode, result, blue_score, red_score, created_at')
        .eq('player_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        if (!isMissingRelationError(error)) {
            console.warn('[supabase] Failed to load match history:', error);
        }
        return [];
    }

    return (data ?? []) as PlayerMatchRecord[];
}

export async function bootstrapPilotAccount(locale: Locale): Promise<PilotAccountSnapshot | null> {
    if (!getSupabaseStatus().enabled) {
        return null;
    }

    const user = await ensureSessionUser();
    const identityState = await getLinkedProviders(user);
    const profile = await ensureProfile(user, locale);
    const progress = await ensureProgress(user.id);
    const recentMatches = await loadRecentMatchResults(user.id);

    return {
        userId: user.id,
        callsign: profile.callsign,
        isAnonymous: getAnonymousFlag(user),
        email: identityState.email,
        linkedProviders: identityState.linkedProviders,
        profile,
        progress,
        recentMatches
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

    let recentMatch: PlayerMatchRecord | null = null;
    const { data: historyData, error: historyError } = await client
        .from('match_results')
        .insert({
            player_id: userId,
            mode: result.mode,
            result: result.won ? 'win' : 'loss',
            blue_score: result.blueScore,
            red_score: result.redScore
        })
        .select('id, player_id, mode, result, blue_score, red_score, created_at')
        .single();

    if (historyError) {
        if (!isMissingRelationError(historyError)) {
            console.warn('[supabase] Failed to append match history:', historyError);
        }
    } else if (historyData) {
        recentMatch = historyData as PlayerMatchRecord;
    }

    return {
        matchesPlayed,
        matchesWon,
        xp,
        credits,
        recentMatch
    };
}

export async function linkPilotGoogleIdentity() {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not configured.');
    }

    const { error } = await client.auth.linkIdentity({
        provider: 'google',
        options: {
            redirectTo: getAuthRedirectUrl()
        }
    });

    if (error) {
        throw new Error(describeError(error, 'Failed to start Google account linking.'));
    }
}

export async function sendPilotMagicLinkUpgrade(email: string) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not configured.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
        throw new Error('Email is required.');
    }

    const { error } = await client.auth.updateUser({
        email: normalizedEmail
    }, {
        emailRedirectTo: getAuthRedirectUrl()
    });

    if (error) {
        throw new Error(describeError(error, 'Failed to send Magic Link upgrade email.'));
    }
}

export function subscribePilotAuthChanges(onChange: () => void) {
    const client = getSupabaseClient();
    if (!client) {
        return () => {};
    }

    const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'TOKEN_REFRESHED') {
            return;
        }
        onChange();
    });

    return () => {
        data.subscription.unsubscribe();
    };
}
