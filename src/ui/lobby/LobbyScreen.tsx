import type { PilotAccountState, AuthUpgradeBusy, AuthUpgradeMessage } from '../../app/pilotAccountState';
import type { FirebaseLobbyRoom, LobbyJoinability } from '../../firebase/lobbyRegistry';
import type { GameMode } from '../../gameplay/types';
import { type TranslationKey, type Translator } from '../../i18n';
import type { Locale } from '../../i18n/types';
import type { ChassisDefinition, ChassisId, LoadoutDefinition, LoadoutId } from '../../mechs/types';
import { PilotAccountCard } from './PilotAccountCard';

const lobbyJoinabilityKeys: Record<LobbyJoinability, TranslationKey> = {
    open: 'lobby.joinability.open',
    closing: 'lobby.joinability.closing',
    full: 'lobby.joinability.full',
    ended: 'lobby.joinability.ended'
};

type LobbyScreenProps = {
    locale: Locale;
    localeLabel: string;
    t: Translator;
    selectedGameMode: GameMode;
    onSelectGameMode: (mode: GameMode) => void;
    availableChassis: ChassisDefinition[];
    selectedChassisId: ChassisId;
    selectedChassis: ChassisDefinition;
    onSelectChassis: (chassisId: ChassisId) => void;
    availableLoadouts: LoadoutDefinition[];
    selectedLoadoutId: LoadoutId;
    selectedLoadout: LoadoutDefinition;
    onSelectLoadout: (loadoutId: LoadoutId) => void;
    pilotAccount: PilotAccountState;
    authEmail: string;
    authBusy: AuthUpgradeBusy;
    authMessage: AuthUpgradeMessage | null;
    onAuthEmailChange: (value: string) => void;
    onLinkGoogle: () => void;
    onSendMagicLink: () => void;
    roomName: string;
    onRoomNameChange: (value: string) => void;
    onStartSolo: () => void;
    onStartHost: () => void;
    hostId: string;
    onHostIdChange: (value: string) => void;
    onStartClient: (hostId: string, mode: GameMode) => void;
    firebaseEnabled: boolean;
    firebaseMissingKeys: string[];
    firebaseRooms: FirebaseLobbyRoom[];
    roomFilter: 'all' | GameMode;
    onRoomFilterChange: (filter: 'all' | GameMode) => void;
    showUnavailableRooms: boolean;
    onToggleUnavailableRooms: () => void;
    onToggleLocale: () => void;
};

function canJoinRoom(room: FirebaseLobbyRoom) {
    return room.joinability !== 'full' && room.joinability !== 'ended';
}

function joinabilityTone(room: FirebaseLobbyRoom) {
    return room.joinability === 'ended'
        ? 'border-[#8a4f44]/55 bg-[#5b231b]/24 text-[#ffb7a6]'
        : room.joinability === 'full'
            ? 'border-[#8f6a38]/55 bg-[#5e451b]/24 text-[#f3d08d]'
            : room.joinability === 'closing'
                ? 'border-[#b57d3c]/60 bg-[#6a4315]/24 text-[#ffd489]'
                : 'border-[#4b7f5b]/55 bg-[#203622]/24 text-[#b8efc0]';
}

export function LobbyScreen(props: LobbyScreenProps) {
    const filteredFirebaseRooms = props.roomFilter === 'all'
        ? props.firebaseRooms
        : props.firebaseRooms.filter((room) => room.gameMode === props.roomFilter);
    const visibleFirebaseRooms = props.showUnavailableRooms
        ? filteredFirebaseRooms
        : filteredFirebaseRooms.filter((room) => canJoinRoom(room));
    const hiddenUnavailableCount = filteredFirebaseRooms.length - visibleFirebaseRooms.length;
    const directJoinRoom = props.firebaseRooms.find((room) => room.hostPeerId.trim().toLowerCase() === props.hostId.trim().toLowerCase());
    const directJoinModeKey = directJoinRoom
        ? directJoinRoom.gameMode === 'tdm'
            ? 'lobby.mode.tdm'
            : 'lobby.mode.control'
        : null;
    const directJoinStatusKey = directJoinRoom?.inProgress ? 'lobby.roomState.live' : 'lobby.roomState.open';
    const directJoinAvailabilityKey = directJoinRoom ? lobbyJoinabilityKeys[directJoinRoom.joinability] : null;

    return (
        <div className="absolute inset-0 z-50 overflow-y-auto bg-[radial-gradient(circle_at_center,#2a1c12_0%,#130e0b_60%,#090807_100%)] px-4 py-4 text-white sm:py-6">
            <div className="flex min-h-full flex-col items-center justify-start">
                <button
                    type="button"
                    onClick={props.onToggleLocale}
                    className="sticky top-0 z-10 ml-auto rounded-full border border-[#8f6a38]/55 bg-black/65 px-4 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a] backdrop-blur-sm transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                >
                    {props.localeLabel}
                </button>

                <h1 className="mb-5 mt-4 text-center text-2xl font-bold tracking-[0.22em] text-[#efb768] drop-shadow-[0_0_14px_rgba(239,183,104,0.45)] sm:mb-8 sm:mt-6 sm:text-4xl sm:tracking-[0.35em]">
                    {props.t('lobby.title')}
                </h1>

                <div className="flex w-[min(92vw,24rem)] max-w-full flex-col gap-5 rounded-2xl border border-[#8f6a38]/40 bg-black/45 p-5 backdrop-blur-sm sm:gap-6 sm:p-8">
                    <div className="flex flex-col gap-2">
                        <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{props.t('lobby.modeTitle')}</div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => props.onSelectGameMode('control')}
                                className={`rounded-xl border px-4 py-3 text-[11px] font-bold tracking-[0.18em] transition-colors ${props.selectedGameMode === 'control' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                            >
                                {props.t('lobby.mode.control')}
                            </button>
                            <button
                                type="button"
                                onClick={() => props.onSelectGameMode('tdm')}
                                className={`rounded-xl border px-4 py-3 text-[11px] font-bold tracking-[0.18em] transition-colors ${props.selectedGameMode === 'tdm' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                            >
                                {props.t('lobby.mode.tdm')}
                            </button>
                        </div>
                        <div className="text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                            {props.t(props.selectedGameMode === 'control' ? 'lobby.modeHint.control' : 'lobby.modeHint.tdm')}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{props.t('lobby.frameTitle')}</div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {props.availableChassis.map((chassis) => (
                                <button
                                    key={chassis.id}
                                    type="button"
                                    onClick={() => props.onSelectChassis(chassis.id)}
                                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                                        props.selectedChassisId === chassis.id
                                            ? 'border-[#efb768]/80 bg-[#7d4f22]/40 text-[#fff1d4]'
                                            : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'
                                    }`}
                                >
                                    <div className="text-[11px] font-bold tracking-[0.18em]">{chassis.name}</div>
                                    <div className="mt-1 text-[9px] tracking-[0.18em] text-[#8fb8c2]">
                                        {props.t(`lobby.weight.${chassis.weightClass}` as TranslationKey)} В· {chassis.familyId.toUpperCase()}
                                    </div>
                                    <div className="mt-2 text-[10px] leading-4 tracking-[0.08em] text-[#cdbb97]">
                                        {chassis.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="rounded-xl border border-[#8f6a38]/25 bg-black/25 px-4 py-3 text-[11px] tracking-[0.12em] text-[#cdbb97]">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span>{props.selectedChassis.name}</span>
                                <span className="text-[#8fb8c2]">
                                    {props.t('lobby.chassisStats', {
                                        speed: props.selectedChassis.topSpeed.toFixed(1),
                                        steam: props.selectedChassis.maxSteam,
                                        mass: props.selectedChassis.mass.toFixed(1)
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{props.t('lobby.loadoutTitle')}</div>
                        <div className="grid grid-cols-1 gap-2">
                            {props.availableLoadouts.map((loadout) => (
                                <button
                                    key={loadout.id}
                                    type="button"
                                    onClick={() => props.onSelectLoadout(loadout.id)}
                                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                                        props.selectedLoadoutId === loadout.id
                                            ? 'border-[#efb768]/80 bg-[#7d4f22]/40 text-[#fff1d4]'
                                            : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-[11px] font-bold tracking-[0.18em]">{loadout.name}</div>
                                        <div className="text-[9px] tracking-[0.18em] text-[#8fb8c2]">
                                            {loadout.assignments.map((assignment) => assignment.weaponId.replace('_', ' ')).join(' / ')}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[10px] leading-4 tracking-[0.08em] text-[#cdbb97]">
                                        {loadout.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                            {props.t('lobby.loadoutHint', { loadout: props.selectedLoadout.name })}
                        </div>
                    </div>

                    <PilotAccountCard
                        account={props.pilotAccount}
                        locale={props.locale}
                        authEmail={props.authEmail}
                        authBusy={props.authBusy}
                        authMessage={props.authMessage}
                        t={props.t}
                        onAuthEmailChange={props.onAuthEmailChange}
                        onLinkGoogle={props.onLinkGoogle}
                        onSendMagicLink={props.onSendMagicLink}
                    />

                    <div className="flex flex-col gap-2">
                        <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{props.t('lobby.roomNameTitle')}</div>
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
                        onClick={props.onStartSolo}
                        className="rounded bg-[#7d4f22] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(125,79,34,0.35)] transition-colors hover:bg-[#99622d]"
                    >
                        {props.t('lobby.soloBot')}
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-[#8f6a38]/30" />
                        <span className="text-sm tracking-[0.35em] text-[#d2b78d]/60">{props.t('common.network')}</span>
                        <div className="h-px flex-1 bg-[#8f6a38]/30" />
                    </div>

                    <button
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
                        <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{props.t('lobby.directJoinTitle')}</div>
                        <input
                            type="text"
                            placeholder={props.t('lobby.hostIdPlaceholder')}
                            value={props.hostId}
                            onChange={(event) => props.onHostIdChange(event.target.value)}
                            className="rounded border border-[#8f6a38]/40 bg-black/65 px-4 py-2 text-[#f5dba8] outline-none focus:border-[#efb768]"
                        />
                        <button
                            onClick={() => props.onStartClient(props.hostId, props.selectedGameMode)}
                            disabled={!props.hostId || (directJoinRoom ? !canJoinRoom(directJoinRoom) : false)}
                            className="rounded bg-[#24677e] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(36,103,126,0.35)] transition-colors hover:bg-[#2f7d99] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {props.t('lobby.connect')}
                        </button>
                        {props.hostId.trim() ? (
                            <div className="text-center text-[11px] tracking-[0.14em] text-[#d7c5a1]">
                                {directJoinModeKey
                                    ? props.t('lobby.directJoinResolved', {
                                        mode: props.t(directJoinModeKey),
                                        players: directJoinRoom?.currentPlayers ?? 1,
                                        max: directJoinRoom?.maxPlayers ?? 5,
                                        state: `${props.t(directJoinStatusKey)} / ${props.t(directJoinAvailabilityKey ?? lobbyJoinabilityKeys.open)}`
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

                    {props.firebaseEnabled ? (
                        <div className="flex flex-col gap-2 border-t border-[#8f6a38]/30 pt-4">
                            <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{props.t('lobby.availableRooms')}</div>
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
                                className={`rounded-xl border px-3 py-2 text-[10px] font-bold tracking-[0.16em] transition-colors ${props.showUnavailableRooms ? 'border-[#efb768]/70 bg-[#7d4f22]/45 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                            >
                                {props.t(props.showUnavailableRooms ? 'lobby.hideUnavailable' : 'lobby.showUnavailable')}
                            </button>
                            {visibleFirebaseRooms.length > 0 ? (
                                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                                    {visibleFirebaseRooms.slice(0, 8).map((room) => (
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
                                <div className="rounded-xl border border-[#8f6a38]/20 bg-black/25 px-4 py-3 text-center text-[11px] tracking-[0.18em] text-[#b9c7c8]">
                                    {props.roomFilter === 'all'
                                        ? (props.showUnavailableRooms ? props.t('lobby.noRooms') : props.t('lobby.noJoinableRooms'))
                                        : props.t('lobby.noRoomsFiltered')}
                                </div>
                            )}
                            {!props.showUnavailableRooms && hiddenUnavailableCount > 0 ? (
                                <div className="text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                                    {props.t('lobby.hiddenUnavailable', { count: hiddenUnavailableCount })}
                                </div>
                            ) : null}
                            <div className="text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                                {props.t('lobby.firebaseOptional')}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-[#8f6a38]/20 bg-black/25 px-4 py-3 text-center text-[11px] tracking-[0.18em] text-[#b9c7c8]">
                            <div>{props.t('lobby.firebaseDisabled')}</div>
                            {props.firebaseMissingKeys.length > 0 ? (
                                <div className="mt-2 text-[10px] tracking-[0.12em] text-[#8fb8c2]">
                                    {props.firebaseMissingKeys.join(', ')}
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
