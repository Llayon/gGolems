import type { Locale } from '../i18n/types';

export type PilotAuthSnapshot = {
    userId: string;
    isAnonymous: boolean;
    email: string | null;
    linkedProviders: string[];
};

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
    auth: PilotAuthSnapshot;
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

export type MatchProgressUpdate = {
    matchesPlayed: number;
    matchesWon: number;
    xp: number;
    credits: number;
    recentMatch: PlayerMatchRecord | null;
};
