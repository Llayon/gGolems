import {
    onDisconnect,
    onValue,
    push,
    ref,
    remove,
    serverTimestamp,
    set,
    update,
    type Database
} from 'firebase/database';
import { getFirebaseDatabase } from './client';
import type { GameMode } from '../gameplay/types';

const HEARTBEAT_INTERVAL_MS = 15000;
const ROOM_TTL_MS = 45000;
const ROOM_LIST_REFRESH_MS = 5000;
const SCORE_TO_WIN_BY_MODE: Record<GameMode, number> = {
    control: 200,
    tdm: 30
};

export type LobbyJoinability = 'open' | 'closing' | 'full' | 'ended';

export type FirebaseLobbyRoom = {
    id: string;
    shortCode: string;
    roomName: string;
    hostPeerId: string;
    gameMode: GameMode;
    status: 'open';
    inProgress: boolean;
    currentPlayers: number;
    maxPlayers: number;
    joinability: LobbyJoinability;
    blueScore: number;
    redScore: number;
    scoreToWin: number;
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
};

export type FirebaseLobbyRegistration = {
    roomId: string;
    updateMeta: (meta: {
        currentPlayers?: number;
        inProgress?: boolean;
        joinability?: LobbyJoinability;
        blueScore?: number;
        redScore?: number;
        scoreToWin?: number;
    }) => Promise<void>;
    unregister: () => Promise<void>;
};

type LobbySnapshotValue = {
    shortCode?: string;
    roomName?: string;
    hostPeerId?: string;
    gameMode?: GameMode;
    status?: 'open';
    inProgress?: boolean;
    currentPlayers?: number;
    maxPlayers?: number;
    joinability?: LobbyJoinability;
    blueScore?: number;
    redScore?: number;
    scoreToWin?: number;
    createdAt?: number;
    updatedAt?: number;
    expiresAt?: number;
};

function getLobbyDatabase(): Database | null {
    return getFirebaseDatabase();
}

export function isFirebaseLobbyEnabled() {
    return Boolean(getLobbyDatabase());
}

export async function registerFirebaseLobby(hostPeerId: string, gameMode: GameMode, roomName: string): Promise<FirebaseLobbyRegistration | null> {
    const database = getLobbyDatabase();
    if (!database || !hostPeerId) return null;

    const lobbiesRef = ref(database, 'lobbies');
    const roomRef = push(lobbiesRef);
    const roomId = roomRef.key;
    if (!roomId) return null;

    let heartbeatTimer: number | null = null;
    const now = Date.now();
    const payload = {
        shortCode: roomId.slice(-6).toUpperCase(),
        roomName: roomName.trim().slice(0, 32),
        hostPeerId,
        gameMode,
        status: 'open' as const,
        inProgress: true,
        currentPlayers: 1,
        maxPlayers: 5,
        joinability: 'open' as const,
        blueScore: 0,
        redScore: 0,
        scoreToWin: SCORE_TO_WIN_BY_MODE[gameMode],
        createdAt: now,
        updatedAt: now,
        expiresAt: now + ROOM_TTL_MS,
        serverUpdatedAt: serverTimestamp()
    };

    await set(roomRef, payload);
    await onDisconnect(roomRef).remove();

    heartbeatTimer = window.setInterval(() => {
        const now = Date.now();
        void update(roomRef, {
            updatedAt: now,
            expiresAt: now + ROOM_TTL_MS,
            serverUpdatedAt: serverTimestamp()
        });
    }, HEARTBEAT_INTERVAL_MS);

    return {
        roomId,
        updateMeta: async (meta) => {
            const now = Date.now();
            await update(roomRef, {
                updatedAt: now,
                expiresAt: now + ROOM_TTL_MS,
                serverUpdatedAt: serverTimestamp(),
                ...(typeof meta.currentPlayers === 'number'
                    ? { currentPlayers: Math.max(1, Math.round(meta.currentPlayers)) }
                    : {}),
                ...(typeof meta.inProgress === 'boolean'
                    ? { inProgress: meta.inProgress }
                    : {}),
                ...(meta.joinability
                    ? { joinability: meta.joinability }
                    : {}),
                ...(typeof meta.blueScore === 'number'
                    ? { blueScore: Math.max(0, Math.round(meta.blueScore)) }
                    : {}),
                ...(typeof meta.redScore === 'number'
                    ? { redScore: Math.max(0, Math.round(meta.redScore)) }
                    : {}),
                ...(typeof meta.scoreToWin === 'number'
                    ? { scoreToWin: Math.max(1, Math.round(meta.scoreToWin)) }
                    : {})
            });
        },
        unregister: async () => {
            if (heartbeatTimer !== null) {
                window.clearInterval(heartbeatTimer);
            }
            await remove(roomRef);
        }
    };
}

export function subscribeFirebaseLobbies(onRooms: (rooms: FirebaseLobbyRoom[]) => void) {
    const database = getLobbyDatabase();
    if (!database) {
        onRooms([]);
        return () => {};
    }

    const lobbiesRef = ref(database, 'lobbies');
    let rawRooms: FirebaseLobbyRoom[] = [];

    const emitRooms = () => {
        const now = Date.now();
        const joinabilityRank: Record<LobbyJoinability, number> = {
            open: 0,
            closing: 1,
            full: 2,
            ended: 3
        };
        const visibleRooms = rawRooms
            .filter((room) => room.expiresAt <= 0 || room.expiresAt >= now)
            .sort((left, right) => {
                const rankDelta = joinabilityRank[left.joinability] - joinabilityRank[right.joinability];
                if (rankDelta !== 0) return rankDelta;
                return right.updatedAt - left.updatedAt;
            });
        onRooms(visibleRooms);
    };

    const unsubscribe = onValue(lobbiesRef, (snapshot) => {
        const nextRooms: FirebaseLobbyRoom[] = [];
        snapshot.forEach((child) => {
            const value = child.val() as LobbySnapshotValue | null;
            if (!value || value.status !== 'open' || !value.hostPeerId) return;
            const expiresAt = typeof value.expiresAt === 'number' ? value.expiresAt : 0;

            nextRooms.push({
                id: child.key ?? '',
                shortCode: value.shortCode ?? (child.key ?? '').slice(-6).toUpperCase(),
                roomName: value.roomName?.trim() || value.shortCode || (child.key ?? '').slice(-6).toUpperCase(),
                hostPeerId: value.hostPeerId,
                gameMode: value.gameMode === 'tdm' ? 'tdm' : 'control',
                status: 'open',
                inProgress: value.inProgress !== false,
                currentPlayers: typeof value.currentPlayers === 'number' ? Math.max(1, Math.round(value.currentPlayers)) : 1,
                maxPlayers: typeof value.maxPlayers === 'number' ? Math.max(1, Math.round(value.maxPlayers)) : 5,
                joinability: value.joinability === 'full' || value.joinability === 'ended' || value.joinability === 'closing'
                    ? value.joinability
                    : 'open',
                blueScore: typeof value.blueScore === 'number' ? Math.max(0, Math.round(value.blueScore)) : 0,
                redScore: typeof value.redScore === 'number' ? Math.max(0, Math.round(value.redScore)) : 0,
                scoreToWin: typeof value.scoreToWin === 'number'
                    ? Math.max(1, Math.round(value.scoreToWin))
                    : SCORE_TO_WIN_BY_MODE[value.gameMode === 'tdm' ? 'tdm' : 'control'],
                createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
                updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
                expiresAt
            });
        });

        rawRooms = nextRooms;
        emitRooms();
    });

    const refreshTimer = window.setInterval(() => {
        emitRooms();
    }, ROOM_LIST_REFRESH_MS);

    return () => {
        window.clearInterval(refreshTimer);
        unsubscribe();
    };
}
