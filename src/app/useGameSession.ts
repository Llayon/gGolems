import { useEffect, useRef, useState, type RefObject } from 'react';
import { initGame } from '../core/Engine';
import { registerFirebaseLobby, type FirebaseLobbyRegistration } from '../firebase/lobbyRegistry';
import type { GameMode } from '../gameplay/types';
import { INITIAL_GAME_HUD_STATE, type GameHudState } from '../core/gameHudState';
import type { ChassisId, LoadoutId } from '../mechs/types';
import type { NetworkStartupErrorCode } from '../network/NetworkManager';

export type SessionMode = 'solo' | 'host' | 'client';

type StartupPhase = 'startWorld' | 'createSession' | 'connectToHost';

type StartupFailureCode = NetworkStartupErrorCode | 'timeout' | 'hostIdRequired' | 'unknown';

export type StartupFailure = {
    code: StartupFailureCode;
    phase?: StartupPhase;
    seconds?: number;
    detail?: string;
    cause?: unknown;
};

type SessionGame = Awaited<ReturnType<typeof initGame>>;

function isStartupFailure(error: unknown): error is StartupFailure {
    if (!error || typeof error !== 'object') return false;
    return 'code' in error && typeof (error as { code?: unknown }).code === 'string';
}

function toStartupFailure(error: unknown, phase?: StartupPhase): StartupFailure {
    if (isStartupFailure(error)) {
        return phase && !error.phase
            ? { ...error, phase }
            : error;
    }

    return {
        code: 'unknown',
        phase,
        detail: error instanceof Error ? error.message : undefined,
        cause: error
    };
}

async function withTimeout<T>(
    factory: () => Promise<T>,
    timeoutMs: number,
    timeoutFailure: StartupFailure
): Promise<T> {
    return await Promise.race([
        factory(),
        new Promise<T>((_, reject) => {
            window.setTimeout(() => reject(timeoutFailure), timeoutMs);
        })
    ]);
}

type UseGameSessionArgs = {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    firebaseEnabled: boolean;
    atmosphereEnabled: boolean;
    roomName: string;
    selectedChassisId: ChassisId;
    selectedLoadoutId: LoadoutId;
    releasePointerLock: () => void;
    onStartupFailure: (failure: StartupFailure) => void;
};

export function useGameSession(args: UseGameSessionArgs) {
    const firebaseLobbyRef = useRef<FirebaseLobbyRegistration | null>(null);
    const latestGameRef = useRef<SessionGame | null>(null);
    const latestHudStateRef = useRef<GameHudState>(INITIAL_GAME_HUD_STATE);
    const [loading, setLoading] = useState(false);
    const [inLobby, setInLobby] = useState(true);
    const [myId, setMyId] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [sessionMode, setSessionMode] = useState<SessionMode>('solo');
    const [gameInstance, setGameInstance] = useState<SessionGame | null>(null);
    const [gameState, setGameState] = useState<GameHudState>(INITIAL_GAME_HUD_STATE);

    const leaveGame = (gameOverride?: SessionGame | null) => {
        args.releasePointerLock();

        const activeGame = gameOverride ?? latestGameRef.current;
        activeGame?.stop?.();

        void firebaseLobbyRef.current?.unregister();
        firebaseLobbyRef.current = null;
        latestGameRef.current = null;
        setGameInstance(null);
        setGameState(INITIAL_GAME_HUD_STATE);
        setSessionMode('solo');
        setIsHost(false);
        setMyId('');
        setInLobby(true);
        setLoading(false);
    };

    const startGame = async (mode: SessionMode, targetHostId?: string, requestedMode: GameMode = 'control') => {
        if (!args.canvasRef.current) return;

        setInLobby(false);
        setLoading(true);
        setSessionMode(mode);
        let game: SessionGame | null = null;

        const failStart = (error: unknown) => {
            console.error(error);
            leaveGame(game);
            args.onStartupFailure(toStartupFailure(error));
        };

        try {
            game = await withTimeout(
                async () => {
                    try {
                        return await initGame(args.canvasRef.current!, (state: GameHudState) => {
                            setGameState({ ...state });
                        }, mode, requestedMode, {
                            chassisId: args.selectedChassisId,
                            loadoutId: args.selectedLoadoutId
                        }, {
                            atmosphereEnabled: args.atmosphereEnabled
                        });
                    } catch (error) {
                        throw toStartupFailure(error, 'startWorld');
                    }
                },
                15000,
                { code: 'timeout', phase: 'startWorld', seconds: 15 }
            );

            setGameInstance(game);

            if (mode === 'solo') {
                setMyId('');
                setIsHost(false);
                setLoading(false);
                return;
            }

            if (mode === 'host') {
                const createdHostId = await withTimeout(
                    () => new Promise<string>((resolve, reject) => {
                        game.network.initAsHost(resolve, (error) => reject(toStartupFailure(error, 'createSession')));
                    }),
                    15000,
                    { code: 'timeout', phase: 'createSession', seconds: 15 }
                );
                setMyId(createdHostId);
                setIsHost(true);
                if (args.firebaseEnabled) {
                    firebaseLobbyRef.current = await registerFirebaseLobby(createdHostId, requestedMode, args.roomName);
                }
                setLoading(false);
                return;
            }

            if (targetHostId) {
                game.setClientMode();
                const clientId = await withTimeout(
                    () => new Promise<string>((resolve, reject) => {
                        game.network.initAsClient(targetHostId, resolve, (error) => reject(toStartupFailure(error, 'connectToHost')));
                    }),
                    15000,
                    { code: 'timeout', phase: 'connectToHost', seconds: 15 }
                );
                setMyId(clientId);
                setIsHost(false);
                setLoading(false);
                return;
            }

            throw { code: 'hostIdRequired' } satisfies StartupFailure;
        } catch (error) {
            failStart(error);
        }
    };

    useEffect(() => {
        return () => {
            void firebaseLobbyRef.current?.unregister();
            firebaseLobbyRef.current = null;
        };
    }, []);

    useEffect(() => {
        latestGameRef.current = gameInstance;
    }, [gameInstance]);

    useEffect(() => {
        latestHudStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        if (gameState.teamScores.winner) {
            args.releasePointerLock();
        }
    }, [args.releasePointerLock, gameState.teamScores.winner]);

    useEffect(() => {
        if (!args.firebaseEnabled || !firebaseLobbyRef.current || !isHost || inLobby) {
            return;
        }

        const resolveJoinability = (room: {
            currentPlayers: number;
            maxPlayers: number;
            winner: boolean;
            leadScore: number;
            scoreToWin: number;
        }) => {
            if (room.winner) return 'ended' as const;
            if (room.currentPlayers >= room.maxPlayers) return 'full' as const;
            if (room.scoreToWin > 0 && room.leadScore / room.scoreToWin >= 0.8) return 'closing' as const;
            return 'open' as const;
        };

        const pushLobbyMeta = () => {
            const game = latestGameRef.current;
            const hudState = latestHudStateRef.current;
            const currentPlayers = 1 + (game?.remotePlayers?.size ?? 0);
            const leadScore = Math.max(hudState.teamScores.blue, hudState.teamScores.red);
            const joinability = resolveJoinability({
                currentPlayers,
                maxPlayers: 5,
                winner: hudState.teamScores.winner !== null,
                leadScore,
                scoreToWin: hudState.teamScores.scoreToWin
            });
            void firebaseLobbyRef.current?.updateMeta({
                currentPlayers,
                inProgress: true,
                joinability,
                blueScore: hudState.teamScores.blue,
                redScore: hudState.teamScores.red,
                scoreToWin: hudState.teamScores.scoreToWin
            });
        };

        pushLobbyMeta();
        const timer = window.setInterval(pushLobbyMeta, 2500);
        return () => window.clearInterval(timer);
    }, [args.firebaseEnabled, gameInstance, inLobby, isHost, loading]);

    useEffect(() => {
        return () => {
            if (gameInstance) gameInstance.stop();
        };
    }, [gameInstance]);

    return {
        gameInstance,
        gameState,
        inLobby,
        isHost,
        loading,
        myId,
        sessionMode,
        leaveGame,
        startGame
    };
}
