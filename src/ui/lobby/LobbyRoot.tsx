import { buildLobbyViewModel } from './buildLobbyViewModel';
import { DesktopLobbyLayout } from './DesktopLobbyLayout';
import { LobbyChassisSection } from './LobbyChassisSection';
import { LobbyLoadoutSection } from './LobbyLoadoutSection';
import { LobbyModeSection } from './LobbyModeSection';
import { LobbyRoomBrowserSection } from './LobbyRoomBrowserSection';
import { LobbySessionSection } from './LobbySessionSection';
import { LobbySelectionSummary } from './LobbySelectionSummary';
import { MobileLandscapeLobbyLayout } from './MobileLandscapeLobbyLayout';
import { MobilePortraitLobbyLayout } from './MobilePortraitLobbyLayout';
import { PilotAccountCard } from './PilotAccountCard';
import type { LobbyScreenProps } from './lobbyTypes';

export function LobbyRoot(props: LobbyScreenProps) {
    const viewModel = buildLobbyViewModel(props);
    const modeSection = (
        <LobbyModeSection
            t={props.t}
            selectedGameMode={props.selectedGameMode}
            onSelectGameMode={props.onSelectGameMode}
        />
    );
    const chassisSection = (
        <LobbyChassisSection
            t={props.t}
            availableChassis={props.availableChassis}
            selectedChassisId={props.selectedChassisId}
            selectedChassis={props.selectedChassis}
            onSelectChassis={props.onSelectChassis}
        />
    );
    const loadoutSection = (
        <LobbyLoadoutSection
            t={props.t}
            availableLoadouts={props.availableLoadouts}
            selectedLoadoutId={props.selectedLoadoutId}
            selectedLoadout={props.selectedLoadout}
            onSelectLoadout={props.onSelectLoadout}
        />
    );
    const sessionSection = (
        <LobbySessionSection
            t={props.t}
            roomName={props.roomName}
            onRoomNameChange={props.onRoomNameChange}
            onStartSolo={props.onStartSolo}
            onStartHost={props.onStartHost}
            hostId={props.hostId}
            onHostIdChange={props.onHostIdChange}
            onStartClient={props.onStartClient}
            selectedGameMode={props.selectedGameMode}
            firebaseEnabled={props.firebaseEnabled}
            directJoinRoom={viewModel.directJoinRoom}
            directJoinModeKey={viewModel.directJoinModeKey}
            directJoinStatusKey={viewModel.directJoinStatusKey}
            directJoinAvailabilityKey={viewModel.directJoinAvailabilityKey}
        />
    );
    const roomSection = (
        <LobbyRoomBrowserSection
            t={props.t}
            firebaseEnabled={props.firebaseEnabled}
            firebaseMissingKeys={props.firebaseMissingKeys}
            roomFilter={props.roomFilter}
            onRoomFilterChange={props.onRoomFilterChange}
            showUnavailableRooms={props.showUnavailableRooms}
            onToggleUnavailableRooms={props.onToggleUnavailableRooms}
            onStartClient={props.onStartClient}
            visibleFirebaseRooms={viewModel.visibleFirebaseRooms}
            hiddenUnavailableCount={viewModel.hiddenUnavailableCount}
            showTitle={viewModel.layoutKind === 'desktop'}
        />
    );
    const pilotSection = (
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
            showTitle={viewModel.layoutKind === 'desktop'}
        />
    );
    const shellWidthClass = viewModel.layoutKind === 'desktop'
        ? 'w-[min(96vw,84rem)]'
        : viewModel.layoutKind === 'mobileLandscape'
            ? 'w-[min(96vw,64rem)]'
            : 'w-[min(94vw,26rem)]';

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

                <div className={`${shellWidthClass} max-w-full`}>
                    <LobbySelectionSummary
                        modeLabel={props.t(props.selectedGameMode === 'tdm' ? 'lobby.mode.tdm' : 'lobby.mode.control')}
                        chassisLabel={props.selectedChassis.name}
                        loadoutLabel={props.selectedLoadout.name}
                        roomCountLabel={props.firebaseEnabled ? `${viewModel.visibleFirebaseRooms.length}` : undefined}
                    />
                    {viewModel.layoutKind === 'desktop' ? (
                        <DesktopLobbyLayout
                            modeSection={modeSection}
                            chassisSection={chassisSection}
                            loadoutSection={loadoutSection}
                            sessionSection={sessionSection}
                            roomSection={roomSection}
                            pilotSection={pilotSection}
                        />
                    ) : viewModel.layoutKind === 'mobileLandscape' ? (
                        <MobileLandscapeLobbyLayout
                            modeSection={modeSection}
                            chassisSection={chassisSection}
                            loadoutSection={loadoutSection}
                            sessionSection={sessionSection}
                            roomSection={roomSection}
                            pilotSection={pilotSection}
                            roomTitle={props.t('lobby.availableRooms')}
                            pilotTitle={props.t('supabase.title')}
                        />
                    ) : (
                        <MobilePortraitLobbyLayout
                            modeSection={modeSection}
                            chassisSection={chassisSection}
                            loadoutSection={loadoutSection}
                            sessionSection={sessionSection}
                            roomSection={roomSection}
                            pilotSection={pilotSection}
                            modeTitle={props.t('lobby.modeTitle')}
                            frameTitle={props.t('lobby.frameTitle')}
                            sessionTitle={props.t('common.network')}
                            roomTitle={props.t('lobby.availableRooms')}
                            pilotTitle={props.t('supabase.title')}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
