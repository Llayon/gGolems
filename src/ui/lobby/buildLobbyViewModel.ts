import type { FirebaseLobbyRoom, LobbyJoinability } from '../../firebase/lobbyRegistry';
import type { TranslationKey } from '../../i18n';
import type { LobbyLayoutKind, LobbyScreenProps } from './lobbyTypes';

export const lobbyJoinabilityKeys: Record<LobbyJoinability, TranslationKey> = {
    open: 'lobby.joinability.open',
    closing: 'lobby.joinability.closing',
    full: 'lobby.joinability.full',
    ended: 'lobby.joinability.ended'
};

export function canJoinRoom(room: FirebaseLobbyRoom) {
    return room.joinability !== 'full' && room.joinability !== 'ended';
}

export function joinabilityTone(room: FirebaseLobbyRoom) {
    return room.joinability === 'ended'
        ? 'border-[#8a4f44]/55 bg-[#5b231b]/24 text-[#ffb7a6]'
        : room.joinability === 'full'
            ? 'border-[#8f6a38]/55 bg-[#5e451b]/24 text-[#f3d08d]'
            : room.joinability === 'closing'
                ? 'border-[#b57d3c]/60 bg-[#6a4315]/24 text-[#ffd489]'
                : 'border-[#4b7f5b]/55 bg-[#203622]/24 text-[#b8efc0]';
}

export type LobbyViewModel = {
    layoutKind: LobbyLayoutKind;
    filteredFirebaseRooms: FirebaseLobbyRoom[];
    visibleFirebaseRooms: FirebaseLobbyRoom[];
    hiddenUnavailableCount: number;
    directJoinRoom: FirebaseLobbyRoom | undefined;
    directJoinModeKey: TranslationKey | null;
    directJoinStatusKey: TranslationKey;
    directJoinAvailabilityKey: TranslationKey | null;
};

export function buildLobbyViewModel(props: Pick<
    LobbyScreenProps,
    'firebaseRooms' | 'roomFilter' | 'showUnavailableRooms' | 'hostId' | 'isTouchDevice' | 'isPortrait'
>): LobbyViewModel {
    const filteredFirebaseRooms = props.roomFilter === 'all'
        ? props.firebaseRooms
        : props.firebaseRooms.filter((room) => room.gameMode === props.roomFilter);
    const visibleFirebaseRooms = props.showUnavailableRooms
        ? filteredFirebaseRooms
        : filteredFirebaseRooms.filter((room) => canJoinRoom(room));
    const directJoinRoom = props.firebaseRooms.find(
        (room) => room.hostPeerId.trim().toLowerCase() === props.hostId.trim().toLowerCase()
    );
    const layoutKind: LobbyLayoutKind = props.isTouchDevice
        ? (props.isPortrait ? 'mobilePortrait' : 'mobileLandscape')
        : 'desktop';

    return {
        layoutKind,
        filteredFirebaseRooms,
        visibleFirebaseRooms,
        hiddenUnavailableCount: filteredFirebaseRooms.length - visibleFirebaseRooms.length,
        directJoinRoom,
        directJoinModeKey: directJoinRoom
            ? directJoinRoom.gameMode === 'tdm'
                ? 'lobby.mode.tdm'
                : 'lobby.mode.control'
            : null,
        directJoinStatusKey: directJoinRoom?.inProgress ? 'lobby.roomState.live' : 'lobby.roomState.open',
        directJoinAvailabilityKey: directJoinRoom ? lobbyJoinabilityKeys[directJoinRoom.joinability] : null
    };
}
