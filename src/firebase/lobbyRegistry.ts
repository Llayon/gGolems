import {
    onDisconnect,
    onValue,
    push,
    ref,
    remove,
    serverTimestamp,
    set,
    type Database
} from 'firebase/database';
import { getFirebaseDatabase } from './client';

export type FirebaseLobbyRoom = {
    id: string;
    shortCode: string;
    hostPeerId: string;
    status: 'open';
    createdAt: number;
    updatedAt: number;
};

export type FirebaseLobbyRegistration = {
    roomId: string;
    unregister: () => Promise<void>;
};

type LobbySnapshotValue = {
    shortCode?: string;
    hostPeerId?: string;
    status?: 'open';
    createdAt?: number;
    updatedAt?: number;
};

function getLobbyDatabase(): Database | null {
    return getFirebaseDatabase();
}

export function isFirebaseLobbyEnabled() {
    return Boolean(getLobbyDatabase());
}

export async function registerFirebaseLobby(hostPeerId: string): Promise<FirebaseLobbyRegistration | null> {
    const database = getLobbyDatabase();
    if (!database || !hostPeerId) return null;

    const lobbiesRef = ref(database, 'lobbies');
    const roomRef = push(lobbiesRef);
    const roomId = roomRef.key;
    if (!roomId) return null;

    const payload = {
        shortCode: roomId.slice(-6).toUpperCase(),
        hostPeerId,
        status: 'open' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await set(roomRef, payload);
    await onDisconnect(roomRef).remove();

    return {
        roomId,
        unregister: async () => {
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

    return onValue(lobbiesRef, (snapshot) => {
        const rooms: FirebaseLobbyRoom[] = [];
        snapshot.forEach((child) => {
            const value = child.val() as LobbySnapshotValue | null;
            if (!value || value.status !== 'open' || !value.hostPeerId) return;

            rooms.push({
                id: child.key ?? '',
                shortCode: value.shortCode ?? (child.key ?? '').slice(-6).toUpperCase(),
                hostPeerId: value.hostPeerId,
                status: 'open',
                createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
                updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0
            });
        });

        rooms.sort((left, right) => right.updatedAt - left.updatedAt);
        onRooms(rooms);
    });
}

