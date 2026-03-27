/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { initGame } from './core/Engine';

type SessionMode = 'solo' | 'host' | 'client';
type SectionName = 'head' | 'centerTorso' | 'leftTorso' | 'rightTorso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
type SectionState = Record<SectionName, number>;

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
    aimOffsetX: number;
    aimOffsetY: number;
    hitConfirm: number;
    hitTargetHp: number;
    hitTargetMaxHp: number;
    sections: SectionState;
    maxSections: SectionState;
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
    aimOffsetX: 0,
    aimOffsetY: 0,
    hitConfirm: 0,
    hitTargetHp: 0,
    hitTargetMaxHp: 100,
    sections: { ...defaultSections },
    maxSections: { ...defaultSections }
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

function HeadingTape(props: { legYaw: number; torsoYaw: number; maxTwist: number }) {
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
                ВЗГЛЯД
            </div>
            <div className="absolute left-1/2 top-1 -translate-x-1/2">
                <div className="h-0 w-0 border-x-[8px] border-x-transparent border-t-[14px] border-t-[#7ee6f0] drop-shadow-[0_0_8px_rgba(126,230,240,0.55)]" />
            </div>

            <div className="absolute top-[7px] text-[10px] font-bold tracking-[0.36em] text-[#efb768]" style={{ left: `calc(50% + ${bodyOffsetPx}px)`, transform: 'translateX(-50%)' }}>
                ШАССИ
            </div>
            <div className="absolute top-2" style={{ left: `calc(50% + ${bodyOffsetPx}px)`, transform: 'translateX(-50%)' }}>
                <div className="h-0 w-0 border-x-[8px] border-x-transparent border-t-[14px] border-t-[#efb768] drop-shadow-[0_0_10px_rgba(239,183,104,0.55)]" />
            </div>

            <div className="absolute left-5 bottom-2 text-[11px] tracking-[0.22em] text-[#9cb5bb]">ТОРС {centerHeading.toString().padStart(3, '0')}</div>
            <div className="absolute right-5 bottom-2 text-[11px] tracking-[0.22em] text-[#d0b07a]">КОРПУС {chassisHeading.toString().padStart(3, '0')}</div>
        </div>
    );
}

function TorsoTwistArc(props: { twistRatio: number; maxTwist: number }) {
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
                ПРЕДЕЛ СКРУТКИ {Math.round(toDegrees(maxTwist))} ГР
            </div>
        </div>
    );
}

function CockpitFrame(props: { warning: string; throttleLabel: string }) {
    const { warning, throttleLabel } = props;

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
                {warning}
            </div>
            <div className="absolute left-1/2 bottom-[214px] -translate-x-1/2 rounded-full border border-[#5f4d2e]/70 bg-[rgba(7,7,7,0.82)] px-5 py-2 text-[10px] tracking-[0.4em] text-[#a7c1c8]">
                {throttleLabel}
            </div>
        </div>
    );
}

function SectionArmorDisplay(props: { sections: SectionState; maxSections: SectionState }) {
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
            title={section}
        />
    );

    return (
        <div className="rounded-[24px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
            <div className="text-center text-[9px] tracking-[0.28em] text-[#efb768]">СЕКЦИИ</div>
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

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const copyResetRef = useRef<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [inLobby, setInLobby] = useState(true);
    const [hostId, setHostId] = useState('');
    const [myId, setMyId] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [sessionMode, setSessionMode] = useState<SessionMode>('solo');
    const [showPilotPanel, setShowPilotPanel] = useState(true);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
    const [gameInstance, setGameInstance] = useState<any>(null);
    const [gameState, setGameState] = useState<GameHudState>(initialGameState);

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

    const startGame = async (mode: SessionMode, targetHostId?: string) => {
        if (!canvasRef.current) return;
        setInLobby(false);
        setLoading(true);
        setShowPilotPanel(true);
        setSessionMode(mode);
        setCopyState('idle');

        const game = await initGame(canvasRef.current, (state: GameHudState) => {
            setGameState({ ...state });
        }, mode);

        setGameInstance(game);

        if (mode === 'solo') {
            setMyId('');
            setIsHost(false);
            setLoading(false);
            return;
        }

        if (mode === 'host') {
            game.network.initAsHost((id: string) => {
                setMyId(id);
                setIsHost(true);
                setLoading(false);
            });
        } else if (targetHostId) {
            game.setClientMode();
            game.network.initAsClient(targetHostId, (id: string) => {
                setMyId(id);
                setIsHost(false);
                setLoading(false);
            }, (err: any) => {
                console.error(err);
                alert(`Ошибка подключения: ${err}`);
                game.stop();
                setGameInstance(null);
                setSessionMode('solo');
                setIsHost(false);
                setMyId('');
                setInLobby(true);
                setLoading(false);
            });
        }
    };

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
            if (inLobby || loading || event.repeat || event.code !== 'KeyH') return;

            const target = event.target;
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

            event.preventDefault();
            setShowPilotPanel((current) => !current);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [inLobby, loading]);

    const torsoOffset = angleDiff(gameState.legYaw, gameState.torsoYaw);
    const twistRatio = gameState.maxTwist > 0 ? clamp(torsoOffset / gameState.maxTwist, -1, 1) : 0;
    const throttleRatio = clamp(gameState.throttle, -0.45, 1);
    const hpRatio = gameState.maxHp > 0 ? gameState.hp / gameState.maxHp : 0;
    const steamRatio = gameState.maxSteam > 0 ? gameState.steam / gameState.maxSteam : 0;
    const displaySpeed = Math.round((gameState.speed / Math.max(gameState.maxSpeed, 0.1)) * 86);
    const throttleText = throttleRatio > 0.05
        ? `ТЯГА ${Math.round(throttleRatio * 100)}%`
        : throttleRatio < -0.05
            ? `РЕВЕРС ${Math.round(-throttleRatio * 100)}%`
            : 'ТЯГА НОЛЬ';
    const warningText = gameState.isOverheated
        ? `ПАРОВОЙ ЗАМОК ${gameState.overheatTimer.toFixed(1)}С`
        : Math.abs(twistRatio) > 0.86
            ? 'ПРЕДЕЛ ТОРСА'
            : Math.abs(twistRatio) > 0.6
                ? 'ЦЕНТРОВАТЬ ТОРС [C]'
                : throttleRatio < -0.05
                    ? 'ЗАДНИЙ ХОД'
                    : throttleRatio > 0.7
                        ? 'ПОЛНЫЙ ХОД'
                        : 'КРЕЙСЕРСКИЙ ХОД';

    const zeroLineTop = 69;
    const forwardFillHeight = `${Math.max(0, throttleRatio) * zeroLineTop}%`;
    const reverseFillHeight = `${Math.max(0, -throttleRatio / 0.45) * (100 - zeroLineTop)}%`;
    const reticleX = Math.max(-320, Math.min(320, gameState.aimOffsetX * 320));
    const reticleY = Math.max(-220, Math.min(220, -gameState.aimOffsetY * 180));
    const hitConfirmRatio = clamp(gameState.hitConfirm / 0.22, 0, 1);
    const hitTargetRatio = clamp(gameState.hitTargetHp / Math.max(gameState.hitTargetMaxHp, 1), 0, 1);
    const sessionLabel = sessionMode === 'solo'
        ? 'ЛОКАЛЬНЫЙ БОЙ'
        : isHost
            ? 'КАНАЛ ХОСТА'
            : 'КАНАЛ КЛИЕНТА';
    const copyLabel = copyState === 'copied'
        ? 'СКОПИРОВАНО'
        : copyState === 'error'
            ? 'НЕ УДАЛОСЬ'
            : 'КОПИРОВАТЬ';

    return (
        <div className="relative h-screen w-full overflow-hidden bg-[#100d0b] font-mono text-[#f2ddb1]">
            <canvas ref={canvasRef} className={`block h-full w-full ${inLobby ? 'hidden' : ''}`} />

            {inLobby ? (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#2a1c12_0%,#130e0b_60%,#090807_100%)] text-white">
                    <h1 className="mb-8 text-4xl font-bold tracking-[0.35em] text-[#efb768] drop-shadow-[0_0_14px_rgba(239,183,104,0.45)]">
                        ПАРОМАГИЧЕСКИЙ КОКПИТ
                    </h1>

                    <div className="flex w-96 flex-col gap-6 rounded-2xl border border-[#8f6a38]/40 bg-black/45 p-8 backdrop-blur-sm">
                        <button
                            onClick={() => startGame('solo')}
                            className="rounded bg-[#7d4f22] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(125,79,34,0.35)] transition-colors hover:bg-[#99622d]"
                        >
                            БОЙ С БОТОМ
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-[#8f6a38]/30" />
                            <span className="text-sm tracking-[0.35em] text-[#d2b78d]/60">СЕТЬ</span>
                            <div className="h-px flex-1 bg-[#8f6a38]/30" />
                        </div>

                        <button
                            onClick={() => startGame('host')}
                            className="rounded bg-[#b0622d] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(176,98,45,0.35)] transition-colors hover:bg-[#ca7240]"
                        >
                            СОЗДАТЬ СЕССИЮ
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-[#8f6a38]/30" />
                            <span className="text-sm tracking-[0.35em] text-[#d2b78d]/60">ИЛИ</span>
                            <div className="h-px flex-1 bg-[#8f6a38]/30" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                placeholder="ID ХОСТА"
                                value={hostId}
                                onChange={(e) => setHostId(e.target.value)}
                                className="rounded border border-[#8f6a38]/40 bg-black/65 px-4 py-2 text-[#f5dba8] outline-none focus:border-[#efb768]"
                            />
                            <button
                                onClick={() => startGame('client', hostId)}
                                disabled={!hostId}
                                className="rounded bg-[#24677e] py-3 font-bold tracking-[0.22em] text-white shadow-[0_0_15px_rgba(36,103,126,0.35)] transition-colors hover:bg-[#2f7d99] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                ПОДКЛЮЧИТЬСЯ
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {loading && !inLobby ? (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#130e0b]/95">
                    <div className="rounded-full border border-[#8f6a38]/50 bg-black/55 px-8 py-4 text-xl tracking-[0.35em] text-[#efb768]">
                        ГЕРМЕТИЗАЦИЯ КАБИНЫ
                    </div>
                </div>
            ) : null}

            {!loading && !inLobby ? (
                <>
                    <CockpitFrame warning={warningText} throttleLabel={throttleText} />

                    {sessionMode === 'host' && myId ? (
                        <div className="pointer-events-auto absolute right-4 top-4 z-30 flex items-center gap-3 rounded-2xl border border-[#8f6a38]/45 bg-[rgba(10,10,10,0.78)] px-4 py-3 text-[#e1cea7] shadow-[0_0_22px_rgba(0,0,0,0.32)] backdrop-blur-sm">
                            <div className="min-w-0">
                                <div className="text-[10px] tracking-[0.34em] text-[#8fb8c2]">ID ХОСТА</div>
                                <div className="mt-1 select-all font-bold tracking-[0.18em] text-[#efb768]">{myId}</div>
                            </div>

                            <button
                                type="button"
                                onClick={copyHostId}
                                className="shrink-0 rounded-full border border-[#8f6a38]/55 bg-black/40 px-4 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                            >
                                {copyLabel}
                            </button>
                        </div>
                    ) : null}

                    <div className="absolute left-4 top-4 z-20">
                        {showPilotPanel ? (
                            <div className="pointer-events-auto max-w-[280px] rounded-2xl border border-[#8f6a38]/35 bg-[rgba(10,10,10,0.62)] p-4 text-sm text-[#d7c5a1] shadow-[0_0_20px_rgba(0,0,0,0.38)] backdrop-blur-sm">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h1 className="text-lg font-bold tracking-[0.32em] text-[#efb768]">ПАНЕЛЬ ПИЛОТА</h1>
                                        <p className="mt-2 text-xs tracking-[0.22em] text-[#8fb8c2]">
                                            {sessionMode === 'solo' ? sessionLabel : `${sessionLabel} | ID ${myId || 'СИНХРОНИЗАЦИЯ'}`}
                                        </p>
                                        {sessionMode === 'host' && myId ? (
                                            <button
                                                type="button"
                                                onClick={copyHostId}
                                                className="mt-3 rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-1 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                                            >
                                                {copyLabel}
                                            </button>
                                        ) : null}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowPilotPanel(false)}
                                        className="rounded-full border border-[#8f6a38]/55 bg-black/45 px-3 py-1 text-[10px] tracking-[0.24em] text-[#cdb488] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                                    >
                                        СКРЫТЬ [H]
                                    </button>
                                </div>

                                <ul className="space-y-1 text-[11px] tracking-[0.18em] text-[#b9c7c8]">
                                    <li><span className="text-[#efb768]">МЫШЬ</span> наводка торса</li>
                                    <li><span className="text-[#efb768]">W / S</span> поднять / сбросить тягу</li>
                                    <li><span className="text-[#efb768]">A / D</span> повернуть шасси</li>
                                    <li><span className="text-[#efb768]">C</span> центрировать торс</li>
                                    <li><span className="text-[#efb768]">X</span> отсечь тягу</li>
                                    <li><span className="text-[#efb768]">ЛКМ</span> рунный болт</li>
                                    <li><span className="text-[#efb768]">SHIFT</span> рывок</li>
                                    <li><span className="text-[#efb768]">SPACE</span> сброс пара</li>
                                </ul>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowPilotPanel(true)}
                                className="pointer-events-auto rounded-full border border-[#8f6a38]/55 bg-[rgba(10,10,10,0.72)] px-4 py-2 text-[10px] tracking-[0.3em] text-[#cdb488] shadow-[0_0_18px_rgba(0,0,0,0.3)] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                            >
                                ПАНЕЛЬ [H]
                            </button>
                        )}
                    </div>

                    <TorsoTwistArc twistRatio={twistRatio} maxTwist={gameState.maxTwist} />

                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-45">
                        <div className="absolute left-0 top-1/2 h-[2px] w-3 -translate-y-1/2 bg-[#dde4e6]/40" />
                        <div className="absolute right-0 top-1/2 h-[2px] w-3 -translate-y-1/2 bg-[#dde4e6]/40" />
                        <div className="absolute left-1/2 top-0 h-3 w-[2px] -translate-x-1/2 bg-[#dde4e6]/40" />
                        <div className="absolute bottom-0 left-1/2 h-3 w-[2px] -translate-x-1/2 bg-[#dde4e6]/40" />
                    </div>

                    <div
                        className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-8 w-8 opacity-95"
                        style={{
                            transform: `translate(calc(-50% + ${reticleX}px), calc(-50% + ${reticleY}px))`
                        }}
                    >
                        <div className="absolute left-0 top-1/2 h-[2px] w-3 -translate-y-1/2 bg-[#7ee6f0] shadow-[0_0_10px_currentColor]" />
                        <div className="absolute right-0 top-1/2 h-[2px] w-3 -translate-y-1/2 bg-[#7ee6f0] shadow-[0_0_10px_currentColor]" />
                        <div className="absolute left-1/2 top-0 h-3 w-[2px] -translate-x-1/2 bg-[#7ee6f0] shadow-[0_0_10px_currentColor]" />
                        <div className="absolute bottom-0 left-1/2 h-3 w-[2px] -translate-x-1/2 bg-[#7ee6f0] shadow-[0_0_10px_currentColor]" />
                        <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#efb768] shadow-[0_0_10px_rgba(239,183,104,0.8)]" />
                        {hitConfirmRatio > 0 ? (
                            <>
                                <div className="absolute left-[1px] top-[1px] h-[2px] w-3 rotate-[-45deg] bg-[#fff0c9]" style={{ opacity: hitConfirmRatio }} />
                                <div className="absolute right-[1px] top-[1px] h-[2px] w-3 rotate-[45deg] bg-[#fff0c9]" style={{ opacity: hitConfirmRatio }} />
                                <div className="absolute bottom-[1px] left-[1px] h-[2px] w-3 rotate-[45deg] bg-[#fff0c9]" style={{ opacity: hitConfirmRatio }} />
                                <div className="absolute bottom-[1px] right-[1px] h-[2px] w-3 rotate-[-45deg] bg-[#fff0c9]" style={{ opacity: hitConfirmRatio }} />
                            </>
                        ) : null}
                    </div>

                    {hitConfirmRatio > 0 ? (
                        <div
                            className="pointer-events-none absolute left-1/2 top-1/2 z-30"
                            style={{
                                transform: `translate(calc(-50% + ${reticleX}px), calc(-50% + ${reticleY - 48}px))`,
                                opacity: hitConfirmRatio
                            }}
                        >
                            <div className="rounded-full border border-[#8f6a38]/60 bg-[rgba(8,8,8,0.84)] px-4 py-2 shadow-[0_0_18px_rgba(0,0,0,0.28)]">
                                <div className="text-center text-[10px] tracking-[0.34em] text-[#fff0c9]">ПОПАДАНИЕ</div>
                                <div className="mt-2 h-1.5 w-28 rounded-full bg-[#2b231d]">
                                    <div
                                        className="h-full rounded-full bg-[linear-gradient(90deg,#f25c54,#efb768,#7ee6f0)]"
                                        style={{ width: `${hitTargetRatio * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {Math.abs(twistRatio) > 0.55 ? (
                        <div className="pointer-events-none absolute left-1/2 top-[58%] z-30 -translate-x-1/2 rounded-full border border-[#8f6a38]/60 bg-black/55 px-4 py-2 text-[11px] tracking-[0.36em] text-[#efb768]">
                            ВЫРОВНЯТЬ ШАССИ [C]
                        </div>
                    ) : null}

                    <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 flex h-[248px] w-[min(1040px,96vw)] -translate-x-1/2 items-end justify-between px-8 pb-8">
                        <div className="flex w-[190px] items-end gap-4">
                            <div className="relative h-[188px] w-20 rounded-[26px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                                <div className="mb-2 text-center text-[10px] tracking-[0.42em] text-[#efb768]">ТЯГА</div>
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
                                <div className="absolute left-3 top-[44px] text-[9px] tracking-[0.28em] text-[#b8a17a]">ВПР</div>
                                <div className="absolute left-3 top-[112px] text-[9px] tracking-[0.32em] text-[#b8a17a]">0</div>
                                <div className="absolute left-3 bottom-[18px] text-[9px] tracking-[0.28em] text-[#9dc2cc]">НАЗ</div>
                            </div>

                            <div className="flex-1 rounded-[26px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-4 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                                <div className="text-[10px] tracking-[0.34em] text-[#efb768]">ХОД</div>
                                <div className="mt-3 text-3xl font-bold tracking-[0.2em] text-[#f3deb5]">
                                    {Math.round(throttleRatio * 100)}
                                </div>
                                <div className="mt-1 text-[11px] tracking-[0.28em] text-[#a5bcc2]">
                                    {throttleRatio > 0.05 ? 'ВПЕРЕД' : throttleRatio < -0.05 ? 'РЕВЕРС' : 'СТОП'}
                                </div>
                                <div className="mt-4 text-[10px] tracking-[0.32em] text-[#8db0b7]">
                                    УВОД ТОРСА {Math.round(toDegrees(torsoOffset)).toString().padStart(3, ' ')} ГР
                                </div>
                            </div>
                        </div>

                        <div className="mx-6 flex min-w-0 flex-1 flex-col items-center gap-4">
                            <HeadingTape legYaw={gameState.legYaw} torsoYaw={gameState.torsoYaw} maxTwist={gameState.maxTwist} />

                            <div className="grid w-full grid-cols-3 gap-3 text-center">
                                <div className="rounded-2xl border border-[#8f6a38]/60 bg-black/35 px-4 py-3">
                                    <div className="text-[10px] tracking-[0.34em] text-[#a1bdc4]">КОРПУС</div>
                                    <div className="mt-1 text-xl font-bold tracking-[0.22em] text-[#efb768]">
                                        {wrapDegrees(Math.round(toDegrees(gameState.legYaw))).toString().padStart(3, '0')}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-[#8f6a38]/60 bg-black/35 px-4 py-3">
                                    <div className="text-[10px] tracking-[0.34em] text-[#a1bdc4]">ТОРС</div>
                                    <div className="mt-1 text-xl font-bold tracking-[0.22em] text-[#7ee6f0]">
                                        {wrapDegrees(Math.round(toDegrees(gameState.torsoYaw))).toString().padStart(3, '0')}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-[#8f6a38]/60 bg-black/35 px-4 py-3">
                                    <div className="text-[10px] tracking-[0.34em] text-[#a1bdc4]">СКРУТКА</div>
                                    <div className="mt-1 text-xl font-bold tracking-[0.18em] text-[#f3deb5]">
                                        {Math.round(toDegrees(torsoOffset))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex w-[250px] gap-4">
                            <div className="flex-1 rounded-[26px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-4 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                                <div className="text-[10px] tracking-[0.34em] text-[#efb768]">СКОРОСТЬ</div>
                                <div className="mt-3 text-4xl font-bold tracking-[0.18em] text-[#f3deb5]">
                                    {displaySpeed}
                                </div>
                                <div className="mt-1 text-[11px] tracking-[0.28em] text-[#a5bcc2]">КМ/Ч</div>
                                <div className="mt-4 h-2 rounded-full bg-[#241c16]">
                                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#7ee6f0,#efb768)]" style={{ width: `${clamp((gameState.speed / Math.max(gameState.maxSpeed, 0.1)) * 100, 0, 100)}%` }} />
                                </div>
                            </div>

                            <div className="flex w-[132px] flex-col gap-3">
                                <SectionArmorDisplay sections={gameState.sections} maxSections={gameState.maxSections} />

                                <div className="rounded-[24px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                                    <div className="text-[9px] tracking-[0.3em] text-[#efb768]">БРОНЯ</div>
                                    <div className="mt-2 h-2 rounded-full bg-[#241c16]">
                                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#d04838,#f0b371)]" style={{ width: `${clamp(hpRatio * 100, 0, 100)}%` }} />
                                    </div>
                                    <div className="mt-2 text-xs tracking-[0.16em] text-[#f3deb5]">{Math.ceil(gameState.hp)} / {gameState.maxHp}</div>
                                </div>

                                <div className={`rounded-[24px] border p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)] ${gameState.isOverheated ? 'border-[#f25c54]/70 bg-[linear-gradient(180deg,rgba(64,18,18,0.94),rgba(28,12,12,0.96))]' : 'border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))]'}`}>
                                    <div className="text-[9px] tracking-[0.28em] text-[#efb768]">ДАВЛЕНИЕ</div>
                                    <div className="mt-2 h-2 rounded-full bg-[#241c16]">
                                        <div className={`h-full rounded-full ${gameState.isOverheated ? 'bg-[linear-gradient(90deg,#ff8855,#f25c54)]' : 'bg-[linear-gradient(90deg,#efb768,#7ee6f0)]'}`} style={{ width: `${clamp(steamRatio * 100, 0, 100)}%` }} />
                                    </div>
                                    <div className="mt-2 text-xs tracking-[0.14em] text-[#f3deb5]">
                                        {gameState.isOverheated ? `СБРОС ${gameState.overheatTimer.toFixed(1)}С` : `${Math.ceil(gameState.steam)} / ${gameState.maxSteam}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
