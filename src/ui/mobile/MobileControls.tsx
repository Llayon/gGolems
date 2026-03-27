import { useRef, useState } from 'react';
import { clamp } from './helpers';

type MobileControlsProps = {
    game: any;
    leftHanded: boolean;
    isPortrait: boolean;
    aimSensitivity: number;
};

export function MobileControls(props: MobileControlsProps) {
    const moveAreaRef = useRef<HTMLDivElement>(null);
    const movePointerIdRef = useRef<number | null>(null);
    const aimPointerIdRef = useRef<number | null>(null);
    const aimLastRef = useRef<{ x: number; y: number } | null>(null);
    const [stick, setStick] = useState({ x: 0, y: 0 });
    const stickSize = props.isPortrait ? 132 : 144;
    const knobOffset = props.isPortrait ? 30 : 34;
    const bottomInset = props.isPortrait ? 12 : 10;
    const lookBottomInset = props.isPortrait ? 118 : 92;
    const sideInset = 12;
    const actionGapSide = 14;

    const ensureAudio = () => {
        props.game?.sounds?.init?.();
    };

    const updateStick = (clientX: number, clientY: number) => {
        const area = moveAreaRef.current;
        if (!area) return;
        const rect = area.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const normalizedX = clamp((clientX - centerX) / (rect.width * 0.32), -1, 1);
        const normalizedY = clamp((clientY - centerY) / (rect.height * 0.32), -1, 1);
        setStick({ x: normalizedX, y: normalizedY });
        props.game?.input?.setVirtualAxes?.(-normalizedY, normalizedX);
    };

    const resetStick = () => {
        movePointerIdRef.current = null;
        setStick({ x: 0, y: 0 });
        props.game?.input?.setVirtualAxes?.(0, 0);
    };

    const moveAnchorStyle = props.leftHanded
        ? { right: `calc(env(safe-area-inset-right, 0px) + ${sideInset}px)` }
        : { left: `calc(env(safe-area-inset-left, 0px) + ${sideInset}px)` };
    const lookAnchorStyle = props.leftHanded
        ? { left: `calc(env(safe-area-inset-left, 0px) + ${sideInset}px)` }
        : { right: `calc(env(safe-area-inset-right, 0px) + ${sideInset}px)` };
    const actionAnchorStyle = props.leftHanded
        ? { left: `calc(env(safe-area-inset-left, 0px) + ${actionGapSide}px)` }
        : { right: `calc(env(safe-area-inset-right, 0px) + ${actionGapSide}px)` };

    return (
        <div className="pointer-events-none absolute inset-0 z-40 touch-none">
            <div className="absolute" style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomInset}px)`, ...moveAnchorStyle }}>
                <div
                    ref={moveAreaRef}
                    className="pointer-events-auto relative rounded-full border border-[#8f6a38]/55 bg-[radial-gradient(circle_at_center,rgba(33,26,20,0.92),rgba(10,10,10,0.55))] shadow-[0_0_18px_rgba(0,0,0,0.28)]"
                    style={{ width: stickSize, height: stickSize }}
                    onPointerDown={(event) => {
                        ensureAudio();
                        movePointerIdRef.current = event.pointerId;
                        updateStick(event.clientX, event.clientY);
                    }}
                    onPointerMove={(event) => {
                        if (movePointerIdRef.current !== event.pointerId) return;
                        updateStick(event.clientX, event.clientY);
                    }}
                    onPointerUp={(event) => {
                        if (movePointerIdRef.current !== event.pointerId) return;
                        resetStick();
                    }}
                    onPointerCancel={(event) => {
                        if (movePointerIdRef.current !== event.pointerId) return;
                        resetStick();
                    }}
                >
                    <div className="absolute inset-5 rounded-full border border-[#6f5631]/40" />
                    <div className="absolute inset-x-0 top-2 text-center text-[9px] tracking-[0.28em] text-[#d1b17d]">ХОД / ПОВОРОТ</div>
                    <div
                        className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-[#efb768]/75 bg-[radial-gradient(circle_at_35%_35%,#efb768,#704623)] shadow-[0_0_18px_rgba(239,183,104,0.35)]"
                        style={{ transform: `translate(calc(-50% + ${stick.x * knobOffset}px), calc(-50% + ${stick.y * knobOffset}px))` }}
                    />
                </div>
            </div>

            <div
                className="pointer-events-auto absolute rounded-[28px] border border-[#8f6a38]/45 bg-[linear-gradient(180deg,rgba(20,18,16,0.18),rgba(10,10,10,0.04))]"
                style={{
                    ...lookAnchorStyle,
                    bottom: `calc(env(safe-area-inset-bottom, 0px) + ${lookBottomInset}px)`,
                    width: props.isPortrait ? '44vw' : '34vw',
                    maxWidth: props.isPortrait ? 220 : 260,
                    minWidth: props.isPortrait ? 168 : 180,
                    height: props.isPortrait ? 186 : 148
                }}
                onPointerDown={(event) => {
                    ensureAudio();
                    aimPointerIdRef.current = event.pointerId;
                    aimLastRef.current = { x: event.clientX, y: event.clientY };
                }}
                onPointerMove={(event) => {
                    if (aimPointerIdRef.current !== event.pointerId || !aimLastRef.current) return;
                    const dx = event.clientX - aimLastRef.current.x;
                    const dy = event.clientY - aimLastRef.current.y;
                    props.game?.input?.addVirtualLook?.(dx * props.aimSensitivity, dy * props.aimSensitivity);
                    aimLastRef.current = { x: event.clientX, y: event.clientY };
                }}
                onPointerUp={(event) => {
                    if (aimPointerIdRef.current !== event.pointerId) return;
                    aimPointerIdRef.current = null;
                    aimLastRef.current = null;
                }}
                onPointerCancel={(event) => {
                    if (aimPointerIdRef.current !== event.pointerId) return;
                    aimPointerIdRef.current = null;
                    aimLastRef.current = null;
                }}
            >
                <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_center,rgba(126,230,240,0.08),rgba(0,0,0,0))]" />
                <div className="absolute inset-x-0 top-3 text-center text-[9px] tracking-[0.3em] text-[#8fb8c2]">ОБЗОР</div>
            </div>

            <div
                className={`absolute flex flex-col gap-3 ${props.leftHanded ? 'items-start' : 'items-end'}`}
                style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomInset}px)`, ...actionAnchorStyle }}
            >
                <button
                    type="button"
                    className="pointer-events-auto rounded-full border border-[#7ee6f0]/65 bg-[radial-gradient(circle_at_30%_30%,rgba(126,230,240,0.72),rgba(31,72,82,0.86))] text-[11px] font-bold tracking-[0.2em] text-[#effcff] shadow-[0_0_22px_rgba(16,48,55,0.4)]"
                    style={{ width: props.isPortrait ? 84 : 76, height: props.isPortrait ? 84 : 76 }}
                    onPointerDown={() => {
                        ensureAudio();
                        props.game?.input?.triggerVirtualAction?.('fire');
                    }}
                >
                    ОГОНЬ
                </button>

                <div className="flex max-w-[220px] flex-wrap gap-2">
                    <button
                        type="button"
                        className="pointer-events-auto rounded-2xl border border-[#8f6a38]/60 bg-[rgba(10,10,10,0.78)] px-3 py-3 text-[10px] tracking-[0.22em] text-[#efb768]"
                        onPointerDown={() => {
                            ensureAudio();
                            props.game?.input?.triggerVirtualAction?.('dash');
                        }}
                    >
                        РЫВОК
                    </button>
                    <button
                        type="button"
                        className="pointer-events-auto rounded-2xl border border-[#8f6a38]/60 bg-[rgba(10,10,10,0.78)] px-3 py-3 text-[10px] tracking-[0.22em] text-[#efb768]"
                        onPointerDown={() => {
                            ensureAudio();
                            props.game?.input?.triggerVirtualAction?.('vent');
                        }}
                    >
                        ПАР
                    </button>
                </div>

                <div className="flex max-w-[240px] flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        className="pointer-events-auto rounded-2xl border border-[#8f6a38]/60 bg-[rgba(10,10,10,0.78)] px-3 py-2 text-[10px] tracking-[0.2em] text-[#d7c5a1]"
                        onPointerDown={() => props.game?.input?.triggerVirtualAction?.('centerTorso')}
                    >
                        ЦЕНТР ТОРС
                    </button>
                    <button
                        type="button"
                        className="pointer-events-auto rounded-2xl border border-[#8f6a38]/60 bg-[rgba(10,10,10,0.78)] px-3 py-2 text-[10px] tracking-[0.2em] text-[#d7c5a1]"
                        onPointerDown={() => props.game?.input?.triggerVirtualAction?.('stopThrottle')}
                    >
                        СТОП ХОД
                    </button>
                </div>
            </div>
        </div>
    );
}
