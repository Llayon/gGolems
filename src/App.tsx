/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { useFirebaseLobbyRooms } from './app/useFirebaseLobbyRooms';
import { type SessionMode, type StartupFailure, useGameSession } from './app/useGameSession';
import { usePilotAccount } from './app/usePilotAccount';
import { getFirebaseLobbyStatus } from './firebase/client';
import { DesktopCombatHud } from './ui/combat/DesktopCombatHud';
import { MatchStatusOverlay } from './ui/combat/MatchStatusOverlay';
import { LobbyScreen } from './ui/lobby/LobbyScreen';
import { MobileCombatLayout } from './ui/mobile/MobileCombatLayout';
import { MobileSettingsOverlay } from './ui/mobile/MobileSettingsOverlay';
import { createTranslator, type Translator } from './i18n';
import type { Locale } from './i18n/types';
import type { GameMode } from './gameplay/types';
import { CHASSIS_DEFINITIONS, DEFAULT_CHASSIS_ID, LOADOUT_DEFINITIONS, getDefaultLoadoutForChassis } from './mechs/definitions';
import type { ChassisId, LoadoutId } from './mechs/types';
import { copyText, getStartupFailureMessage, releasePointerLock } from './app/appHelpers';
import { computeHudWarning, computeHudRatios } from './app/useHudWarning';
import { useAppSettings } from './app/useAppSettings';

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const copyResetRef = useRef<number | null>(null);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
    const [showPilotPanel, setShowPilotPanel] = useState(true);
    const [showDesktopSettings, setShowDesktopSettings] = useState(false);
    const [showMobileSettings, setShowMobileSettings] = useState(false);

    const settings = useAppSettings();
    const {
        locale, setLocale,
        isTouchDevice, isPortrait,
        mobileLeftHanded, setMobileLeftHanded,
        mobileAimPreset, setMobileAimPreset,
        ambientAtmosphereEnabled, setAmbientAtmosphereEnabled,
        hostId, setHostId, roomName, setRoomName,
        selectedGameMode, setSelectedGameMode,
        selectedChassisId, setSelectedChassisId,
        selectedLoadoutId, setSelectedLoadoutId,
        roomFilter, setRoomFilter,
        showUnavailableRooms, setShowUnavailableRooms
    } = settings;

    const t = createTranslator(locale);
    const firebaseLobbyStatus = getFirebaseLobbyStatus();
    const session = useGameSession({
        canvasRef,
        firebaseEnabled: firebaseLobbyStatus.enabled,
        atmosphereEnabled: ambientAtmosphereEnabled,
        roomName,
        selectedChassisId,
        selectedLoadoutId,
        releasePointerLock,
        onStartupFailure: (failure: StartupFailure) => {
            alert(getStartupFailureMessage(t, locale, failure));
        }
    });
    const { gameInstance, gameState, inLobby, isHost, loading, myId, sessionMode } = session;
    const firebaseRooms = useFirebaseLobbyRooms(firebaseLobbyStatus.enabled, inLobby);
    const pilot = usePilotAccount({
        locale,
        inLobby,
        gameMode: gameState.gameMode,
        teamScores: gameState.teamScores,
        messages: {
            googleRedirect: t('supabase.actions.googleRedirect'),
            googleFailed: t('supabase.actions.googleFailed'),
            magicSending: t('supabase.actions.magicSending'),
            magicSent: t('supabase.actions.magicSent'),
            magicFailed: t('supabase.actions.magicFailed')
        }
    });
    const availableChassis = Object.values(CHASSIS_DEFINITIONS);
    const availableLoadouts = Object.values(LOADOUT_DEFINITIONS).filter((loadout) => loadout.chassisId === selectedChassisId);
    const selectedChassis = CHASSIS_DEFINITIONS[selectedChassisId];
    const selectedLoadout = LOADOUT_DEFINITIONS[selectedLoadoutId];
    const pilotAccount = pilot.account;

    const showCopyState = (nextState: 'copied' | 'error') => {
        setCopyState(nextState);
        if (copyResetRef.current !== null) {
            window.clearTimeout(copyResetRef.current);
        }
        copyResetRef.current = window.setTimeout(() => {
            setCopyState('idle');
            copyResetRef.current = null;
        }, 1800);
    };

    const copyHostId = async () => {
        if (sessionMode !== 'host' || !myId) return;
        const success = await copyText(myId);
        showCopyState(success ? 'copied' : 'error');
    };

    const leaveGame = (gameOverride?: any) => {
        session.leaveGame(gameOverride);
        setCopyState('idle');
        setShowDesktopSettings(false);
        setShowMobileSettings(false);
    };

    const startGame = async (mode: SessionMode, targetHostId?: string, requestedMode: GameMode = selectedGameMode) => {
        setShowPilotPanel(!isTouchDevice);
        setShowDesktopSettings(false);
        setShowMobileSettings(false);
        setCopyState('idle');
        await session.startGame(mode, targetHostId, requestedMode);
    };

    useEffect(() => {
        return () => {
            if (copyResetRef.current !== null) {
                window.clearTimeout(copyResetRef.current);
            }
        }
    }, []);

    useEffect(() => {
        gameInstance?.setAtmosphereEnabled?.(ambientAtmosphereEnabled);
    }, [ambientAtmosphereEnabled, gameInstance]);

    useEffect(() => {
        if (inLobby || isTouchDevice || loading || gameState.teamScores.winner) {
            setShowDesktopSettings(false);
        }
    }, [gameState.teamScores.winner, inLobby, isTouchDevice, loading]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (isTouchDevice || inLobby || loading || event.repeat) return;

            const target = event.target;
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

            if (event.code === 'KeyH') {
                event.preventDefault();
                setShowPilotPanel((current) => !current);
                return;
            }

            if (event.code !== 'Escape' || gameState.teamScores.winner) return;

            event.preventDefault();
            if (document.pointerLockElement) {
                releasePointerLock();
                setShowDesktopSettings(true);
                return;
            }
            setShowDesktopSettings((current) => !current);
        };

        const onPointerLockChange = () => {
            if (isTouchDevice || inLobby || loading || gameState.teamScores.winner) return;
            if (document.pointerLockElement) return;
            setShowDesktopSettings(true);
        };

        window.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerlockchange', onPointerLockChange);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerlockchange', onPointerLockChange);
        };
    }, [gameState.teamScores.winner, inLobby, isTouchDevice, loading]);

    const warningMessage = computeHudWarning({
        isTouchDevice,
        torsoYaw: gameState.torsoYaw,
        legYaw: gameState.legYaw,
        maxTwist: gameState.maxTwist,
        throttle: gameState.throttle,
        hp: gameState.hp,
        maxHp: gameState.maxHp,
        steam: gameState.steam,
        maxSteam: gameState.maxSteam,
        isOverheated: gameState.isOverheated,
        overheatTimer: gameState.overheatTimer
    }, locale);
    const { hpRatio, steamRatio } = computeHudRatios(gameState);
    const mobileAimSensitivity = mobileAimPreset === 'LOW' ? 0.62 : mobileAimPreset === 'HIGH' ? 1.2 : 0.9;
    const sessionMessage: any = sessionMode === 'solo'
        ? 'session.solo'
        : isHost
            ? 'session.host'
            : 'session.client';
    const copyMessage: any = copyState === 'copied'
        ? 'common.copied'
        : copyState === 'error'
            ? 'common.failed'
            : 'common.copy';
    const showCockpitDecor = !isTouchDevice && gameState.cameraMode === 'cockpit';
    const cockpitCanvasTransform = showCockpitDecor
        ? `translate3d(${gameState.cockpitKickX * 1.18}px, ${gameState.cockpitKickY * 1.18}px, 0) rotate(${gameState.cockpitKickRoll * 1.12}deg) scale(${1 + gameState.cockpitFrameKick * 0.014})`
        : undefined;
    const localeLabel = t('locale.current', { label: t('locale.label'), value: t(locale === 'ru' ? 'locale.ru' : 'locale.en') });
    return (
        <div className="relative h-[100dvh] w-full overflow-hidden bg-[#100d0b] font-mono text-[#f2ddb1]">
            <canvas
                ref={canvasRef}
                className={`block h-full w-full ${inLobby ? 'hidden' : ''}`}
                style={cockpitCanvasTransform ? { transform: cockpitCanvasTransform, transformOrigin: '50% 50%' } : undefined}
            />

            {!inLobby ? (
                <MatchStatusOverlay
                    scores={gameState.teamScores}
                    points={gameState.controlPoints}
                    controlSummary={gameState.controlSummary}
                    teamOverview={gameState.teamOverview}
                    respawnTimer={gameState.respawnTimer}
                    isTouchDevice={isTouchDevice}
                    locale={locale}
                    gameMode={gameState.gameMode}
                    t={t}
                    onRestart={() => {
                        releasePointerLock();
                        gameInstance?.restartMatch?.();
                    }}
                    onReturnToLobby={() => leaveGame()}
                />
            ) : null}

            {inLobby ? (
                <LobbyScreen
                    locale={locale}
                    localeLabel={localeLabel}
                    t={t}
                    isTouchDevice={isTouchDevice}
                    isPortrait={isPortrait}
                    selectedGameMode={selectedGameMode}
                    onSelectGameMode={setSelectedGameMode}
                    availableChassis={availableChassis}
                    selectedChassisId={selectedChassisId}
                    selectedChassis={selectedChassis}
                    onSelectChassis={setSelectedChassisId}
                    availableLoadouts={availableLoadouts}
                    selectedLoadoutId={selectedLoadoutId}
                    selectedLoadout={selectedLoadout}
                    onSelectLoadout={setSelectedLoadoutId}
                    pilotAccount={pilotAccount}
                    authEmail={pilot.authUpgradeEmail}
                    authBusy={pilot.authUpgradeBusy}
                    authMessage={pilot.authUpgradeMessage}
                    onAuthEmailChange={pilot.setAuthUpgradeEmail}
                    onLinkGoogle={() => {
                        void pilot.startGoogleUpgrade();
                    }}
                    onSendMagicLink={() => {
                        void pilot.sendMagicLinkUpgrade();
                    }}
                    roomName={roomName}
                    onRoomNameChange={setRoomName}
                    onStartSolo={() => {
                        void startGame('solo');
                    }}
                    onStartHost={() => {
                        void startGame('host');
                    }}
                    hostId={hostId}
                    onHostIdChange={setHostId}
                    onStartClient={(nextHostId, mode) => {
                        setHostId(nextHostId);
                        setSelectedGameMode(mode);
                        void startGame('client', nextHostId, mode);
                    }}
                    firebaseEnabled={firebaseLobbyStatus.enabled}
                    firebaseMissingKeys={firebaseLobbyStatus.missingKeys}
                    firebaseRooms={firebaseRooms}
                    roomFilter={roomFilter}
                    onRoomFilterChange={setRoomFilter}
                    showUnavailableRooms={showUnavailableRooms}
                    onToggleUnavailableRooms={() => setShowUnavailableRooms((current) => !current)}
                    onToggleLocale={() => setLocale((current) => current === 'ru' ? 'en' : 'ru')}
                />
            ) : null}

            {loading && !inLobby ? (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#130e0b]/95">
                    <div className="rounded-full border border-[#8f6a38]/50 bg-black/55 px-8 py-4 text-xl tracking-[0.35em] text-[#efb768]">
                        {t('lobby.sealingCabin')}
                    </div>
                </div>
            ) : null}

            {!loading && !inLobby ? (
                <>
                    {isTouchDevice ? (
                        <MobileCombatLayout
                            warning={warningMessage}
                            legYaw={gameState.legYaw}
                            torsoYaw={gameState.torsoYaw}
                            twistRatio={computeHudRatios(gameState).throttleRatio}
                            hpRatio={hpRatio}
                            steamRatio={steamRatio}
                            speed={gameState.speed}
                            maxSpeed={gameState.maxSpeed}
                            weaponStatus={gameState.weaponStatus}
                            radarContacts={gameState.radarContacts}
                            isPortrait={isPortrait}
                            leftHanded={mobileLeftHanded}
                            aimSensitivity={mobileAimSensitivity}
                            game={gameInstance}
                            locale={locale}
                            t={t}
                            onOpenSettings={() => setShowMobileSettings(true)}
                        />
                    ) : null}

                    {!isTouchDevice ? (
                        <DesktopCombatHud
                            gameState={gameState}
                            locale={locale}
                            sessionMode={sessionMode}
                            myId={myId}
                            copyState={copyState}
                            showPilotPanel={showPilotPanel}
                            showSettingsOverlay={showDesktopSettings}
                            atmosphereEnabled={ambientAtmosphereEnabled}
                            t={t}
                            onCopyHostId={copyHostId}
                            onCloseSettingsOverlay={() => setShowDesktopSettings(false)}
                            onToggleCameraMode={() => gameInstance?.toggleCameraMode?.()}
                            onTogglePilotPanel={() => setShowPilotPanel((current) => !current)}
                            onToggleAtmosphere={() => setAmbientAtmosphereEnabled((current) => !current)}
                            onToggleLocale={() => setLocale((current) => current === 'ru' ? 'en' : 'ru')}
                        />
                    ) : null}

                    {isTouchDevice ? (
                        <MobileSettingsOverlay
                            open={showMobileSettings}
                            isPortrait={isPortrait}
                            sessionMode={sessionMode}
                            sessionMessage={sessionMessage}
                            cameraMode={gameState.cameraMode}
                            myId={myId}
                            copyMessage={copyMessage}
                            leftHanded={mobileLeftHanded}
                            aimPreset={mobileAimPreset}
                            atmosphereEnabled={ambientAtmosphereEnabled}
                            locale={locale}
                            t={t}
                            onClose={() => setShowMobileSettings(false)}
                            onCopyHostId={copyHostId}
                            onToggleCameraMode={() => gameInstance?.toggleCameraMode?.()}
                            onToggleHanded={() => setMobileLeftHanded((current) => !current)}
                            onCycleAimPreset={() => setMobileAimPreset((current) => current === 'LOW' ? 'MID' : current === 'MID' ? 'HIGH' : 'LOW')}
                            onToggleAtmosphere={() => setAmbientAtmosphereEnabled((current) => !current)}
                            onToggleLocale={() => setLocale((current) => current === 'ru' ? 'en' : 'ru')}
                        />
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
