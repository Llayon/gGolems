type LobbySelectionSummaryProps = {
    modeLabel: string;
    chassisLabel: string;
    loadoutLabel: string;
    roomCountLabel?: string;
};

function SummaryChip(props: { label: string; value: string }) {
    return (
        <div className="rounded-full border border-[#8f6a38]/35 bg-black/32 px-3 py-2 text-center">
            <div className="text-[9px] tracking-[0.22em] text-[#8fb8c2]">{props.label}</div>
            <div className="mt-1 text-[11px] font-bold tracking-[0.12em] text-[#f3deb5]">{props.value}</div>
        </div>
    );
}

export function LobbySelectionSummary(props: LobbySelectionSummaryProps) {
    return (
        <div className="mb-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <SummaryChip label="MODE" value={props.modeLabel} />
            <SummaryChip label="FRAME" value={props.chassisLabel} />
            <SummaryChip label="LOADOUT" value={props.loadoutLabel} />
            {props.roomCountLabel ? <SummaryChip label="ROOMS" value={props.roomCountLabel} /> : null}
        </div>
    );
}
