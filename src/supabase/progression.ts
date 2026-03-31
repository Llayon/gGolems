import { getSupabaseClient } from './client';
import type { MatchProgressUpdate, MatchRecordInput, PlayerMatchRecord, PlayerProgress } from './types';
import { describeError, isMissingRelationError } from './utils';

function calculateRewards(result: MatchRecordInput) {
    return {
        xp: result.won ? 125 : 55,
        credits: result.won ? 60 : 25,
        outcome: result.won ? 'win' as const : 'loss' as const
    };
}

function canFallbackToDirectProgressWrite(error: unknown) {
    const message = describeError(error, '').toLowerCase();
    return message.includes('404')
        || message.includes('not found')
        || message.includes('failed to fetch')
        || message.includes('network')
        || message.includes('cors')
        || message.includes('edge function');
}

async function invokeFinishMatchFunction(result: MatchRecordInput): Promise<MatchProgressUpdate | null> {
    const client = getSupabaseClient();
    if (!client) {
        return null;
    }

    const { data, error } = await client.functions.invoke('finish-match', {
        body: result
    });

    if (error) {
        if (canFallbackToDirectProgressWrite(error)) {
            console.warn('[supabase] Edge function finish-match unavailable, falling back to direct write:', error);
            return null;
        }
        throw new Error(describeError(error, 'Failed to record pilot match via Edge Function.'));
    }

    if (!data || typeof data !== 'object') {
        return null;
    }

    return data as MatchProgressUpdate;
}

export async function ensurePilotProgress(userId: string): Promise<PlayerProgress> {
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

export async function loadRecentMatchResults(userId: string, limit = 5): Promise<PlayerMatchRecord[]> {
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
        if (!isMissingRelationError(error, 'match_results')) {
            console.warn('[supabase] Failed to load match history:', error);
        }
        return [];
    }

    return (data ?? []) as PlayerMatchRecord[];
}

export async function recordPilotMatch(userId: string, result: MatchRecordInput): Promise<MatchProgressUpdate | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    const functionResult = await invokeFinishMatchFunction(result);
    if (functionResult) {
        return functionResult;
    }

    const { data: existing, error: loadError } = await client
        .from('player_progress')
        .select('matches_played, matches_won, xp, credits')
        .eq('player_id', userId)
        .maybeSingle();

    if (loadError) {
        throw new Error(describeError(loadError, 'Failed to load pilot progress before recording match.'));
    }

    const rewards = calculateRewards(result);
    const now = new Date().toISOString();
    const matchesPlayed = (existing?.matches_played ?? 0) + 1;
    const matchesWon = (existing?.matches_won ?? 0) + (result.won ? 1 : 0);
    const xp = (existing?.xp ?? 0) + rewards.xp;
    const credits = (existing?.credits ?? 0) + rewards.credits;

    const { error } = await client.from('player_progress').upsert({
        player_id: userId,
        matches_played: matchesPlayed,
        matches_won: matchesWon,
        xp,
        credits,
        last_match_mode: result.mode,
        last_match_result: rewards.outcome,
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
            result: rewards.outcome,
            blue_score: result.blueScore,
            red_score: result.redScore
        })
        .select('id, player_id, mode, result, blue_score, red_score, created_at')
        .single();

    if (historyError) {
        if (!isMissingRelationError(historyError, 'match_results')) {
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
