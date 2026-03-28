import type { Translator } from '../../i18n';

type CombatOverlayCoreProps = {
    reticleX: number;
    reticleY: number;
    hitConfirmRatio: number;
    hitTargetRatio: number;
    showAlignPrompt: boolean;
    alignPromptLabel: string;
    t: Translator;
};

export function CombatOverlayCore(props: CombatOverlayCoreProps) {
    return (
        <>
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-45">
                <div className="absolute left-0 top-1/2 h-[2px] w-3 -translate-y-1/2 bg-[#dde4e6]/40" />
                <div className="absolute right-0 top-1/2 h-[2px] w-3 -translate-y-1/2 bg-[#dde4e6]/40" />
                <div className="absolute left-1/2 top-0 h-3 w-[2px] -translate-x-1/2 bg-[#dde4e6]/40" />
                <div className="absolute bottom-0 left-1/2 h-3 w-[2px] -translate-x-1/2 bg-[#dde4e6]/40" />
            </div>

            <div
                className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-8 w-8 opacity-95"
                style={{
                    transform: `translate(calc(-50% + ${props.reticleX}px), calc(-50% + ${props.reticleY}px))`
                }}
            >
                <div className="absolute left-0 top-1/2 h-[2px] w-3 -translate-y-1/2 bg-[#7ee6f0] shadow-[0_0_10px_currentColor]" />
                <div className="absolute right-0 top-1/2 h-[2px] w-3 -translate-y-1/2 bg-[#7ee6f0] shadow-[0_0_10px_currentColor]" />
                <div className="absolute left-1/2 top-0 h-3 w-[2px] -translate-x-1/2 bg-[#7ee6f0] shadow-[0_0_10px_currentColor]" />
                <div className="absolute bottom-0 left-1/2 h-3 w-[2px] -translate-x-1/2 bg-[#7ee6f0] shadow-[0_0_10px_currentColor]" />
                <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#efb768] shadow-[0_0_10px_rgba(239,183,104,0.8)]" />
                {props.hitConfirmRatio > 0 ? (
                    <>
                        <div className="absolute left-[1px] top-[1px] h-[2px] w-3 rotate-[-45deg] bg-[#fff0c9]" style={{ opacity: props.hitConfirmRatio }} />
                        <div className="absolute right-[1px] top-[1px] h-[2px] w-3 rotate-[45deg] bg-[#fff0c9]" style={{ opacity: props.hitConfirmRatio }} />
                        <div className="absolute bottom-[1px] left-[1px] h-[2px] w-3 rotate-[45deg] bg-[#fff0c9]" style={{ opacity: props.hitConfirmRatio }} />
                        <div className="absolute bottom-[1px] right-[1px] h-[2px] w-3 rotate-[-45deg] bg-[#fff0c9]" style={{ opacity: props.hitConfirmRatio }} />
                    </>
                ) : null}
            </div>

            {props.hitConfirmRatio > 0 ? (
                <div
                    className="pointer-events-none absolute left-1/2 top-1/2 z-30"
                    style={{
                        transform: `translate(calc(-50% + ${props.reticleX}px), calc(-50% + ${props.reticleY - 48}px))`,
                        opacity: props.hitConfirmRatio
                    }}
                >
                    <div className="rounded-full border border-[#8f6a38]/60 bg-[rgba(8,8,8,0.84)] px-4 py-2 shadow-[0_0_18px_rgba(0,0,0,0.28)]">
                        <div className="text-center text-[10px] tracking-[0.34em] text-[#fff0c9]">{props.t('mobile.hit')}</div>
                        <div className="mt-2 h-1.5 w-28 rounded-full bg-[#2b231d]">
                            <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,#f25c54,#efb768,#7ee6f0)]"
                                style={{ width: `${props.hitTargetRatio * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            ) : null}

            {props.showAlignPrompt ? (
                <div className="pointer-events-none absolute left-1/2 top-[58%] z-30 -translate-x-1/2 rounded-full border border-[#8f6a38]/60 bg-black/55 px-4 py-2 text-[11px] tracking-[0.36em] text-[#efb768]">
                    {props.alignPromptLabel}
                </div>
            ) : null}
        </>
    );
}
