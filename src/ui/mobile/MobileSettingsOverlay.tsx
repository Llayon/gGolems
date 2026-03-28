import type { AimPreset, SessionMode } from './types';

type MobileSettingsOverlayProps = {
    open: boolean;
    isPortrait: boolean;
    sessionMode: SessionMode;
    sessionLabel: string;
    cameraMode: 'cockpit' | 'thirdPerson';
    myId: string;
    copyLabel: string;
    leftHanded: boolean;
    aimPreset: AimPreset;
    onClose: () => void;
    onCopyHostId: () => void;
    onToggleCameraMode: () => void;
    onToggleHanded: () => void;
    onCycleAimPreset: () => void;
};

export function MobileSettingsOverlay(props: MobileSettingsOverlayProps) {
    if (!props.open) return null;

    return (
        <div className="absolute inset-0 z-50 pointer-events-auto">
            <button
                type="button"
                aria-label="Закрыть настройки"
                className="absolute inset-0 bg-[rgba(0,0,0,0.56)]"
                onClick={props.onClose}
            />

            <div
                className={`absolute border border-[#8f6a38]/45 bg-[linear-gradient(180deg,rgba(14,13,11,0.96),rgba(8,8,8,0.94))] text-[#dfcca6] shadow-[0_0_28px_rgba(0,0,0,0.4)] ${props.isPortrait ? 'inset-x-0 bottom-0 rounded-t-[30px] border-b-0 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] pt-4' : 'right-[calc(env(safe-area-inset-right,0px)+18px)] top-[calc(env(safe-area-inset-top,0px)+18px)] w-[min(420px,62vw)] rounded-[28px] p-5'}`}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-[11px] tracking-[0.34em] text-[#8fb8c2]">НАСТРОЙКИ КОКПИТА</div>
                        <div className="mt-2 text-xs tracking-[0.24em] text-[#d3b886]">{props.sessionLabel}</div>
                    </div>
                    <button
                        type="button"
                        className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a]"
                        onClick={props.onClose}
                    >
                        ЗАКРЫТЬ
                    </button>
                </div>

                <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 p-3">
                        <div className="text-[10px] tracking-[0.28em] text-[#8fb8c2]">УПРАВЛЕНИЕ</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a]"
                                onClick={props.onToggleCameraMode}
                            >
                                {props.cameraMode === 'thirdPerson' ? 'VIEW 3P' : 'VIEW FP'}
                            </button>
                            <button
                                type="button"
                                className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a]"
                                onClick={props.onToggleHanded}
                            >
                                {props.leftHanded ? 'ЛЕВША' : 'ПРАВША'}
                            </button>
                            <button
                                type="button"
                                className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a]"
                                onClick={props.onCycleAimPreset}
                            >
                                ЧУВ {props.aimPreset}
                            </button>
                        </div>
                    </div>

                    {props.sessionMode === 'host' && props.myId ? (
                        <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 p-3">
                            <div className="text-[10px] tracking-[0.28em] text-[#8fb8c2]">ID ХОСТА</div>
                            <div className="mt-2 select-all break-all text-sm font-bold tracking-[0.16em] text-[#efb768]">
                                {props.myId}
                            </div>
                            <button
                                type="button"
                                className="mt-3 rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a]"
                                onClick={props.onCopyHostId}
                            >
                                {props.copyLabel}
                            </button>
                        </div>
                    ) : null}

                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 p-3">
                        <div className="text-[10px] tracking-[0.28em] text-[#8fb8c2]">ПОДСКАЗКИ</div>
                        <ul className="mt-3 space-y-2 text-[11px] tracking-[0.16em] text-[#d7c5a1]">
                            <li><span className="text-[#efb768]">ЛЕВЫЙ КРУГ</span> ход и поворот шасси</li>
                            <li><span className="text-[#efb768]">ПРАВАЯ ЗОНА</span> обзор и наведение торса</li>
                            <li><span className="text-[#efb768]">ОГОНЬ</span> рунный болт</li>
                            <li><span className="text-[#efb768]">РЫВОК / ПАР</span> манёвр и сброс давления</li>
                            <li><span className="text-[#efb768]">ЦЕНТР ТОРС</span> выровнять торс по шасси</li>
                            <li><span className="text-[#efb768]">СТОП ХОД</span> мгновенно сбросить тягу</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
