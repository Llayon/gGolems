import { useState, type ReactNode } from 'react';

type PortraitStep = 'mode' | 'mech' | 'session';

type MobilePortraitLobbyLayoutProps = {
    modeSection: ReactNode;
    chassisSection: ReactNode;
    loadoutSection: ReactNode;
    sessionSection: ReactNode;
    roomSection: ReactNode;
    pilotSection: ReactNode;
    modeTitle: string;
    frameTitle: string;
    sessionTitle: string;
    roomTitle: string;
    pilotTitle: string;
};

function SecondaryPanel(props: { title: string; children: ReactNode }) {
    return (
        <details className="rounded-2xl border border-[#8f6a38]/30 bg-black/28 px-4 py-3 backdrop-blur-sm">
            <summary className="cursor-pointer list-none text-center text-xs tracking-[0.28em] text-[#8fb8c2]">
                {props.title}
            </summary>
            <div className="mt-3">{props.children}</div>
        </details>
    );
}

export function MobilePortraitLobbyLayout(props: MobilePortraitLobbyLayoutProps) {
    const [step, setStep] = useState<PortraitStep>('mode');
    const canGoBack = step !== 'mode';
    const canGoForward = step !== 'session';
    const currentTitle = step === 'mode'
        ? props.modeTitle
        : step === 'mech'
            ? props.frameTitle
            : props.sessionTitle;

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#8f6a38]/30 bg-black/28 p-2 backdrop-blur-sm">
                <button
                    type="button"
                    onClick={() => setStep('mode')}
                    className={`rounded-xl px-2 py-3 text-[10px] font-bold tracking-[0.16em] transition-colors ${step === 'mode' ? 'border border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'text-[#d3bc94]'}`}
                >
                    {props.modeTitle}
                </button>
                <button
                    type="button"
                    onClick={() => setStep('mech')}
                    className={`rounded-xl px-2 py-3 text-[10px] font-bold tracking-[0.16em] transition-colors ${step === 'mech' ? 'border border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'text-[#d3bc94]'}`}
                >
                    {props.frameTitle}
                </button>
                <button
                    type="button"
                    onClick={() => setStep('session')}
                    className={`rounded-xl px-2 py-3 text-[10px] font-bold tracking-[0.16em] transition-colors ${step === 'session' ? 'border border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'text-[#d3bc94]'}`}
                >
                    {props.sessionTitle}
                </button>
            </div>

            <div className="rounded-2xl border border-[#8f6a38]/30 bg-black/24 px-4 py-3 text-center backdrop-blur-sm">
                <div className="text-[10px] tracking-[0.22em] text-[#8fb8c2]">CURRENT STEP</div>
                <div className="mt-1 text-[13px] font-bold tracking-[0.16em] text-[#f3deb5]">{currentTitle}</div>
            </div>

            {step === 'mode' ? props.modeSection : null}
            {step === 'mech' ? (
                <div className="flex flex-col gap-4">
                    {props.chassisSection}
                    {props.loadoutSection}
                </div>
            ) : null}
            {step === 'session' ? props.sessionSection : null}

            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    disabled={!canGoBack}
                    onClick={() => setStep((current) => current === 'session' ? 'mech' : 'mode')}
                    className="rounded-xl border border-[#8f6a38]/30 bg-black/25 px-4 py-3 text-[10px] font-bold tracking-[0.18em] text-[#d3bc94] transition-colors hover:border-[#efb768]/50 hover:text-[#fff1d4] disabled:cursor-not-allowed disabled:opacity-45"
                >
                    ← BACK
                </button>
                <button
                    type="button"
                    disabled={!canGoForward}
                    onClick={() => setStep((current) => current === 'mode' ? 'mech' : 'session')}
                    className="rounded-xl border border-[#efb768]/60 bg-[#7d4f22]/40 px-4 py-3 text-[10px] font-bold tracking-[0.18em] text-[#fff1d4] transition-colors hover:bg-[#8f5a28] disabled:cursor-not-allowed disabled:opacity-45"
                >
                    NEXT →
                </button>
            </div>

            <SecondaryPanel title={props.roomTitle}>{props.roomSection}</SecondaryPanel>
            <SecondaryPanel title={props.pilotTitle}>{props.pilotSection}</SecondaryPanel>
        </div>
    );
}
