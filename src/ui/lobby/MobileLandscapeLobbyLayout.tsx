import type { ReactNode } from 'react';

type MobileLandscapeLobbyLayoutProps = {
    modeSection: ReactNode;
    chassisSection: ReactNode;
    loadoutSection: ReactNode;
    sessionSection: ReactNode;
    roomSection: ReactNode;
    pilotSection: ReactNode;
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

export function MobileLandscapeLobbyLayout(props: MobileLandscapeLobbyLayoutProps) {
    return (
        <div className="flex w-full flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="flex flex-col gap-4">
                    {props.modeSection}
                    {props.chassisSection}
                    {props.loadoutSection}
                </div>
                <div className="flex flex-col gap-4">
                    {props.sessionSection}
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <SecondaryPanel title={props.roomTitle}>{props.roomSection}</SecondaryPanel>
                <SecondaryPanel title={props.pilotTitle}>{props.pilotSection}</SecondaryPanel>
            </div>
        </div>
    );
}
