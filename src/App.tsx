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
import { createTranslator, getInitialLocale, saveLocale, type TranslationDescriptor, type TranslationKey, type Translator } from './i18n';
import { formatSeconds } from './i18n/format';
import type { Locale } from './i18n/types';
import type { GameMode } from './gameplay/types';
import { CHASSIS_DEFINITIONS, DEFAULT_CHASSIS_ID, LOADOUT_DEFINITIONS, getDefaultLoadoutForChassis } from './mechs/definitions';
import type { ChassisId, LoadoutId } from './mechs/types';

const startupPhaseLabelKeys: Record<'startWorld' | 'createSession' | 'connectToHost', TranslationKey> = {
    startWorld: 'errors.startWorld',
    createSession: 'errors.createSession',
    connectToHost: 'errors.connectToHost'
};

async function copyText(text: string) {
    if (!text) return false;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Fallback below.
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const result = document.execCommand('copy');
        document.body.removeChild(textarea);
        return result;
    } catch {
        return false;
    }
}

function getStartupFailureMessage(t: Translator, locale: Locale, failure: StartupFailure) {
    const withDetail = (message: string) => failure.detail
        ? `${message}\n\n${t('errors.detail', { detail: failure.detail })}`
        : message;

    switch (failure.code) {
        case 'timeout':
            return withDetail(t('errors.timeout', {
                label: failure.phase ? t(startupPhaseLabelKeys[failure.phase]) : t('errors.startWorld'),
                seconds: formatSeconds(locale, failure.seconds ?? 15)
            }));
        case 'hostIdRequired':
            return t('errors.hostIdRequired');
        case 'peerUnavailable':
            return withDetail(t('errors.peerUnavailable'));
        case 'peerIdUnavailable':
            return withDetail(t('errors.peerIdUnavailable'));
        case 'networkUnavailable':
            return withDetail(t('errors.networkUnavailable'));
        case 'serverError':
            return withDetail(t('errors.serverError'));
        case 'connectionFailed':
            return withDetail(t('errors.connectionFailed'));
        case 'invalidHostId':
            return withDetail(t('errors.invalidHostId'));
        default:
            if (failure.phase) {
                return withDetail(t('errors.phaseFailed', { label: t(startupPhaseLabelKeys[failure.phase]) }));
            }
            return t('errors.startup', { message: failure.detail || t('errors.unknown') });
    }
}

function releasePointerLock() {
    if (typeof document === 'undefined' || typeof document.exitPointerLock !== 'function') {
        return;
    }
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
}


export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const copyResetRef = useRef<number | null>(null);
    const [locale, setLocale] = useState<Locale>(() => getInitialLocale());
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);
    const [mobileLeftHanded, setMobileLeftHanded] = useState(false);
    const [mobileAimPreset, setMobileAimPreset] = useState<'LOW' | 'MID' | 'HIGH'>('MID');
    const [ambientAtmosphereEnabled, setAmbientAtmosphereEnabled] = useState(() => {
        try {
            const stored = window.localStorage.getItem('golems_atmosphere_enabled');
            if (stored === 'on') return true;
            if (stored === 'off') return false;
        } catch {
            // Ignore storage access issues.
        }

        const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
        const touchDevice = navigator.maxTouchPoints > 0;
        const minViewport = Math.min(window.innerWidth, window.innerHeight);
        const isMobile = coarsePointer || touchDevice || minViewport <= 900;
        return !isMobile;
    });
    const [hostId, setHostId] = useState('');
    const [roomName, setRoomName] = useState('');
    const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('control');
    const [selectedChassisId, setSelectedChassisId] = useState<ChassisId>(DEFAULT_CHASSIS_ID);
    const [selectedLoadoutId, setSelectedLoadoutId] = useState<LoadoutId>(getDefaultLoadoutForChassis(DEFAULT_CHASSIS_ID).id);
    const [roomFilter, setRoomFilter] = useState<'all' | GameMode>('all');
    const [showUnavailableRooms, setShowUnavailableRooms] = useState(false);
    const [showPilotPanel, setShowPilotPanel] = useState(true);
    const [showDesktopSettings, setShowDesktopSettings] = useState(false);
    const [showMobileSettings, setShowMobileSettings] = useState(false);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
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
        const media = window.matchMedia('(pointer: coarse)');
        const updateTouchState = () => {
            setIsTouchDevice(media.matches || navigator.maxTouchPoints > 0);
            setIsPortrait(window.innerHeight >= window.innerWidth);
        };
        updateTouchState();
        media.addEventListener?.('change', updateTouchState);
        window.addEventListener('resize', updateTouchState);
        return () => {
            media.removeEventListener?.('change', updateTouchState);
            window.removeEventListener('resize', updateTouchState);
        };
    }, []);

    useEffect(() => {
        try {
            const handed = window.localStorage.getItem('golems_mobile_handed');
            const preset = window.localStorage.getItem('golems_mobile_aim_preset');
            const atmosphere = window.localStorage.getItem('golems_atmosphere_enabled');
            if (handed === 'left') setMobileLeftHanded(true);
            if (preset === 'LOW' || preset === 'MID' || preset === 'HIGH') {
                setMobileAimPreset(preset);
            }
            if (atmosphere === 'on' || atmosphere === 'off') {
                setAmbientAtmosphereEnabled(atmosphere === 'on');
            }
        } catch {
            // Ignore storage access issues.
        }
    }, []);

    useEffect(() => {
        saveLocale(locale);
    }, [locale]);

    useEffect(() => {
        try {
            const savedChassis = window.localStorage.getItem('golems_selected_chassis');
            const savedLoadout = window.localStorage.getItem('golems_selected_loadout');
            if (savedChassis && savedChassis in CHASSIS_DEFINITIONS) {
                const chassisId = savedChassis as ChassisId;
                setSelectedChassisId(chassisId);
                const fallbackLoadout = getDefaultLoadoutForChassis(chassisId).id;
                if (savedLoadout && savedLoadout in LOADOUT_DEFINITIONS && LOADOUT_DEFINITIONS[savedLoadout as LoadoutId].chassisId === chassisId) {
                    setSelectedLoadoutId(savedLoadout as LoadoutId);
                } else {
                    setSelectedLoadoutId(fallbackLoadout);
                }
            }
        } catch {
            // Ignore storage issues.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem('golems_selected_chassis', selectedChassisId);
            window.localStorage.setItem('golems_selected_loadout', selectedLoadoutId);
        } catch {
            // Ignore storage issues.
        }
    }, [selectedChassisId, selectedLoadoutId]);

    useEffect(() => {
        if (!availableLoadouts.some((loadout) => loadout.id === selectedLoadoutId)) {
            setSelectedLoadoutId(getDefaultLoadoutForChassis(selectedChassisId).id);
        }
    }, [availableLoadouts, selectedChassisId, selectedLoadoutId]);

    useEffect(() => {
        return () => {
            if (copyResetRef.current !== null) {
                window.clearTimeout(copyResetRef.current);
            }
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem('golems_mobile_handed', mobileLeftHanded ? 'left' : 'right');
            window.localStorage.setItem('golems_mobile_aim_preset', mobileAimPreset);
            window.localStorage.setItem('golems_atmosphere_enabled', ambientAtmosphereEnabled ? 'on' : 'off');
        } catch {
            // Ignore storage access issues.
        }
    }, [ambientAtmosphereEnabled, mobileAimPreset, mobileLeftHanded]);

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

    const torsoOffset = Math.atan2(
        Math.sin(gameState.torsoYaw - gameState.legYaw),
        Math.cos(gameState.torsoYaw - gameState.legYaw)
    );
    const twistRatio = gameState.maxTwist > 0
        ? Math.max(-1, Math.min(1, torsoOffset / gameState.maxTwist))
        : 0;
    const throttleRatio = Math.max(-0.45, Math.min(1, gameState.throttle));
    const hpRatio = gameState.maxHp > 0 ? gameState.hp / gameState.maxHp : 0;
    const steamRatio = gameState.maxSteam > 0 ? gameState.steam / gameState.maxSteam : 0;
    const warningMessage: TranslationDescriptor = gameState.isOverheated
        ? { key: 'hud.warning.overheat', params: { seconds: formatSeconds(locale, gameState.overheatTimer) } }
        : Math.abs(twistRatio) > 0.86
            ? { key: 'hud.warning.torsoLimit' }
            : !isTouchDevice && Math.abs(twistRatio) > 0.6
                ? { key: 'hud.warning.centerTorso' }
                : throttleRatio < -0.05
                    ? { key: 'hud.warning.reverse' }
                    : throttleRatio > 0.7
                        ? { key: 'hud.warning.fullAhead' }
                        : { key: 'hud.warning.cruise' };
    const mobileAimSensitivity = mobileAimPreset === 'LOW' ? 0.62 : mobileAimPreset === 'HIGH' ? 1.2 : 0.9;
    const sessionMessage: TranslationDescriptor = sessionMode === 'solo'
        ? 'session.solo'
        : isHost
            ? 'session.host'
            : 'session.client';
    const copyMessage: TranslationDescriptor = copyState === 'copied'
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
                    onSelectChassis={(chassisId) => {
                        setSelectedChassisId(chassisId);
                        setSelectedLoadoutId(getDefaultLoadoutForChassis(chassisId).id);
                    }}
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
                            twistRatio={twistRatio}
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
