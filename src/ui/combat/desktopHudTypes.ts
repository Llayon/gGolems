import type { GameHudState } from '../../core/gameHudState';
import type { TranslationDescriptor, Translator } from '../../i18n';
import type { Locale } from '../../i18n/types';

export type DesktopHudSessionMode = 'solo' | 'host' | 'client';
export type DesktopHudCopyState = 'idle' | 'copied' | 'error';

export type DesktopCombatHudProps = {
    gameState: GameHudState;
    locale: Locale;
    sessionMode: DesktopHudSessionMode;
    myId: string;
    copyState: DesktopHudCopyState;
    showPilotPanel: boolean;
    atmosphereEnabled: boolean;
    t: Translator;
    onCopyHostId: () => void;
    onTogglePilotPanel: () => void;
    onToggleAtmosphere: () => void;
    onToggleLocale: () => void;
};

export type DesktopCockpitFrameViewModel = {
    warning: string;
    throttleLabel: string;
    kickX: number;
    kickY: number;
    kickRoll: number;
    frameKick: number;
    flash: number;
};

export type DesktopHostBadgeViewModel = {
    hostIdLabel: string;
    hostId: string;
    copyLabel: string;
};

export type DesktopPilotPanelViewModel = {
    visible: boolean;
    title: string;
    summary: string;
    terrainDebugLabel: string;
    terrainDebugTone: string;
    atmosphereLabel: string;
    localeLabel: string;
    copyLabel: string;
    showHostCopy: boolean;
    hideLabel: string;
    showLabel: string;
    controls: string[];
};

export type DesktopBottomHudViewModel = {
    twistRatio: number;
    torsoOffsetDegrees: string;
    throttlePercent: number;
    throttleDirectionLabel: string;
    forwardFillHeight: string;
    reverseFillHeight: string;
    displaySpeed: number;
    speedFillPercent: number;
    hpFillPercent: number;
    hpLabel: string;
    steamFillPercent: number;
    steamLabel: string;
    steamWarning: boolean;
    bodyHeadingLabel: string;
    torsoHeadingLabel: string;
    twistHeadingLabel: string;
};

export type DesktopOverlayViewModel = {
    reticleX: number;
    reticleY: number;
    hitConfirmRatio: number;
    hitTargetRatio: number;
    showAlignPrompt: boolean;
    alignPrompt: TranslationDescriptor;
};

export type DesktopCombatHudViewModel = {
    cockpitFrame: DesktopCockpitFrameViewModel | null;
    hostBadge: DesktopHostBadgeViewModel | null;
    pilotPanel: DesktopPilotPanelViewModel;
    overlay: DesktopOverlayViewModel;
    bottomHud: DesktopBottomHudViewModel;
};
