import { joinabilityTone, lobbyJoinabilityKeys, canJoinRoom } from './buildLobbyViewModel';
import { LobbySectionCard } from './LobbySectionCard';
import type { LobbyScreenProps } from './lobbyTypes';

type LobbyRoomBrowserSectionProps = Pick<
    LobbyScreenProps,
    't' | 'firebaseEnabled' | 'firebaseMissingKeys' | 'roomFilter' | 'onRoomFilterChange' | 'showUnavailableRooms' | 'onToggleUnavailableRooms' | 'onStartClient'
> & {
    visibleFirebaseRooms: LobbyScreenProps['firebaseRooms'];
    hiddenUnavailableCount: number;
    showTitle?: boolean;
};

export function LobbyRoomBrowserSection(props: LobbyRoomBrowserSectionProps) {
    if (!props.firebaseEnabled) {
        return (
            <LobbySectionCard title={props.t('lobby.availableRooms')} showTitle={props.showTitle}>
                <div className="rounded-xl border border-[#8f6a38]/20 bg-black/25 px-4 py-3 text-center text-[11px] tracking-[0.18em] text-[#b9c7c8]">
                    <div>{props.t('lobby.firebaseDisabled')}</div>
                    {props.firebaseMissingKeys.length > 0 ? (
                        <div className="mt-2 text-[10px] tracking-[0.12em] text-[#8fb8c2]">
                            {props.firebaseMissingKeys.join(', ')}
                        </div>
                    ) : null}
                </div>
            </LobbySectionCard>
        );
    }

    return (
        <LobbySectionCard title={props.t('lobby.availableRooms')} showTitle={props.showTitle}>
            <div className="grid grid-cols-3 gap-2">
                <button
                    type="button"
                    onClick={() => props.onRoomFilterChange('all')}
                    className={`rounded-xl border px-2 py-2 text-[10px] font-bold tracking-[0.16em] transition-colors ${props.roomFilter === 'all' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                >
                    {props.t('lobby.filter.all')}
                </button>
                <button
                    type="button"
                    onClick={() => props.onRoomFilterChange('control')}
                    className={`rounded-xl border px-2 py-2 text-[10px] font-bold tracking-[0.16em] transition-colors ${props.roomFilter === 'control' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                >
                    {props.t('lobby.mode.control')}
                </button>
                <button
                    type="button"
                    onClick={() => props.onRoomFilterChange('tdm')}
                    className={`rounded-xl border px-2 py-2 text-[10px] font-bold tracking-[0.16em] transition-colors ${props.roomFilter === 'tdm' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                >
                    {props.t('lobby.mode.tdm')}
                </button>
            </div>
            <button
                type="button"
                onClick={props.onToggleUnavailableRooms}
                className={`mt-3 w-full rounded-xl border px-3 py-2 text-[10px] font-bold tracking-[0.16em] transition-colors ${props.showUnavailableRooms ? 'border-[#efb768]/70 bg-[#7d4f22]/45 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
            >
                {props.t(props.showUnavailableRooms ? 'lobby.hideUnavailable' : 'lobby.showUnavailable')}
            </button>
            {props.visibleFirebaseRooms.length > 0 ? (
                <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                    {props.visibleFirebaseRooms.slice(0, 8).map((room) => (
                        <button
                            key={room.id}
                            type="button"
                            disabled={!canJoinRoom(room)}
                            onClick={() => props.onStartClient(room.hostPeerId, room.gameMode)}
                            className="rounded-xl border border-[#8f6a38]/35 bg-black/35 px-4 py-3 text-left transition-colors hover:border-[#efb768]/60 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <div className="text-[10px] tracking-[0.26em] text-[#8fb8c2]">{props.t('lobby.roomCode')}</div>
                            <div className="mt-1 truncate text-[12px] font-bold tracking-[0.16em] text-[#f3deb5]">{room.roomName}</div>
                            <div className="mt-1 flex items-center justify-between gap-3">
                                <div className="font-bold tracking-[0.22em] text-[#efb768]">{room.shortCode}</div>
                                <div className="rounded-full border border-[#8f6a38]/45 bg-black/30 px-2 py-1 text-[9px] tracking-[0.18em] text-[#d7c5a1]">
                                    {props.t(room.gameMode === 'tdm' ? 'lobby.mode.tdm' : 'lobby.mode.control')}
                                </div>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3 text-[10px] tracking-[0.16em] text-[#bfa987]">
                                <div>{props.t('lobby.playerCount', { current: room.currentPlayers, max: room.maxPlayers })}</div>
                                <div>{props.t(room.inProgress ? 'lobby.roomState.live' : 'lobby.roomState.open')}</div>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3 text-[10px] tracking-[0.16em]">
                                <div className={`rounded-full border px-2 py-1 ${joinabilityTone(room)}`}>
                                    {props.t(lobbyJoinabilityKeys[room.joinability])}
                                </div>
                                <div className="text-[#d7c5a1]">
                                    {props.t('lobby.scoreSummary', {
                                        blue: room.blueScore,
                                        red: room.redScore,
                                        target: room.scoreToWin
                                    })}
                                </div>
                            </div>
                            <div className="mt-1 truncate text-[11px] tracking-[0.16em] text-[#d7c5a1]">{room.hostPeerId}</div>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="mt-3 rounded-xl border border-[#8f6a38]/20 bg-black/25 px-4 py-3 text-center text-[11px] tracking-[0.18em] text-[#b9c7c8]">
                    {props.roomFilter === 'all'
                        ? (props.showUnavailableRooms ? props.t('lobby.noRooms') : props.t('lobby.noJoinableRooms'))
                        : props.t('lobby.noRoomsFiltered')}
                </div>
            )}
            {!props.showUnavailableRooms && props.hiddenUnavailableCount > 0 ? (
                <div className="mt-3 text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                    {props.t('lobby.hiddenUnavailable', { count: props.hiddenUnavailableCount })}
                </div>
            ) : null}
            <div className="mt-3 text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                {props.t('lobby.firebaseOptional')}
            </div>
        </LobbySectionCard>
    );
}
