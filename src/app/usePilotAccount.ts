import { useEffect, useRef, useState } from 'react';
import type { GameMode, TeamScoreState } from '../gameplay/types';
import { subscribePilotAuthChanges, linkPilotGoogleIdentity, sendPilotMagicLinkUpgrade } from '../supabase/auth';
import { getSupabaseStatus } from '../supabase/client';
import { bootstrapPilotAccount } from '../supabase/pilotAccount';
import { syncPilotLocale } from '../supabase/profile';
import { recordPilotMatch } from '../supabase/progression';
import type { Locale } from '../i18n/types';
import {
    type AuthUpgradeBusy,
    type AuthUpgradeMessage,
    composePilotAccountState,
    createInitialPilotAuthState,
    createInitialPilotProfileState,
    createInitialPilotProgressState,
    type PilotAuthState,
    type PilotProfileState,
    type PilotProgressState
} from './pilotAccountState';

function describeError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return typeof error === 'string' ? error : fallback;
}

type UsePilotAccountArgs = {
    locale: Locale;
    inLobby: boolean;
    gameMode: GameMode;
    teamScores: TeamScoreState;
    messages: {
        googleRedirect: string;
        googleFailed: string;
        magicSending: string;
        magicSent: string;
        magicFailed: string;
    };
};

export function usePilotAccount(args: UsePilotAccountArgs) {
    const supabaseStatus = getSupabaseStatus();
    const recordedMatchRef = useRef<string | null>(null);
    const [pilotAuth, setPilotAuth] = useState<PilotAuthState>(() => createInitialPilotAuthState(supabaseStatus.enabled));
    const [pilotProfile, setPilotProfile] = useState<PilotProfileState>(() => createInitialPilotProfileState());
    const [pilotProgress, setPilotProgress] = useState<PilotProgressState>(() => createInitialPilotProgressState());
    const [authUpgradeEmail, setAuthUpgradeEmail] = useState('');
    const [authUpgradeBusy, setAuthUpgradeBusy] = useState<AuthUpgradeBusy>('idle');
    const [authUpgradeMessage, setAuthUpgradeMessage] = useState<AuthUpgradeMessage | null>(null);

    const refreshPilotAccount = async (mode: 'boot' | 'refresh' = 'refresh') => {
        if (!supabaseStatus.enabled) {
            setPilotAuth(createInitialPilotAuthState(false));
            setPilotProfile(createInitialPilotProfileState());
            setPilotProgress(createInitialPilotProgressState());
            return;
        }

        if (mode === 'boot') {
            setPilotAuth(createInitialPilotAuthState(true));
            setPilotProfile(createInitialPilotProfileState());
            setPilotProgress(createInitialPilotProgressState());
        }

        try {
            const snapshot = await bootstrapPilotAccount(args.locale);

            if (!snapshot) {
                setPilotAuth(createInitialPilotAuthState(false));
                setPilotProfile(createInitialPilotProfileState());
                setPilotProgress(createInitialPilotProgressState());
                return;
            }

            setAuthUpgradeBusy('idle');
            if (!snapshot.auth.isAnonymous) {
                setAuthUpgradeEmail('');
                setAuthUpgradeMessage(null);
            }

            setPilotAuth({
                status: 'ready',
                userId: snapshot.auth.userId,
                isAnonymous: snapshot.auth.isAnonymous,
                email: snapshot.auth.email,
                linkedProviders: snapshot.auth.linkedProviders,
                error: ''
            });
            setPilotProfile({
                callsign: snapshot.profile.callsign
            });
            setPilotProgress({
                matchesPlayed: snapshot.progress.matches_played,
                matchesWon: snapshot.progress.matches_won,
                xp: snapshot.progress.xp,
                credits: snapshot.progress.credits,
                recentMatches: snapshot.recentMatches
            });
        } catch (error) {
            setPilotAuth({
                ...createInitialPilotAuthState(true),
                status: 'error',
                error: describeError(error, 'Supabase bootstrap failed.')
            });
            setPilotProfile(createInitialPilotProfileState());
            setPilotProgress(createInitialPilotProgressState());
        }
    };

    const startGoogleUpgrade = async () => {
        if (pilotAuth.status !== 'ready' || !pilotAuth.isAnonymous) return;

        setAuthUpgradeBusy('google');
        setAuthUpgradeMessage({
            tone: 'info',
            text: args.messages.googleRedirect
        });

        try {
            await linkPilotGoogleIdentity();
        } catch (error) {
            setAuthUpgradeBusy('idle');
            setAuthUpgradeMessage({
                tone: 'error',
                text: describeError(error, args.messages.googleFailed)
            });
        }
    };

    const sendMagicLinkUpgrade = async () => {
        if (pilotAuth.status !== 'ready' || !pilotAuth.isAnonymous) return;

        setAuthUpgradeBusy('magic');
        setAuthUpgradeMessage({
            tone: 'info',
            text: args.messages.magicSending
        });

        try {
            await sendPilotMagicLinkUpgrade(authUpgradeEmail);
            setAuthUpgradeMessage({
                tone: 'success',
                text: args.messages.magicSent
            });
        } catch (error) {
            setAuthUpgradeMessage({
                tone: 'error',
                text: describeError(error, args.messages.magicFailed)
            });
        } finally {
            setAuthUpgradeBusy('idle');
        }
    };

    useEffect(() => {
        if (!supabaseStatus.enabled) {
            setPilotAuth(createInitialPilotAuthState(false));
            setPilotProfile(createInitialPilotProfileState());
            setPilotProgress(createInitialPilotProgressState());
            return;
        }

        let cancelled = false;

        void (async () => {
            await refreshPilotAccount('boot');
            if (cancelled) return;
        })();

        return () => {
            cancelled = true;
        };
    }, [supabaseStatus.enabled]);

    useEffect(() => {
        if (!supabaseStatus.enabled) {
            return;
        }

        return subscribePilotAuthChanges(() => {
            void refreshPilotAccount();
        });
    }, [supabaseStatus.enabled, args.locale]);

    useEffect(() => {
        if (pilotAuth.status !== 'ready' || !pilotAuth.userId) {
            return;
        }

        void syncPilotLocale(pilotAuth.userId, args.locale).catch((error) => {
            console.warn('[supabase] Failed to sync locale:', error);
        });
    }, [args.locale, pilotAuth.status, pilotAuth.userId]);

    useEffect(() => {
        if (pilotAuth.status !== 'ready' || !pilotAuth.userId || args.inLobby) {
            return;
        }

        const winner = args.teamScores.winner;
        if (!winner) {
            recordedMatchRef.current = null;
            return;
        }

        const signature = `${args.gameMode}:${winner}:${args.teamScores.blue}:${args.teamScores.red}`;
        if (recordedMatchRef.current === signature) {
            return;
        }
        recordedMatchRef.current = signature;

        void recordPilotMatch(pilotAuth.userId, {
            mode: args.gameMode,
            won: winner === 'blue',
            blueScore: args.teamScores.blue,
            redScore: args.teamScores.red
        }).then((snapshot) => {
            if (!snapshot) return;
            setPilotProgress((current) => ({
                ...current,
                matchesPlayed: snapshot.matchesPlayed,
                matchesWon: snapshot.matchesWon,
                xp: snapshot.xp,
                credits: snapshot.credits,
                recentMatches: snapshot.recentMatch
                    ? [snapshot.recentMatch, ...current.recentMatches.filter((match) => match.id !== snapshot.recentMatch?.id)].slice(0, 5)
                    : current.recentMatches
            }));
        }).catch((error) => {
            console.warn('[supabase] Failed to record match:', error);
        });
    }, [args.gameMode, args.inLobby, args.teamScores, pilotAuth.status, pilotAuth.userId]);

    return {
        account: composePilotAccountState(pilotAuth, pilotProfile, pilotProgress),
        authUpgradeEmail,
        setAuthUpgradeEmail,
        authUpgradeBusy,
        authUpgradeMessage,
        startGoogleUpgrade,
        sendMagicLinkUpgrade
    };
}
