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

export type FirebaseLobbyRoom = {
    id: string;
    shortCode: string;
    hostPeerId: string;
    gameMode: GameMode;
    status: 'open';
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
};

export type FirebaseLobbyRegistration = {
    roomId: string;
    unregister: () => Promise<void>;
};

type LobbySnapshotValue = {
    shortCode?: string;
    hostPeerId?: string;
    gameMode?: GameMode;
    status?: 'open';
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

export async function registerFirebaseLobby(hostPeerId: string, gameMode: GameMode): Promise<FirebaseLobbyRegistration | null> {
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
        hostPeerId,
        gameMode,
        status: 'open' as const,
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
        const visibleRooms = rawRooms
            .filter((room) => room.expiresAt <= 0 || room.expiresAt >= now)
            .sort((left, right) => right.updatedAt - left.updatedAt);
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
                hostPeerId: value.hostPeerId,
                gameMode: value.gameMode === 'tdm' ? 'tdm' : 'control',
                status: 'open',
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
