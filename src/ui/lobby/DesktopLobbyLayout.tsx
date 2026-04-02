import type { ReactNode } from 'react';

type DesktopLobbyLayoutProps = {
    modeSection: ReactNode;
    chassisSection: ReactNode;
    loadoutSection: ReactNode;
    sessionSection: ReactNode;
    roomSection: ReactNode;
    pilotSection: ReactNode;
};

export function DesktopLobbyLayout(props: DesktopLobbyLayoutProps) {
    return (
        <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.05fr)_minmax(0,0.9fr)]">
            <div className="flex flex-col gap-5">
                {props.modeSection}
                {props.sessionSection}
            </div>
            <div className="flex flex-col gap-5">
                {props.chassisSection}
                {props.loadoutSection}
            </div>
            <div className="flex flex-col gap-5 lg:col-span-2 xl:col-span-1">
                {props.roomSection}
                {props.pilotSection}
            </div>
        </div>
    );
}
