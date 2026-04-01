import type { DesktopHostBadgeViewModel } from './desktopHudTypes';

export function DesktopHostBadge(props: {
    viewModel: DesktopHostBadgeViewModel;
    onCopy: () => void;
}) {
    return (
        <div className="pointer-events-auto absolute right-4 top-4 z-30 flex items-center gap-3 rounded-2xl border border-[#8f6a38]/45 bg-[rgba(10,10,10,0.78)] px-4 py-3 text-[#e1cea7] shadow-[0_0_22px_rgba(0,0,0,0.32)] backdrop-blur-sm">
            <div className="min-w-0">
                <div className="text-[10px] tracking-[0.34em] text-[#8fb8c2]">{props.viewModel.hostIdLabel}</div>
                <div className="mt-1 select-all font-bold tracking-[0.18em] text-[#efb768]">{props.viewModel.hostId}</div>
            </div>

            <button
                type="button"
                onClick={props.onCopy}
                className="shrink-0 rounded-full border border-[#8f6a38]/55 bg-black/40 px-4 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
            >
                {props.viewModel.copyLabel}
            </button>
        </div>
    );
}
