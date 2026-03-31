import { useEffect, useState } from 'react';
import { subscribeFirebaseLobbies, type FirebaseLobbyRoom } from '../firebase/lobbyRegistry';

export function useFirebaseLobbyRooms(enabled: boolean, inLobby: boolean) {
    const [rooms, setRooms] = useState<FirebaseLobbyRoom[]>([]);

    useEffect(() => {
        if (!enabled || !inLobby) {
            setRooms([]);
            return;
        }

        return subscribeFirebaseLobbies(setRooms);
    }, [enabled, inLobby]);

    return rooms;
}
