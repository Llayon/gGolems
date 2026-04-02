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

            {step === 'mode' ? props.modeSection : null}
            {step === 'mech' ? (
                <div className="flex flex-col gap-4">
                    {props.chassisSection}
                    {props.loadoutSection}
                </div>
            ) : null}
            {step === 'session' ? props.sessionSection : null}

            <SecondaryPanel title={props.roomTitle}>{props.roomSection}</SecondaryPanel>
            <SecondaryPanel title={props.pilotTitle}>{props.pilotSection}</SecondaryPanel>
        </div>
    );
}
