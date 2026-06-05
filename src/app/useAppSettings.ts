import { useEffect, useState } from 'react';
import {
    CHASSIS_DEFINITIONS,
    DEFAULT_CHASSIS_ID,
    LOADOUT_DEFINITIONS,
    getDefaultLoadoutForChassis
} from '../mechs/definitions';
import type { ChassisId, LoadoutId } from '../mechs/types';
import type { GameMode } from '../gameplay/types';

export type MobileAimPreset = 'LOW' | 'MID' | 'HIGH';

export type AppSettings = {
    locale: 'en' | 'ru';
    setLocale: (updater: (current: 'en' | 'ru') => 'en' | 'ru') => void;
    isTouchDevice: boolean;
    isPortrait: boolean;
    mobileLeftHanded: boolean;
    setMobileLeftHanded: (updater: (current: boolean) => boolean) => void;
    mobileAimPreset: MobileAimPreset;
    setMobileAimPreset: (updater: (current: MobileAimPreset) => MobileAimPreset) => void;
    ambientAtmosphereEnabled: boolean;
    setAmbientAtmosphereEnabled: (updater: (current: boolean) => boolean) => void;
    hostId: string;
    setHostId: (id: string) => void;
    roomName: string;
    setRoomName: (name: string) => void;
    selectedGameMode: GameMode;
    setSelectedGameMode: (mode: GameMode) => void;
    selectedChassisId: ChassisId;
    setSelectedChassisId: (id: ChassisId) => void;
    selectedLoadoutId: LoadoutId;
    setSelectedLoadoutId: (id: LoadoutId) => void;
    roomFilter: 'all' | GameMode;
    setRoomFilter: (filter: 'all' | GameMode) => void;
    showUnavailableRooms: boolean;
    setShowUnavailableRooms: (updater: (current: boolean) => boolean) => void;
};

const STORAGE_KEYS = {
    atmosphere: 'golems_atmosphere_enabled',
    handed: 'golems_mobile_handed',
    aimPreset: 'golems_mobile_aim_preset',
    chassis: 'golems_selected_chassis',
    loadout: 'golems_selected_loadout'
};

function readStoredBoolean(key: string): boolean | null {
    try {
        const stored = window.localStorage.getItem(key);
        if (stored === 'on') return true;
        if (stored === 'off') return false;
    } catch {
        // Ignore storage access issues.
    }
    return null;
}

function detectInitialAtmosphere(): boolean {
    const stored = readStoredBoolean(STORAGE_KEYS.atmosphere);
    if (stored !== null) return stored;

    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const touchDevice = navigator.maxTouchPoints > 0;
    const minViewport = Math.min(window.innerWidth, window.innerHeight);
    const isMobile = coarsePointer || touchDevice || minViewport <= 900;
    return !isMobile;
}

export function useAppSettings(): AppSettings {
    const [locale, setLocaleState] = useState<'en' | 'ru'>(() => {
        try {
            return (window.localStorage.getItem('golems_locale') as 'en' | 'ru') || 'en';
        } catch {
            return 'en';
        }
    });
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);
    const [mobileLeftHanded, setMobileLeftHandedState] = useState(false);
    const [mobileAimPreset, setMobileAimPresetState] = useState<MobileAimPreset>('MID');
    const [ambientAtmosphereEnabled, setAmbientAtmosphereEnabledState] = useState(detectInitialAtmosphere);
    const [hostId, setHostId] = useState('');
    const [roomName, setRoomName] = useState('');
    const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('control');
    const [selectedChassisId, setSelectedChassisIdState] = useState<ChassisId>(DEFAULT_CHASSIS_ID);
    const [selectedLoadoutId, setSelectedLoadoutIdState] = useState<LoadoutId>(
        getDefaultLoadoutForChassis(DEFAULT_CHASSIS_ID).id
    );
    const [roomFilter, setRoomFilter] = useState<'all' | GameMode>('all');
    const [showUnavailableRooms, setShowUnavailableRoomsState] = useState(false);

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
            const handed = window.localStorage.getItem(STORAGE_KEYS.handed);
            const preset = window.localStorage.getItem(STORAGE_KEYS.aimPreset);
            const atmosphere = window.localStorage.getItem(STORAGE_KEYS.atmosphere);
            if (handed === 'left') setMobileLeftHandedState(true);
            if (preset === 'LOW' || preset === 'MID' || preset === 'HIGH') {
                setMobileAimPresetState(preset);
            }
            if (atmosphere === 'on' || atmosphere === 'off') {
                setAmbientAtmosphereEnabledState(atmosphere === 'on');
            }
        } catch {
            // Ignore storage access issues.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem('golems_locale', locale);
        } catch {
            // Ignore storage issues.
        }
    }, [locale]);

    useEffect(() => {
        try {
            const savedChassis = window.localStorage.getItem(STORAGE_KEYS.chassis);
            const savedLoadout = window.localStorage.getItem(STORAGE_KEYS.loadout);
            if (savedChassis && savedChassis in CHASSIS_DEFINITIONS) {
                const chassisId = savedChassis as ChassisId;
                setSelectedChassisIdState(chassisId);
                const fallbackLoadout = getDefaultLoadoutForChassis(chassisId).id;
                if (savedLoadout && savedLoadout in LOADOUT_DEFINITIONS && LOADOUT_DEFINITIONS[savedLoadout as LoadoutId].chassisId === chassisId) {
                    setSelectedLoadoutIdState(savedLoadout as LoadoutId);
                } else {
                    setSelectedLoadoutIdState(fallbackLoadout);
                }
            }
        } catch {
            // Ignore storage issues.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEYS.chassis, selectedChassisId);
            window.localStorage.setItem(STORAGE_KEYS.loadout, selectedLoadoutId);
        } catch {
            // Ignore storage issues.
        }
    }, [selectedChassisId, selectedLoadoutId]);

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEYS.handed, mobileLeftHanded ? 'left' : 'right');
            window.localStorage.setItem(STORAGE_KEYS.aimPreset, mobileAimPreset);
            window.localStorage.setItem(STORAGE_KEYS.atmosphere, ambientAtmosphereEnabled ? 'on' : 'off');
        } catch {
            // Ignore storage access issues.
        }
    }, [ambientAtmosphereEnabled, mobileAimPreset, mobileLeftHanded]);

    const setLocaleSafe = (updater: (current: 'en' | 'ru') => 'en' | 'ru') => setLocaleState(updater);
    const setMobileLeftHandedSafe = (updater: (current: boolean) => boolean) => setMobileLeftHandedState(updater);
    const setMobileAimPresetSafe = (updater: (current: MobileAimPreset) => MobileAimPreset) => setMobileAimPresetState(updater);
    const setAmbientAtmosphereEnabledSafe = (updater: (current: boolean) => boolean) => setAmbientAtmosphereEnabledState(updater);
    const setShowUnavailableRoomsSafe = (updater: (current: boolean) => boolean) => setShowUnavailableRoomsState(updater);

    const setSelectedChassisId = (id: ChassisId) => {
        setSelectedChassisIdState(id);
        setSelectedLoadoutIdState(getDefaultLoadoutForChassis(id).id);
    };

    const availableLoadouts = Object.values(LOADOUT_DEFINITIONS).filter((loadout) => loadout.chassisId === selectedChassisId);
    if (!availableLoadouts.some((loadout) => loadout.id === selectedLoadoutId)) {
        setSelectedLoadoutIdState(getDefaultLoadoutForChassis(selectedChassisId).id);
    }

    return {
        locale, setLocale: setLocaleSafe,
        isTouchDevice, isPortrait,
        mobileLeftHanded, setMobileLeftHanded: setMobileLeftHandedSafe,
        mobileAimPreset, setMobileAimPreset: setMobileAimPresetSafe,
        ambientAtmosphereEnabled, setAmbientAtmosphereEnabled: setAmbientAtmosphereEnabledSafe,
        hostId, setHostId, roomName, setRoomName,
        selectedGameMode, setSelectedGameMode,
        selectedChassisId, setSelectedChassisId,
        selectedLoadoutId, setSelectedLoadoutId: setSelectedLoadoutIdState,
        roomFilter, setRoomFilter,
        showUnavailableRooms, setShowUnavailableRooms: setShowUnavailableRoomsSafe
    };
}
