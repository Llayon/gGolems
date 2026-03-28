/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { initGame } from './core/Engine';
import type { NetworkStartupErrorCode } from './network/NetworkManager';
import { getFirebaseLobbyStatus } from './firebase/client';
import { registerFirebaseLobby, subscribeFirebaseLobbies, type FirebaseLobbyRegistration, type FirebaseLobbyRoom } from './firebase/lobbyRegistry';
import { CombatOverlayCore } from './ui/mobile/CombatOverlayCore';
import { MobileCombatLayout } from './ui/mobile/MobileCombatLayout';
import { MobileSettingsOverlay } from './ui/mobile/MobileSettingsOverlay';
import { createTranslator, getInitialLocale, saveLocale, translateMessage, type TranslationDescriptor, type TranslationKey, type Translator } from './i18n';
import { formatPercent, formatSeconds, formatSpeedUnit } from './i18n/format';
import type { Locale } from './i18n/types';
import type { WeaponStatusView } from './combat/weaponTypes';
import type { ControlPointView, GameMode, TeamOverview, TeamScoreState } from './gameplay/types';

type SessionMode = 'solo' | 'host' | 'client';
type SectionName = 'head' | 'centerTorso' | 'leftTorso' | 'rightTorso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
type SectionState = Record<SectionName, number>;
type RadarContact = {
    x: number;
    y: number;
    kind: 'enemy' | 'bot';
    distance: number;
    meters: number;
};

type GameHudState = {
    hp: number;
    maxHp: number;
    steam: number;
    maxSteam: number;
    isOverheated: boolean;
    overheatTimer: number;
    legYaw: number;
    torsoYaw: number;
    throttle: number;
    speed: number;
    maxSpeed: number;
    maxTwist: number;
    cameraMode: 'cockpit' | 'thirdPerson';
    aimOffsetX: number;
    aimOffsetY: number;
    hitConfirm: number;
    hitTargetHp: number;
    hitTargetMaxHp: number;
    sections: SectionState;
    maxSections: SectionState;
    weaponStatus: WeaponStatusView[];
    radarContacts: RadarContact[];
    gameMode: GameMode;
    controlPoints: ControlPointView[];
    teamScores: TeamScoreState;
    teamOverview: TeamOverview;
    respawnTimer: number;
    terrainColliderMode: 'heightfield' | 'trimeshFallback';
    terrainColliderError: string;
};

const defaultSections: SectionState = {
    head: 18,
    centerTorso: 48,
    leftTorso: 34,
    rightTorso: 34,
    leftArm: 24,
    rightArm: 24,
    leftLeg: 36,
    rightLeg: 36
};

const sectionLabelKeys: Record<SectionName, TranslationKey> = {
    head: 'hud.section.head',
    centerTorso: 'hud.section.centerTorso',
    leftTorso: 'hud.section.leftTorso',
    rightTorso: 'hud.section.rightTorso',
    leftArm: 'hud.section.leftArm',
    rightArm: 'hud.section.rightArm',
    leftLeg: 'hud.section.leftLeg',
    rightLeg: 'hud.section.rightLeg'
};

type StartupPhase = 'startWorld' | 'createSession' | 'connectToHost';

type StartupFailureCode = NetworkStartupErrorCode | 'timeout' | 'hostIdRequired' | 'unknown';

type StartupFailure = {
    code: StartupFailureCode;
    phase?: StartupPhase;
    seconds?: number;
    detail?: string;
    cause?: unknown;
};

const startupPhaseLabelKeys: Record<StartupPhase, TranslationKey> = {
    startWorld: 'errors.startWorld',
    createSession: 'errors.createSession',
    connectToHost: 'errors.connectToHost'
};

const initialGameState: GameHudState = {
    hp: 100,
    maxHp: 100,
    steam: 100,
    maxSteam: 100,
    isOverheated: false,
    overheatTimer: 0,
    legYaw: 0,
    torsoYaw: 0,
    throttle: 0,
    speed: 0,
    maxSpeed: 10,
    maxTwist: 1.75,
    cameraMode: 'cockpit',
    aimOffsetX: 0,
    aimOffsetY: 0,
    hitConfirm: 0,
    hitTargetHp: 0,
    hitTargetMaxHp: 100,
    sections: { ...defaultSections },
    maxSections: { ...defaultSections },
    weaponStatus: [],
    radarContacts: [],
    gameMode: 'control',
    controlPoints: [],
    teamScores: { blue: 0, red: 0, scoreToWin: 200, winner: null },
    teamOverview: {
        blue: { alive: 5, total: 5, waveTimer: 0 },
        red: { alive: 5, total: 5, waveTimer: 0 }
    },
    respawnTimer: 0,
    terrainColliderMode: 'heightfield',
    terrainColliderError: ''
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function angleDiff(from: number, to: number) {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
}

function toDegrees(radians: number) {
    return radians * (180 / Math.PI);
}

function wrapDegrees(degrees: number) {
    let wrapped = degrees % 360;
    if (wrapped < 0) wrapped += 360;
    return wrapped;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + radius * Math.cos(angleRad),
        y: cy + radius * Math.sin(angleRad)
    };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

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

function describeError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return typeof error === 'string' ? error : fallback;
}

function isStartupFailure(error: unknown): error is StartupFailure {
    if (!error || typeof error !== 'object') return false;
    return 'code' in error && typeof (error as { code?: unknown }).code === 'string';
}

function toStartupFailure(error: unknown, phase?: StartupPhase): StartupFailure {
    if (isStartupFailure(error)) {
        return phase && !error.phase
            ? { ...error, phase }
            : error;
    }

    return {
        code: 'unknown',
        phase,
        detail: describeError(error, ''),
        cause: error
    };
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

function withTimeout<T>(promiseFactory: () => Promise<T>, timeoutMs: number, timeoutFailure: StartupFailure) {
    return new Promise<T>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            reject(timeoutFailure);
        }, timeoutMs);

        try {
            promiseFactory().then(
                (value) => {
                    window.clearTimeout(timeoutId);
                    resolve(value);
                },
                (error) => {
                    window.clearTimeout(timeoutId);
                    reject(error);
                }
            );
        } catch (error) {
            window.clearTimeout(timeoutId);
            reject(error);
        }
    });
}

function HeadingTape(props: { legYaw: number; torsoYaw: number; maxTwist: number; t: Translator }) {
    const { legYaw, torsoYaw, maxTwist } = props;
    const bodyOffsetPx = clamp(angleDiff(torsoYaw, legYaw) / (maxTwist * 1.1), -1, 1) * 184;
    const centerHeading = wrapDegrees(Math.round(toDegrees(torsoYaw)));
    const chassisHeading = wrapDegrees(Math.round(toDegrees(legYaw)));
    const ticks = Array.from({ length: 17 }, (_, index) => index - 8);

    return (
        <div className="relative h-24 overflow-hidden rounded-[28px] border border-[#9d7740]/70 bg-[linear-gradient(180deg,rgba(21,18,13,0.96),rgba(8,8,7,0.96))] shadow-[inset_0_0_20px_rgba(0,0,0,0.55),0_0_20px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-x-5 top-4 h-px bg-[#7f653e]/60" />
            <div className="absolute inset-x-5 top-[36px] h-[1px] bg-[#2e9bb4]/20" />
            {ticks.map((tick) => {
                const left = `calc(50% + ${tick * 44}px)`;
                const label = wrapDegrees(centerHeading + tick * 15);
                const major = tick % 2 === 0;
                return (
                    <div key={tick} className="absolute top-2 bottom-2" style={{ left }}>
                        <div className={`absolute top-4 -translate-x-1/2 rounded-full ${major ? 'h-6 w-[2px] bg-[#d0b07a]' : 'h-3 w-px bg-[#78603b]'}`} />
                        {major ? (
                            <div className="absolute top-11 -translate-x-1/2 text-[10px] tracking-[0.28em] text-[#c5b187]/90">
                                {label.toString().padStart(3, '0')}
                            </div>
                        ) : null}
                    </div>
                );
            })}

            <div className="absolute left-1/2 top-[7px] -translate-x-1/2 text-[10px] font-bold tracking-[0.42em] text-[#7ee6f0]">
                {props.t('hud.heading.gaze')}
            </div>
            <div className="absolute left-1/2 top-1 -translate-x-1/2">
                <div className="h-0 w-0 border-x-[8px] border-x-transparent border-t-[14px] border-t-[#7ee6f0] drop-shadow-[0_0_8px_rgba(126,230,240,0.55)]" />
            </div>

            <div className="absolute top-[7px] text-[10px] font-bold tracking-[0.36em] text-[#efb768]" style={{ left: `calc(50% + ${bodyOffsetPx}px)`, transform: 'translateX(-50%)' }}>
                {props.t('hud.heading.chassis')}
            </div>
            <div className="absolute top-2" style={{ left: `calc(50% + ${bodyOffsetPx}px)`, transform: 'translateX(-50%)' }}>
                <div className="h-0 w-0 border-x-[8px] border-x-transparent border-t-[14px] border-t-[#efb768] drop-shadow-[0_0_10px_rgba(239,183,104,0.55)]" />
            </div>

            <div className="absolute left-5 bottom-2 text-[11px] tracking-[0.22em] text-[#9cb5bb]">{props.t('hud.heading.torso')} {centerHeading.toString().padStart(3, '0')}</div>
            <div className="absolute right-5 bottom-2 text-[11px] tracking-[0.22em] text-[#d0b07a]">{props.t('hud.body')} {chassisHeading.toString().padStart(3, '0')}</div>
        </div>
    );
}

function TorsoTwistArc(props: { twistRatio: number; maxTwist: number; t: Translator }) {
    const { twistRatio, maxTwist } = props;
    const clampedRatio = clamp(twistRatio, -1, 1);
    const pipAngle = 270 + clampedRatio * 60;
    const trackPath = describeArc(110, 110, 84, 210, 330);
    const leftLimit = polarToCartesian(110, 110, 84, 210);
    const rightLimit = polarToCartesian(110, 110, 84, 330);
    const pip = polarToCartesian(110, 110, 84, pipAngle);
    const segmentPath = clampedRatio >= 0
        ? describeArc(110, 110, 84, 270, pipAngle)
        : describeArc(110, 110, 84, pipAngle, 270);

    return (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2">
            <svg viewBox="0 0 220 220" className="h-full w-full overflow-visible">
                <path d={trackPath} fill="none" stroke="rgba(123,104,72,0.75)" strokeWidth="6" strokeLinecap="round" />
                <path d={segmentPath} fill="none" stroke={Math.abs(clampedRatio) > 0.78 ? '#ff9f43' : '#7ee6f0'} strokeWidth="5" strokeLinecap="round" />
                <circle cx={pip.x} cy={pip.y} r="6.5" fill={Math.abs(clampedRatio) > 0.78 ? '#ff9f43' : '#7ee6f0'} />
                <circle cx="110" cy="110" r="3.5" fill="#d0b07a" />
                <circle cx={leftLimit.x} cy={leftLimit.y} r="4" fill="#9d7740" />
                <circle cx={rightLimit.x} cy={rightLimit.y} r="4" fill="#9d7740" />
            </svg>
            <div className="absolute inset-x-0 bottom-[18px] text-center text-[10px] tracking-[0.46em] text-[#a0bcc3]">
                {props.t('hud.torsoLimitDegrees', { degrees: Math.round(toDegrees(maxTwist)) })}
            </div>
        </div>
    );
}

function CockpitFrame(props: { warning: TranslationDescriptor; throttleLabel: TranslationDescriptor; t: Translator }) {
    const { warning, throttleLabel, t } = props;

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.08)_48%,rgba(0,0,0,0.32)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0)_18%,rgba(0,0,0,0)_68%,rgba(255,164,63,0.05)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(255,255,255,0.045),rgba(255,255,255,0)_22%,rgba(255,255,255,0)_76%,rgba(255,255,255,0.03))]" />

            <div className="absolute inset-x-0 top-0 h-20 border-b border-[#7f653e]/70 bg-[linear-gradient(180deg,rgba(80,55,30,0.95),rgba(28,20,14,0.92),rgba(0,0,0,0))] shadow-[0_8px_18px_rgba(0,0,0,0.35)]" />
            <div className="absolute left-0 top-0 bottom-0 w-28 border-r border-[#7f653e]/60 bg-[linear-gradient(90deg,rgba(54,39,24,0.96),rgba(22,17,13,0.78),rgba(0,0,0,0))]" />
            <div className="absolute right-0 top-0 bottom-0 w-28 border-l border-[#7f653e]/60 bg-[linear-gradient(270deg,rgba(54,39,24,0.96),rgba(22,17,13,0.78),rgba(0,0,0,0))]" />

            <div className="absolute left-[72px] top-12 bottom-[170px] w-5 rounded-full border border-[#9d7740]/70 bg-[linear-gradient(180deg,#5b4125,#241911)] shadow-[0_0_20px_rgba(0,0,0,0.45)]" />
            <div className="absolute right-[72px] top-12 bottom-[170px] w-5 rounded-full border border-[#9d7740]/70 bg-[linear-gradient(180deg,#5b4125,#241911)] shadow-[0_0_20px_rgba(0,0,0,0.45)]" />
            <div className="absolute left-[58px] top-[86px] h-3 w-14 rotate-[-18deg] rounded-full border border-[#b18c53]/60 bg-[#3d2b18]" />
            <div className="absolute right-[58px] top-[86px] h-3 w-14 rotate-[18deg] rounded-full border border-[#b18c53]/60 bg-[#3d2b18]" />

            <div className="absolute bottom-0 left-1/2 h-[248px] w-[min(1040px,96vw)] -translate-x-1/2 rounded-t-[44px] border border-[#8b6636]/80 bg-[linear-gradient(180deg,rgba(69,50,31,0.98),rgba(19,15,12,0.98))] shadow-[0_-14px_32px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,220,168,0.08)]" />
            <div className="absolute bottom-[202px] left-1/2 h-7 w-[min(920px,84vw)] -translate-x-1/2 rounded-full border border-[#a67d47]/50 bg-[linear-gradient(180deg,rgba(94,67,37,0.92),rgba(31,24,18,0.72))]" />
            <div className="absolute left-1/2 top-[52px] flex -translate-x-1/2 gap-3">
                {['#efb768', '#7ee6f0', '#efb768', '#f36f58', '#efb768'].map((color, index) => (
                    <div
                        key={`${color}-${index}`}
                        className="h-2.5 w-8 rounded-full border border-black/30 shadow-[0_0_12px_rgba(0,0,0,0.35)]"
                        style={{ backgroundColor: color, opacity: index === 3 ? 0.92 : 0.72 }}
                    />
                ))}
            </div>
            <div className="absolute bottom-[226px] left-1/2 flex w-[min(860px,78vw)] -translate-x-1/2 justify-between px-8">
                {Array.from({ length: 9 }, (_, index) => (
                    <div key={index} className="h-3 w-3 rounded-full border border-[#2c2014] bg-[linear-gradient(180deg,#c89a58,#5f4425)] shadow-[inset_0_1px_1px_rgba(255,236,196,0.3)]" />
                ))}
            </div>

            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-[#8f6a38]/70 bg-[rgba(12,10,8,0.82)] px-6 py-2 text-[11px] tracking-[0.42em] text-[#f1bd6e] shadow-[0_0_18px_rgba(0,0,0,0.4)]">
                {translateMessage(t, warning)}
            </div>
            <div className="absolute left-1/2 bottom-[214px] -translate-x-1/2 rounded-full border border-[#5f4d2e]/70 bg-[rgba(7,7,7,0.82)] px-5 py-2 text-[10px] tracking-[0.4em] text-[#a7c1c8]">
                {translateMessage(t, throttleLabel)}
            </div>
        </div>
    );
}

function SectionArmorDisplay(props: { sections: SectionState; maxSections: SectionState; t: Translator }) {
    const { sections, maxSections } = props;

    const ratioOf = (section: SectionName) => clamp(sections[section] / Math.max(maxSections[section], 1), 0, 1);
    const colorOf = (section: SectionName) => {
        const ratio = ratioOf(section);
        if (ratio <= 0) return '#291d16';
        if (ratio < 0.35) return '#f25c54';
        if (ratio < 0.7) return '#efb768';
        return '#7ee6f0';
    };

    const sectionBox = (section: SectionName, className: string) => (
        <div
            className={`absolute rounded-[12px] border border-[#5b4427]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${className}`}
            style={{ backgroundColor: colorOf(section), opacity: 0.2 + ratioOf(section) * 0.8 }}
            title={props.t(sectionLabelKeys[section])}
        />
    );

    return (
        <div className="rounded-[24px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
            <div className="text-center text-[9px] tracking-[0.28em] text-[#efb768]">{props.t('hud.sections')}</div>
            <div className="relative mx-auto mt-3 h-[130px] w-[120px]">
                {sectionBox('head', 'left-1/2 top-0 h-4 w-4 -translate-x-1/2')}
                {sectionBox('centerTorso', 'left-1/2 top-5 h-9 w-7 -translate-x-1/2')}
                {sectionBox('leftTorso', 'left-[25px] top-7 h-7 w-5')}
                {sectionBox('rightTorso', 'right-[25px] top-7 h-7 w-5')}
                {sectionBox('leftArm', 'left-0 top-7 h-8 w-5')}
                {sectionBox('rightArm', 'right-0 top-7 h-8 w-5')}
                {sectionBox('leftLeg', 'left-[42px] bottom-0 h-12 w-4')}
                {sectionBox('rightLeg', 'right-[42px] bottom-0 h-12 w-4')}
            </div>
        </div>
    );
}

function WeaponRack(props: { weapons: WeaponStatusView[]; locale: Locale; t: Translator }) {
    if (props.weapons.length === 0) return null;

    return (
        <div className="w-full rounded-[24px] border border-[#8f6a38]/60 bg-black/28 p-3 shadow-[inset_0_0_16px_rgba(0,0,0,0.38)]">
            <div className="mb-2 text-center text-[10px] tracking-[0.32em] text-[#a1bdc4]">{props.t('hud.weapons')}</div>
            <div className="grid grid-cols-3 gap-2">
                {props.weapons.map((weapon) => {
                    const stateTone = weapon.state === 'ready'
                        ? 'text-[#7ee6f0] border-[#2e829a]/55'
                        : weapon.state === 'recycle'
                            ? 'text-[#efb768] border-[#8f6a38]/55'
                            : weapon.state === 'offline'
                                ? 'text-[#8d7760] border-[#5a4630]/40'
                                : 'text-[#f25c54] border-[#9a433c]/50';
                    const baseStateLabel = weapon.state === 'ready'
                        ? props.t('weapon.state.ready')
                        : weapon.state === 'recycle'
                            ? props.t('weapon.state.recycle')
                            : weapon.state === 'offline'
                                ? props.t('weapon.state.offline')
                                : props.t('weapon.state.heat');
                    const stateLabel = weapon.state === 'recycle'
                        ? `${baseStateLabel} ${formatSeconds(props.locale, weapon.cooldownRemaining)}`
                        : baseStateLabel;

                    return (
                        <div key={weapon.mountId} className={`rounded-2xl border bg-[rgba(10,10,10,0.76)] px-3 py-2 ${stateTone}`}>
                            <div className="flex items-center justify-between text-[9px] tracking-[0.22em]">
                                <span>{props.t('weapon.group', { group: weapon.group })}</span>
                                <span className="text-[#c6b08a]">{weapon.heatCost}</span>
                            </div>
                            <div className="mt-1 text-sm font-bold tracking-[0.18em] text-[#f3deb5]">{props.t(weapon.shortKey)}</div>
                            <div className="mt-1 text-[9px] tracking-[0.18em]">{stateLabel}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function getPointStatusText(points: ControlPointView[], t: Translator, locale: Locale) {
    const contestedPoint = points.find((point) => point.contested);
    if (contestedPoint) {
        return t('hud.point.contested', { point: contestedPoint.id });
    }

    const activePoint = points.find((point) => {
        const blueSecuring = point.blueInside > 0 && point.redInside === 0 && !(point.owner === 'blue' && point.capture >= 0.99);
        const redSecuring = point.redInside > 0 && point.blueInside === 0 && !(point.owner === 'red' && point.capture <= -0.99);
        return blueSecuring || redSecuring;
    });

    if (activePoint) {
        const blueSecuring = activePoint.blueInside > 0 && activePoint.redInside === 0;
        return t('hud.point.securing', {
            team: t(blueSecuring ? 'hud.team.blue' : 'hud.team.red'),
            point: activePoint.id,
            progress: formatPercent(locale, Math.abs(activePoint.capture) * 100)
        });
    }

    const blueOwned = points.filter((point) => point.owner === 'blue').length;
    const redOwned = points.filter((point) => point.owner === 'red').length;
    if (blueOwned === 0 && redOwned === 0) {
        return t('hud.point.neutral');
    }
    if (blueOwned === redOwned) {
        return t('hud.point.split', { blue: blueOwned, red: redOwned });
    }

    return t('hud.point.holding', {
        team: t(blueOwned > redOwned ? 'hud.team.blue' : 'hud.team.red'),
        count: Math.max(blueOwned, redOwned)
    });
}

function getHeldPoints(points: ControlPointView[], owner: 'blue' | 'red') {
    return points.filter((point) => point.owner === owner).length;
}

function MatchStatusOverlay(props: { scores: TeamScoreState; points: ControlPointView[]; teamOverview: TeamOverview; respawnTimer: number; isTouchDevice: boolean; locale: Locale; gameMode: GameMode; t: Translator }) {
    const pointTone = (point: ControlPointView) => point.contested
        ? 'border-[#b57d3c]/60 bg-[#f0b35c]/16 text-[#ffd489]'
        : point.owner === 'blue'
            ? 'border-[#3d8fb4]/60 bg-[#57bde8]/20 text-[#8ee6ff]'
            : point.owner === 'red'
                ? 'border-[#a24f39]/60 bg-[#f26b4a]/18 text-[#ffb49b]'
                : 'border-[#8f6a38]/55 bg-black/25 text-[#e6c78c]';
    const pointStatus = props.gameMode === 'control'
        ? getPointStatusText(props.points, props.t, props.locale)
        : props.t('hud.mode.tdm');
    const objectiveLabel = props.gameMode === 'control' ? props.t('hud.results.points') : props.t('hud.results.objective');
    const waveLabels = (['blue', 'red'] as const)
        .map((team) => {
            const waveTimer = props.teamOverview[team].waveTimer;
            if (waveTimer <= 0.05) return null;
            return props.t('hud.wave.team', {
                team: props.t(team === 'blue' ? 'hud.team.blue' : 'hud.team.red'),
                seconds: formatSeconds(props.locale, waveTimer)
            });
        })
        .filter(Boolean) as string[];
    const blueHeld = getHeldPoints(props.points, 'blue');
    const redHeld = getHeldPoints(props.points, 'red');

    return (
        <>
            <div
                className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2"
                style={{
                    top: props.isTouchDevice ? 'calc(env(safe-area-inset-top, 0px) + 72px)' : '58px'
                }}
            >
                <div className={`rounded-[26px] border border-[#8f6a38]/55 bg-[rgba(8,8,8,0.78)] px-4 py-2 shadow-[0_0_18px_rgba(0,0,0,0.32)] ${props.isTouchDevice ? 'min-w-[260px]' : 'min-w-[360px]'}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-center">
                            <div className="text-[9px] tracking-[0.28em] text-[#7ee6f0]">{props.t('hud.team.blue')}</div>
                            <div className="mt-0.5 text-2xl font-bold tracking-[0.14em] text-[#8ee6ff]">{props.scores.blue}</div>
                        </div>
                        {props.gameMode === 'control' ? (
                            <div className="flex items-center gap-1.5">
                                {props.points.map((point) => (
                                    <div key={point.id} className={`min-w-[42px] rounded-full border px-3 py-1 text-center text-xs font-bold tracking-[0.18em] ${pointTone(point)}`}>
                                        {point.id}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-full border border-[#8f6a38]/55 bg-black/25 px-4 py-1 text-center text-[10px] tracking-[0.24em] text-[#e6c78c]">
                                {props.t('hud.mode.tdm')}
                            </div>
                        )}
                        <div className="text-center">
                            <div className="text-[9px] tracking-[0.28em] text-[#f39f7a]">{props.t('hud.team.red')}</div>
                            <div className="mt-0.5 text-2xl font-bold tracking-[0.14em] text-[#ffb49b]">{props.scores.red}</div>
                        </div>
                    </div>
                    <div className="mt-1 text-center text-[9px] tracking-[0.24em] text-[#cbb48a]">
                        {props.t('hud.scoreTarget', { score: props.scores.scoreToWin })}
                    </div>
                    <div className="mt-1 text-center text-[10px] tracking-[0.18em] text-[#e7d3aa]">
                        {pointStatus}
                    </div>
                    {waveLabels.length > 0 ? (
                        <div className="mt-1 text-center text-[9px] tracking-[0.18em] text-[#c6d7d8]">
                            {waveLabels.join('  |  ')}
                        </div>
                    ) : null}
                </div>
            </div>

            {props.scores.winner ? (
                <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(18,16,12,0.44),rgba(5,5,5,0.74))] px-4">
                    <div className={`w-full max-w-[560px] rounded-[28px] border bg-[rgba(10,10,10,0.88)] px-6 py-5 shadow-[0_0_28px_rgba(0,0,0,0.42)] ${props.scores.winner === 'blue' ? 'border-[#3d8fb4]/60 text-[#8ee6ff]' : 'border-[#a24f39]/60 text-[#ffb49b]'}`}>
                        <div className="text-center text-[10px] tracking-[0.34em] text-[#f0d8ab]">
                            {props.t('hud.results.title')}
                        </div>
                        <div className="mt-2 text-center text-[13px] tracking-[0.3em]">
                            {props.t(props.scores.winner === 'blue' ? 'hud.victory.blue' : 'hud.victory.red')}
                        </div>
                        <div className="mt-1 text-center text-[9px] tracking-[0.22em] text-[#f0d8ab]">
                            {props.t('hud.matchLocked')}
                        </div>
                        <div className="mt-4 grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-2 text-center text-[9px] tracking-[0.22em] text-[#bfa987]">
                            <div>{props.t('hud.results.team')}</div>
                            <div>{props.t('hud.results.score')}</div>
                            <div>{objectiveLabel}</div>
                            <div>{props.t('hud.results.active')}</div>
                            <div>{props.t('hud.results.wave')}</div>
                        </div>
                        <div className="mt-2 space-y-2">
                            <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-2 rounded-2xl border border-[#3d8fb4]/40 bg-[rgba(20,44,52,0.34)] px-3 py-3 text-center text-[11px] tracking-[0.18em] text-[#d8f7ff]">
                                <div>{props.t('hud.team.blue')}</div>
                                <div>{props.scores.blue}</div>
                                <div>{props.gameMode === 'control' ? blueHeld : props.t('hud.results.none')}</div>
                                <div>{props.teamOverview.blue.alive}/{props.teamOverview.blue.total}</div>
                                <div>{props.teamOverview.blue.waveTimer > 0.05 ? formatSeconds(props.locale, props.teamOverview.blue.waveTimer) : props.t('hud.results.none')}</div>
                            </div>
                            <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-2 rounded-2xl border border-[#a24f39]/40 bg-[rgba(48,22,18,0.34)] px-3 py-3 text-center text-[11px] tracking-[0.18em] text-[#ffe1d7]">
                                <div>{props.t('hud.team.red')}</div>
                                <div>{props.scores.red}</div>
                                <div>{props.gameMode === 'control' ? redHeld : props.t('hud.results.none')}</div>
                                <div>{props.teamOverview.red.alive}/{props.teamOverview.red.total}</div>
                                <div>{props.teamOverview.red.waveTimer > 0.05 ? formatSeconds(props.locale, props.teamOverview.red.waveTimer) : props.t('hud.results.none')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {props.respawnTimer > 0 && !props.scores.winner ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
                    <div className="rounded-[30px] border border-[#8f6a38]/60 bg-[rgba(8,8,8,0.86)] px-8 py-5 text-center shadow-[0_0_24px_rgba(0,0,0,0.42)]">
                        <div className="text-[11px] tracking-[0.34em] text-[#efb768]">{props.t('hud.respawn')}</div>
                        <div className="mt-2 text-4xl font-bold tracking-[0.14em] text-[#f3deb5]">{Math.ceil(props.respawnTimer)}</div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const copyResetRef = useRef<number | null>(null);
    const firebaseLobbyRef = useRef<FirebaseLobbyRegistration | null>(null);
    const [locale, setLocale] = useState<Locale>(() => getInitialLocale());
    const [loading, setLoading] = useState(false);
    const [inLobby, setInLobby] = useState(true);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);
    const [mobileLeftHanded, setMobileLeftHanded] = useState(false);
    const [mobileAimPreset, setMobileAimPreset] = useState<'LOW' | 'MID' | 'HIGH'>('MID');
    const [hostId, setHostId] = useState('');
    const [roomName, setRoomName] = useState('');
    const [myId, setMyId] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [sessionMode, setSessionMode] = useState<SessionMode>('solo');
    const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('control');
    const [roomFilter, setRoomFilter] = useState<'all' | GameMode>('all');
    const [showPilotPanel, setShowPilotPanel] = useState(true);
    const [showMobileSettings, setShowMobileSettings] = useState(false);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
    const [gameInstance, setGameInstance] = useState<any>(null);
    const [gameState, setGameState] = useState<GameHudState>(initialGameState);
    const [firebaseRooms, setFirebaseRooms] = useState<FirebaseLobbyRoom[]>([]);
    const t = createTranslator(locale);
    const firebaseLobbyStatus = getFirebaseLobbyStatus();

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

    const startGame = async (mode: SessionMode, targetHostId?: string, requestedMode: GameMode = selectedGameMode) => {
        if (!canvasRef.current) return;
        setInLobby(false);
        setLoading(true);
        setShowPilotPanel(!isTouchDevice);
        setShowMobileSettings(false);
        setSessionMode(mode);
        setCopyState('idle');
        let game: any = null;

        const failStart = (error: unknown) => {
            console.error(error);
            if (game) {
                game.stop();
            }
            void firebaseLobbyRef.current?.unregister();
            firebaseLobbyRef.current = null;
            setGameInstance(null);
            setSessionMode('solo');
            setIsHost(false);
            setMyId('');
            setInLobby(true);
            setLoading(false);
            alert(getStartupFailureMessage(t, locale, toStartupFailure(error)));
        };

        try {
            game = await withTimeout(
                async () => {
                    try {
                        return await initGame(canvasRef.current!, (state: GameHudState) => {
                            setGameState({ ...state });
                        }, mode, requestedMode);
                    } catch (error) {
                        throw toStartupFailure(error, 'startWorld');
                    }
                },
                15000,
                { code: 'timeout', phase: 'startWorld', seconds: 15 }
            );

            setGameInstance(game);

            if (mode === 'solo') {
                setMyId('');
                setIsHost(false);
                setLoading(false);
                return;
            }

            if (mode === 'host') {
                const createdHostId = await withTimeout(
                    () => new Promise<string>((resolve, reject) => {
                        game.network.initAsHost(resolve, (error) => reject(toStartupFailure(error, 'createSession')));
                    }),
                    15000,
                    { code: 'timeout', phase: 'createSession', seconds: 15 }
                );
                setMyId(createdHostId);
                setIsHost(true);
                if (firebaseLobbyStatus.enabled) {
                    firebaseLobbyRef.current = await registerFirebaseLobby(createdHostId, requestedMode, roomName);
                }
                setLoading(false);
                return;
            }

            if (targetHostId) {
                game.setClientMode();
                const clientId = await withTimeout(
                    () => new Promise<string>((resolve, reject) => {
                        game.network.initAsClient(targetHostId, resolve, (error) => reject(toStartupFailure(error, 'connectToHost')));
                    }),
                    15000,
                    { code: 'timeout', phase: 'connectToHost', seconds: 15 }
                );
                setMyId(clientId);
                setIsHost(false);
                setLoading(false);
                return;
            }

            throw { code: 'hostIdRequired' } satisfies StartupFailure;
        } catch (error) {
            failStart(error);
        }
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
            if (handed === 'left') setMobileLeftHanded(true);
            if (preset === 'LOW' || preset === 'MID' || preset === 'HIGH') {
                setMobileAimPreset(preset);
            }
        } catch {
            // Ignore storage access issues.
        }
    }, []);

    useEffect(() => {
        saveLocale(locale);
    }, [locale]);

    useEffect(() => {
        if (!inLobby || !firebaseLobbyStatus.enabled) {
            setFirebaseRooms([]);
            return;
        }

        return subscribeFirebaseLobbies(setFirebaseRooms);
    }, [firebaseLobbyStatus.enabled, inLobby]);

    useEffect(() => {
        return () => {
            void firebaseLobbyRef.current?.unregister();
            firebaseLobbyRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!firebaseLobbyStatus.enabled || !firebaseLobbyRef.current || !isHost || inLobby) {
            return;
        }

        const pushLobbyMeta = () => {
            const currentPlayers = 1 + (gameInstance?.remotePlayers?.size ?? 0);
            void firebaseLobbyRef.current?.updateMeta({
                currentPlayers,
                inProgress: true
            });
        };

        pushLobbyMeta();
        const timer = window.setInterval(pushLobbyMeta, 2500);
        return () => window.clearInterval(timer);
    }, [firebaseLobbyStatus.enabled, gameInstance, inLobby, isHost, loading]);

    useEffect(() => {
        try {
            window.localStorage.setItem('golems_mobile_handed', mobileLeftHanded ? 'left' : 'right');
            window.localStorage.setItem('golems_mobile_aim_preset', mobileAimPreset);
        } catch {
            // Ignore storage access issues.
        }
    }, [mobileAimPreset, mobileLeftHanded]);

    useEffect(() => {
        return () => {
            if (copyResetRef.current !== null) {
                window.clearTimeout(copyResetRef.current);
            }
            if (gameInstance) gameInstance.stop();
        };
    }, [gameInstance]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (isTouchDevice || inLobby || loading || event.repeat || event.code !== 'KeyH') return;

            const target = event.target;
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

            event.preventDefault();
            setShowPilotPanel((current) => !current);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [inLobby, isTouchDevice, loading]);

    const torsoOffset = angleDiff(gameState.legYaw, gameState.torsoYaw);
    const twistRatio = gameState.maxTwist > 0 ? clamp(torsoOffset / gameState.maxTwist, -1, 1) : 0;
    const throttleRatio = clamp(gameState.throttle, -0.45, 1);
    const hpRatio = gameState.maxHp > 0 ? gameState.hp / gameState.maxHp : 0;
    const steamRatio = gameState.maxSteam > 0 ? gameState.steam / gameState.maxSteam : 0;
    const displaySpeed = Math.round((gameState.speed / Math.max(gameState.maxSpeed, 0.1)) * 68);
    const throttleMessage: TranslationDescriptor = throttleRatio > 0.05
        ? { key: 'hud.throttle.forward', params: { percent: formatPercent(locale, Math.round(throttleRatio * 100)) } }
        : throttleRatio < -0.05
            ? { key: 'hud.throttle.reverse', params: { percent: formatPercent(locale, Math.round(-throttleRatio * 100)) } }
            : { key: 'hud.throttle.zero' };
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

    const zeroLineTop = 69;
    const forwardFillHeight = `${Math.max(0, throttleRatio) * zeroLineTop}%`;
    const reverseFillHeight = `${Math.max(0, -throttleRatio / 0.45) * (100 - zeroLineTop)}%`;
    const reticleX = Math.max(-320, Math.min(320, gameState.aimOffsetX * 320));
    const reticleY = Math.max(-220, Math.min(220, -gameState.aimOffsetY * 180));
    const hitConfirmRatio = clamp(gameState.hitConfirm / 0.22, 0, 1);
    const hitTargetRatio = clamp(gameState.hitTargetHp / Math.max(gameState.hitTargetMaxHp, 1), 0, 1);
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

    const cameraModeMessage: TranslationDescriptor = gameState.cameraMode === 'thirdPerson' ? 'camera.3p' : 'camera.fp';
    const terrainDebugMessage: TranslationDescriptor = gameState.terrainColliderMode === 'heightfield'
        ? 'hud.debug.terrainHF'
        : 'hud.debug.terrainTMFallback';
    const terrainDebugTone = gameState.terrainColliderMode === 'heightfield'
        ? 'text-[#8fb8c2]'
        : 'text-[#f3b56c]';
    const filteredFirebaseRooms = roomFilter === 'all'
        ? firebaseRooms
        : firebaseRooms.filter((room) => room.gameMode === roomFilter);
    const sessionLabel = translateMessage(t, sessionMessage);
    const copyTextLabel = translateMessage(t, copyMessage);
    const cameraModeLabel = translateMessage(t, cameraModeMessage);
    const terrainDebugLabel = translateMessage(t, terrainDebugMessage);
    const directJoinRoom = firebaseRooms.find((room) => room.hostPeerId.trim().toLowerCase() === hostId.trim().toLowerCase());
    const directJoinModeKey = directJoinRoom
        ? directJoinRoom.gameMode === 'tdm'
            ? 'lobby.mode.tdm'
            : 'lobby.mode.control'
        : null;
    const directJoinStatusKey = directJoinRoom?.inProgress ? 'lobby.roomState.live' : 'lobby.roomState.open';
    const sessionSummaryLabel = t(
        sessionMode === 'solo' ? 'pilot.summary.base' : 'pilot.summary.withId',
        sessionMode === 'solo'
            ? { session: sessionLabel, camera: cameraModeLabel }
            : { session: sessionLabel, camera: cameraModeLabel, idLabel: t('common.id'), id: myId || t('session.sync') }
    );
    const showCockpitDecor = !isTouchDevice && gameState.cameraMode === 'cockpit';
    const hostBadgeClass = 'pointer-events-auto absolute right-4 top-4 z-30 flex items-center gap-3 rounded-2xl border border-[#8f6a38]/45 bg-[rgba(10,10,10,0.78)] px-4 py-3 text-[#e1cea7] shadow-[0_0_22px_rgba(0,0,0,0.32)] backdrop-blur-sm';
    const pilotPanelAnchorClass = 'left-4 top-4';
    const pilotPanelHideLabel = t('pilot.hide');
    const pilotPanelShowLabel = t('pilot.show');
    const alignPromptMessage: TranslationDescriptor = isTouchDevice ? 'hud.alignChassis' : 'hud.alignChassisHotkey';
    const localeLabel = t('locale.current', { label: t('locale.label'), value: t(locale === 'ru' ? 'locale.ru' : 'locale.en') });
    return (
        <div className="relative h-[100dvh] w-full overflow-hidden bg-[#100d0b] font-mono text-[#f2ddb1]">
            <canvas ref={canvasRef} className={`block h-full w-full ${inLobby ? 'hidden' : ''}`} />

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
                />
            ) : null}

            {inLobby ? (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#2a1c12_0%,#130e0b_60%,#090807_100%)] px-4 text-white">
                    <button
                        type="button"
                        onClick={() => setLocale((current) => current === 'ru' ? 'en' : 'ru')}
                        className="absolute right-4 top-4 rounded-full border border-[#8f6a38]/55 bg-black/40 px-4 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                    >
                        {localeLabel}
                    </button>

                    <h1 className="mb-6 text-center text-2xl font-bold tracking-[0.22em] text-[#efb768] drop-shadow-[0_0_14px_rgba(239,183,104,0.45)] sm:mb-8 sm:text-4xl sm:tracking-[0.35em]">
                        {t('lobby.title')}
                    </h1>

                    <div className="flex w-[min(92vw,24rem)] flex-col gap-5 rounded-2xl border border-[#8f6a38]/40 bg-black/45 p-5 backdrop-blur-sm sm:gap-6 sm:p-8">
                        <div className="flex flex-col gap-2">
                            <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{t('lobby.modeTitle')}</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedGameMode('control')}
                                    className={`rounded-xl border px-4 py-3 text-[11px] font-bold tracking-[0.18em] transition-colors ${selectedGameMode === 'control' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                                >
                                    {t('lobby.mode.control')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedGameMode('tdm')}
                                    className={`rounded-xl border px-4 py-3 text-[11px] font-bold tracking-[0.18em] transition-colors ${selectedGameMode === 'tdm' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                                >
                                    {t('lobby.mode.tdm')}
                                </button>
                            </div>
                            <div className="text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                                {t(selectedGameMode === 'control' ? 'lobby.modeHint.control' : 'lobby.modeHint.tdm')}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{t('lobby.roomNameTitle')}</div>
                            <input
                                type="text"
                                placeholder={t('lobby.roomNamePlaceholder')}
                                value={roomName}
                                maxLength={32}
                                onChange={(e) => setRoomName(e.target.value)}
                                className="rounded border border-[#8f6a38]/40 bg-black/65 px-4 py-2 text-[#f5dba8] outline-none focus:border-[#efb768]"
                            />
                            <div className="text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                                {t('lobby.roomNameHint')}
                            </div>
                        </div>

                        <button
                            onClick={() => startGame('solo')}
                            className="rounded bg-[#7d4f22] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(125,79,34,0.35)] transition-colors hover:bg-[#99622d]"
                        >
                            {t('lobby.soloBot')}
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-[#8f6a38]/30" />
                            <span className="text-sm tracking-[0.35em] text-[#d2b78d]/60">{t('common.network')}</span>
                            <div className="h-px flex-1 bg-[#8f6a38]/30" />
                        </div>

                        <button
                            onClick={() => startGame('host')}
                            className="rounded bg-[#b0622d] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(176,98,45,0.35)] transition-colors hover:bg-[#ca7240]"
                        >
                            {t('lobby.createSession')}
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-[#8f6a38]/30" />
                            <span className="text-sm tracking-[0.35em] text-[#d2b78d]/60">{t('common.or')}</span>
                            <div className="h-px flex-1 bg-[#8f6a38]/30" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{t('lobby.directJoinTitle')}</div>
                            <input
                                type="text"
                                placeholder={t('lobby.hostIdPlaceholder')}
                                value={hostId}
                                onChange={(e) => setHostId(e.target.value)}
                                className="rounded border border-[#8f6a38]/40 bg-black/65 px-4 py-2 text-[#f5dba8] outline-none focus:border-[#efb768]"
                            />
                            <button
                                onClick={() => startGame('client', hostId)}
                                disabled={!hostId}
                                className="rounded bg-[#24677e] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(36,103,126,0.35)] transition-colors hover:bg-[#2f7d99] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t('lobby.connect')}
                            </button>
                            {hostId.trim() ? (
                                <div className="text-center text-[11px] tracking-[0.14em] text-[#d7c5a1]">
                                    {directJoinModeKey
                                        ? t('lobby.directJoinResolved', {
                                            mode: t(directJoinModeKey),
                                            players: directJoinRoom?.currentPlayers ?? 1,
                                            max: directJoinRoom?.maxPlayers ?? 5,
                                            state: t(directJoinStatusKey)
                                        })
                                        : firebaseLobbyStatus.enabled
                                            ? t('lobby.directJoinUnknown')
                                            : t('lobby.directJoinHint')}
                                </div>
                            ) : null}
                            <div className="text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                                {t('lobby.directJoinHint')}
                            </div>
                        </div>

                        {firebaseLobbyStatus.enabled ? (
                            <div className="flex flex-col gap-2 border-t border-[#8f6a38]/30 pt-4">
                                <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{t('lobby.availableRooms')}</div>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRoomFilter('all')}
                                        className={`rounded-xl border px-2 py-2 text-[10px] font-bold tracking-[0.16em] transition-colors ${roomFilter === 'all' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                                    >
                                        {t('lobby.filter.all')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRoomFilter('control')}
                                        className={`rounded-xl border px-2 py-2 text-[10px] font-bold tracking-[0.16em] transition-colors ${roomFilter === 'control' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                                    >
                                        {t('lobby.mode.control')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRoomFilter('tdm')}
                                        className={`rounded-xl border px-2 py-2 text-[10px] font-bold tracking-[0.16em] transition-colors ${roomFilter === 'tdm' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                                    >
                                        {t('lobby.mode.tdm')}
                                    </button>
                                </div>
                                {filteredFirebaseRooms.length > 0 ? (
                                    <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                                        {filteredFirebaseRooms.slice(0, 8).map((room) => (
                                            <button
                                                key={room.id}
                                                type="button"
                                                onClick={() => {
                                                    setHostId(room.hostPeerId);
                                                    setSelectedGameMode(room.gameMode);
                                                    void startGame('client', room.hostPeerId, room.gameMode);
                                                }}
                                                className="rounded-xl border border-[#8f6a38]/35 bg-black/35 px-4 py-3 text-left transition-colors hover:border-[#efb768]/60"
                                            >
                                                <div className="text-[10px] tracking-[0.26em] text-[#8fb8c2]">{t('lobby.roomCode')}</div>
                                                <div className="mt-1 truncate text-[12px] font-bold tracking-[0.16em] text-[#f3deb5]">{room.roomName}</div>
                                                <div className="mt-1 flex items-center justify-between gap-3">
                                                    <div className="font-bold tracking-[0.22em] text-[#efb768]">{room.shortCode}</div>
                                                    <div className="rounded-full border border-[#8f6a38]/45 bg-black/30 px-2 py-1 text-[9px] tracking-[0.18em] text-[#d7c5a1]">
                                                        {t(room.gameMode === 'tdm' ? 'lobby.mode.tdm' : 'lobby.mode.control')}
                                                    </div>
                                                </div>
                                                <div className="mt-1 flex items-center justify-between gap-3 text-[10px] tracking-[0.16em] text-[#bfa987]">
                                                    <div>{t('lobby.playerCount', { current: room.currentPlayers, max: room.maxPlayers })}</div>
                                                    <div>{t(room.inProgress ? 'lobby.roomState.live' : 'lobby.roomState.open')}</div>
                                                </div>
                                                <div className="mt-1 truncate text-[11px] tracking-[0.16em] text-[#d7c5a1]">{room.hostPeerId}</div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-[#8f6a38]/20 bg-black/25 px-4 py-3 text-center text-[11px] tracking-[0.18em] text-[#b9c7c8]">
                                        {roomFilter === 'all' ? t('lobby.noRooms') : t('lobby.noRoomsFiltered')}
                                    </div>
                                )}
                                <div className="text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                                    {t('lobby.firebaseOptional')}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-[#8f6a38]/20 bg-black/25 px-4 py-3 text-center text-[11px] tracking-[0.18em] text-[#b9c7c8]">
                                {t('lobby.firebaseDisabled')}
                            </div>
                        )}
                    </div>
                </div>
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
                    {showCockpitDecor ? <CockpitFrame warning={warningMessage} throttleLabel={throttleMessage} t={t} /> : null}
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

                    {sessionMode === 'host' && myId && !isTouchDevice ? (
                        <div className={hostBadgeClass}>
                            <div className="min-w-0">
                                <div className="text-[10px] tracking-[0.34em] text-[#8fb8c2]">{t('pilot.hostId')}</div>
                                <div className="mt-1 select-all font-bold tracking-[0.18em] text-[#efb768]">{myId}</div>
                            </div>

                            <button
                                type="button"
                                onClick={copyHostId}
                                className="shrink-0 rounded-full border border-[#8f6a38]/55 bg-black/40 px-4 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                            >
                                {copyTextLabel}
                            </button>
                        </div>
                    ) : null}

                    {!isTouchDevice ? (
                    <div className={`absolute z-20 ${pilotPanelAnchorClass}`}>
                        {showPilotPanel ? (
                            <div className={`pointer-events-auto rounded-2xl border border-[#8f6a38]/35 bg-[rgba(10,10,10,0.62)] p-4 text-sm text-[#d7c5a1] shadow-[0_0_20px_rgba(0,0,0,0.38)] backdrop-blur-sm ${isTouchDevice ? 'max-w-[220px] text-xs' : 'max-w-[280px]'}`}>
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h1 className="text-lg font-bold tracking-[0.32em] text-[#efb768]">{t('pilot.title')}</h1>
                                        <p className="mt-2 text-xs tracking-[0.22em] text-[#8fb8c2]">
                                            {sessionSummaryLabel}
                                        </p>
                                        <div className={`mt-2 text-[10px] tracking-[0.24em] ${terrainDebugTone}`}>
                                            {terrainDebugLabel}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setLocale((current) => current === 'ru' ? 'en' : 'ru')}
                                            className="mt-3 rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-1 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                                        >
                                            {localeLabel}
                                        </button>
                                        {sessionMode === 'host' && myId ? (
                                            <button
                                                type="button"
                                                onClick={copyHostId}
                                                className="mt-3 rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-1 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                                            >
                                                {copyTextLabel}
                                            </button>
                                        ) : null}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowPilotPanel(false)}
                                        className="rounded-full border border-[#8f6a38]/55 bg-black/45 px-3 py-1 text-[10px] tracking-[0.24em] text-[#cdb488] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                                    >
                                        {pilotPanelHideLabel}
                                    </button>
                                </div>

                                <ul className="space-y-1 text-[11px] tracking-[0.18em] text-[#b9c7c8]">
                                    <li>{t('pilot.controls.mouse')}</li>
                                    <li>{t('pilot.controls.ws')}</li>
                                    <li>{t('pilot.controls.ad')}</li>
                                    <li>{t('pilot.controls.c')}</li>
                                    <li>{t('pilot.controls.x')}</li>
                                    <li>{t('pilot.controls.v')}</li>
                                    <li>{t('pilot.controls.fire')}</li>
                                    <li>{t('pilot.controls.fire2')}</li>
                                    <li>{t('pilot.controls.fire3')}</li>
                                    <li>{t('pilot.controls.alpha')}</li>
                                    <li>{t('pilot.controls.shift')}</li>
                                    <li>{t('pilot.controls.space')}</li>
                                </ul>
                            </div>
                        ) : !isTouchDevice ? (
                            <button
                                type="button"
                                onClick={() => setShowPilotPanel(true)}
                                className="pointer-events-auto rounded-full border border-[#8f6a38]/55 bg-[rgba(10,10,10,0.72)] px-4 py-2 text-[10px] tracking-[0.3em] text-[#cdb488] shadow-[0_0_18px_rgba(0,0,0,0.3)] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                            >
                                {pilotPanelShowLabel}
                            </button>
                        ) : null}
                    </div>
                    ) : null}

                    {!isTouchDevice ? <TorsoTwistArc twistRatio={twistRatio} maxTwist={gameState.maxTwist} t={t} /> : null}

                    <CombatOverlayCore
                        reticleX={reticleX}
                        reticleY={reticleY}
                        hitConfirmRatio={hitConfirmRatio}
                        hitTargetRatio={hitTargetRatio}
                        showAlignPrompt={!isTouchDevice && Math.abs(twistRatio) > 0.55}
                        alignPrompt={alignPromptMessage}
                        t={t}
                    />

                    {!isTouchDevice ? (
                    <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 flex h-[248px] w-[min(1040px,96vw)] -translate-x-1/2 items-end justify-between px-8 pb-8">
                        <div className="flex w-[190px] items-end gap-4">
                            <div className="relative h-[188px] w-20 rounded-[26px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                                <div className="mb-2 text-center text-[10px] tracking-[0.42em] text-[#efb768]">{t('hud.throttle.label')}</div>
                                <div className="relative mx-auto h-[136px] w-7 rounded-full border border-[#6c5330]/70 bg-[#060606]/80">
                                    <div className="absolute inset-x-[4px] top-[69%] h-px bg-[#d1b17d]/75" />
                                    <div
                                        className="absolute bottom-[31%] left-[4px] right-[4px] rounded-b-full bg-[linear-gradient(180deg,#ffcc7e,#b6652f)] shadow-[0_0_12px_rgba(255,163,76,0.38)]"
                                        style={{ height: forwardFillHeight }}
                                    />
                                    <div
                                        className="absolute left-[4px] right-[4px] top-[69%] rounded-t-full bg-[linear-gradient(180deg,#7ee6f0,#2e829a)] shadow-[0_0_12px_rgba(46,130,154,0.3)]"
                                        style={{ height: reverseFillHeight }}
                                    />
                                </div>
                                <div className="absolute left-3 top-[44px] text-[9px] tracking-[0.28em] text-[#b8a17a]">{t('hud.throttle.forwardShort')}</div>
                                <div className="absolute left-3 top-[112px] text-[9px] tracking-[0.32em] text-[#b8a17a]">0</div>
                                <div className="absolute left-3 bottom-[18px] text-[9px] tracking-[0.28em] text-[#9dc2cc]">{t('hud.throttle.reverseShort')}</div>
                            </div>

                            <div className="flex-1 rounded-[26px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-4 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                                <div className="text-[10px] tracking-[0.34em] text-[#efb768]">{t('hud.move.label')}</div>
                                <div className="mt-3 text-3xl font-bold tracking-[0.2em] text-[#f3deb5]">
                                    {Math.round(throttleRatio * 100)}
                                </div>
                                <div className="mt-1 text-[11px] tracking-[0.28em] text-[#a5bcc2]">
                                    {throttleRatio > 0.05 ? t('hud.move.forward') : throttleRatio < -0.05 ? t('hud.move.reverse') : t('hud.move.stop')}
                                </div>
                                <div className="mt-4 text-[10px] tracking-[0.32em] text-[#8db0b7]">
                                    {t('hud.torsoOffset', { degrees: Math.round(toDegrees(torsoOffset)).toString().padStart(3, ' ') })}
                                </div>
                            </div>
                        </div>

                        <div className="mx-6 flex min-w-0 flex-1 flex-col items-center gap-4">
                            <HeadingTape legYaw={gameState.legYaw} torsoYaw={gameState.torsoYaw} maxTwist={gameState.maxTwist} t={t} />

                            <WeaponRack weapons={gameState.weaponStatus} locale={locale} t={t} />

                            <div className="grid w-full grid-cols-3 gap-3 text-center">
                                <div className="rounded-2xl border border-[#8f6a38]/60 bg-black/35 px-4 py-3">
                                    <div className="text-[10px] tracking-[0.34em] text-[#a1bdc4]">{t('hud.body')}</div>
                                    <div className="mt-1 text-xl font-bold tracking-[0.22em] text-[#efb768]">
                                        {wrapDegrees(Math.round(toDegrees(gameState.legYaw))).toString().padStart(3, '0')}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-[#8f6a38]/60 bg-black/35 px-4 py-3">
                                    <div className="text-[10px] tracking-[0.34em] text-[#a1bdc4]">{t('hud.torso')}</div>
                                    <div className="mt-1 text-xl font-bold tracking-[0.22em] text-[#7ee6f0]">
                                        {wrapDegrees(Math.round(toDegrees(gameState.torsoYaw))).toString().padStart(3, '0')}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-[#8f6a38]/60 bg-black/35 px-4 py-3">
                                    <div className="text-[10px] tracking-[0.34em] text-[#a1bdc4]">{t('hud.twist')}</div>
                                    <div className="mt-1 text-xl font-bold tracking-[0.18em] text-[#f3deb5]">
                                        {Math.round(toDegrees(torsoOffset))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex w-[250px] gap-4">
                            <div className="flex-1 rounded-[26px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-4 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                                <div className="text-[10px] tracking-[0.34em] text-[#efb768]">{t('hud.speed')}</div>
                                <div className="mt-3 text-4xl font-bold tracking-[0.18em] text-[#f3deb5]">
                                    {displaySpeed}
                                </div>
                                <div className="mt-1 text-[11px] tracking-[0.28em] text-[#a5bcc2]">{formatSpeedUnit(locale)}</div>
                                <div className="mt-4 h-2 rounded-full bg-[#241c16]">
                                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#7ee6f0,#efb768)]" style={{ width: `${clamp((gameState.speed / Math.max(gameState.maxSpeed, 0.1)) * 100, 0, 100)}%` }} />
                                </div>
                            </div>

                            <div className="flex w-[132px] flex-col gap-3">
                                <SectionArmorDisplay sections={gameState.sections} maxSections={gameState.maxSections} t={t} />

                                <div className="rounded-[24px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                                    <div className="text-[9px] tracking-[0.3em] text-[#efb768]">{t('hud.armor')}</div>
                                    <div className="mt-2 h-2 rounded-full bg-[#241c16]">
                                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#d04838,#f0b371)]" style={{ width: `${clamp(hpRatio * 100, 0, 100)}%` }} />
                                    </div>
                                    <div className="mt-2 text-xs tracking-[0.16em] text-[#f3deb5]">{Math.ceil(gameState.hp)} / {gameState.maxHp}</div>
                                </div>

                                <div className={`rounded-[24px] border p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)] ${gameState.isOverheated ? 'border-[#f25c54]/70 bg-[linear-gradient(180deg,rgba(64,18,18,0.94),rgba(28,12,12,0.96))]' : 'border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))]'}`}>
                                    <div className="text-[9px] tracking-[0.28em] text-[#efb768]">{t('hud.pressure')}</div>
                                    <div className="mt-2 h-2 rounded-full bg-[#241c16]">
                                        <div className={`h-full rounded-full ${gameState.isOverheated ? 'bg-[linear-gradient(90deg,#ff8855,#f25c54)]' : 'bg-[linear-gradient(90deg,#efb768,#7ee6f0)]'}`} style={{ width: `${clamp(steamRatio * 100, 0, 100)}%` }} />
                                    </div>
                                    <div className="mt-2 text-xs tracking-[0.14em] text-[#f3deb5]">
                                        {gameState.isOverheated ? t('hud.venting', { seconds: formatSeconds(locale, gameState.overheatTimer) }) : `${Math.ceil(gameState.steam)} / ${gameState.maxSteam}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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
                            locale={locale}
                            t={t}
                            onClose={() => setShowMobileSettings(false)}
                            onCopyHostId={copyHostId}
                            onToggleCameraMode={() => gameInstance?.toggleCameraMode?.()}
                            onToggleHanded={() => setMobileLeftHanded((current) => !current)}
                            onCycleAimPreset={() => setMobileAimPreset((current) => current === 'LOW' ? 'MID' : current === 'MID' ? 'HIGH' : 'LOW')}
                            onToggleLocale={() => setLocale((current) => current === 'ru' ? 'en' : 'ru')}
                        />
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
