import type { PlayerMatchRecord } from '../supabase/types';

export type PilotAuthState = {
    status: 'disabled' | 'booting' | 'ready' | 'error';
    userId: string | null;
    isAnonymous: boolean;
    email: string | null;
    linkedProviders: string[];
    error: string;
};

export type PilotProfileState = {
    callsign: string;
};

export type PilotProgressState = {
    matchesPlayed: number;
    matchesWon: number;
    xp: number;
    credits: number;
    recentMatches: PlayerMatchRecord[];
};

export type PilotAccountState = PilotAuthState & PilotProfileState & PilotProgressState;

export type AuthUpgradeBusy = 'idle' | 'google' | 'magic';

export type AuthUpgradeMessage = {
    tone: 'info' | 'success' | 'error';
    text: string;
};

export function createInitialPilotAuthState(enabled: boolean): PilotAuthState {
    return {
        status: enabled ? 'booting' : 'disabled',
        userId: null,
        isAnonymous: true,
        email: null,
        linkedProviders: [],
        error: ''
    };
}

export function createInitialPilotProfileState(): PilotProfileState {
    return {
        callsign: ''
    };
}

export function createInitialPilotProgressState(): PilotProgressState {
    return {
        matchesPlayed: 0,
        matchesWon: 0,
        xp: 0,
        credits: 0,
        recentMatches: []
    };
}

export function composePilotAccountState(
    auth: PilotAuthState,
    profile: PilotProfileState,
    progress: PilotProgressState
): PilotAccountState {
    return {
        ...auth,
        ...profile,
        ...progress
    };
}
