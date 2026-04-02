import type { TranslationKey } from '../../i18n';
import { canJoinRoom } from './buildLobbyViewModel';
import { LobbySectionCard } from './LobbySectionCard';
import type { LobbyScreenProps } from './lobbyTypes';

type LobbySessionSectionProps = Pick<
    LobbyScreenProps,
    't' | 'roomName' | 'onRoomNameChange' | 'onStartSolo' | 'onStartHost' | 'hostId' | 'onHostIdChange' | 'onStartClient' | 'selectedGameMode' | 'firebaseEnabled'
> & {
    directJoinRoom?: LobbyScreenProps['firebaseRooms'][number];
    directJoinModeKey: TranslationKey | null;
    directJoinStatusKey: TranslationKey;
    directJoinAvailabilityKey: TranslationKey | null;
};

export function LobbySessionSection(props: LobbySessionSectionProps) {
    return (
        <LobbySectionCard title={props.t('common.network')}>
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                    <div className="text-center text-[10px] tracking-[0.22em] text-[#8fb8c2]">{props.t('lobby.roomNameTitle')}</div>
                    <input
                        type="text"
                        placeholder={props.t('lobby.roomNamePlaceholder')}
                        value={props.roomName}
                        maxLength={32}
                        onChange={(event) => props.onRoomNameChange(event.target.value)}
                        className="rounded border border-[#8f6a38]/40 bg-black/65 px-4 py-2 text-[#f5dba8] outline-none focus:border-[#efb768]"
                    />
                    <div className="text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                        {props.t('lobby.roomNameHint')}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={props.onStartSolo}
                    className="rounded bg-[#7d4f22] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(125,79,34,0.35)] transition-colors hover:bg-[#99622d]"
                >
                    {props.t('lobby.soloBot')}
                </button>

                <button
                    type="button"
                    onClick={props.onStartHost}
                    className="rounded bg-[#b0622d] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(176,98,45,0.35)] transition-colors hover:bg-[#ca7240]"
                >
                    {props.t('lobby.createSession')}
                </button>

                <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-[#8f6a38]/30" />
                    <span className="text-sm tracking-[0.35em] text-[#d2b78d]/60">{props.t('common.or')}</span>
                    <div className="h-px flex-1 bg-[#8f6a38]/30" />
                </div>

                <div className="flex flex-col gap-2">
                    <div className="text-center text-[10px] tracking-[0.22em] text-[#8fb8c2]">{props.t('lobby.directJoinTitle')}</div>
                    <input
                        type="text"
                        placeholder={props.t('lobby.hostIdPlaceholder')}
                        value={props.hostId}
                        onChange={(event) => props.onHostIdChange(event.target.value)}
                        className="rounded border border-[#8f6a38]/40 bg-black/65 px-4 py-2 text-[#f5dba8] outline-none focus:border-[#efb768]"
                    />
                    <button
                        type="button"
                        onClick={() => props.onStartClient(props.hostId, props.selectedGameMode)}
                        disabled={!props.hostId || (props.directJoinRoom ? !canJoinRoom(props.directJoinRoom) : false)}
                        className="rounded bg-[#24677e] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(36,103,126,0.35)] transition-colors hover:bg-[#2f7d99] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {props.t('lobby.connect')}
                    </button>
                    {props.hostId.trim() ? (
                        <div className="text-center text-[11px] tracking-[0.14em] text-[#d7c5a1]">
                            {props.directJoinModeKey
                                ? props.t('lobby.directJoinResolved', {
                                    mode: props.t(props.directJoinModeKey),
                                    players: props.directJoinRoom?.currentPlayers ?? 1,
                                    max: props.directJoinRoom?.maxPlayers ?? 5,
                                    state: `${props.t(props.directJoinStatusKey)} / ${props.t(props.directJoinAvailabilityKey ?? 'lobby.joinability.open')}`
                                })
                                : props.firebaseEnabled
                                    ? props.t('lobby.directJoinUnknown')
                                    : props.t('lobby.directJoinHint')}
                        </div>
                    ) : null}
                    <div className="text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                        {props.t('lobby.directJoinHint')}
                    </div>
                </div>
            </div>
        </LobbySectionCard>
    );
}
