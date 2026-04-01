import type { DesktopPilotPanelViewModel } from './desktopHudTypes';

export function DesktopPilotPanel(props: {
    viewModel: DesktopPilotPanelViewModel;
    onCopyHostId: () => void;
    onTogglePilotPanel: () => void;
    onToggleLocale: () => void;
}) {
    return (
        <div className="absolute left-4 top-4 z-20">
            {props.viewModel.visible ? (
                <div className="pointer-events-auto max-w-[280px] rounded-2xl border border-[#8f6a38]/35 bg-[rgba(10,10,10,0.62)] p-4 text-sm text-[#d7c5a1] shadow-[0_0_20px_rgba(0,0,0,0.38)] backdrop-blur-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="text-lg font-bold tracking-[0.32em] text-[#efb768]">{props.viewModel.title}</h1>
                            <p className="mt-2 text-xs tracking-[0.22em] text-[#8fb8c2]">
                                {props.viewModel.summary}
                            </p>
                            <div className={`mt-2 text-[10px] tracking-[0.24em] ${props.viewModel.terrainDebugTone}`}>
                                {props.viewModel.terrainDebugLabel}
                            </div>
                            <button
                                type="button"
                                onClick={props.onToggleLocale}
                                className="mt-3 rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-1 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                            >
                                {props.viewModel.localeLabel}
                            </button>
                            {props.viewModel.showHostCopy ? (
                                <button
                                    type="button"
                                    onClick={props.onCopyHostId}
                                    className="mt-3 rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-1 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                                >
                                    {props.viewModel.copyLabel}
                                </button>
                            ) : null}
                        </div>

                        <button
                            type="button"
                            onClick={props.onTogglePilotPanel}
                            className="rounded-full border border-[#8f6a38]/55 bg-black/45 px-3 py-1 text-[10px] tracking-[0.24em] text-[#cdb488] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                        >
                            {props.viewModel.hideLabel}
                        </button>
                    </div>

                    <ul className="space-y-1 text-[11px] tracking-[0.18em] text-[#b9c7c8]">
                        {props.viewModel.controls.map((label, index) => (
                            <li key={`${index}-${label}`}>{label}</li>
                        ))}
                    </ul>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={props.onTogglePilotPanel}
                    className="pointer-events-auto rounded-full border border-[#8f6a38]/55 bg-[rgba(10,10,10,0.72)] px-4 py-2 text-[10px] tracking-[0.3em] text-[#cdb488] shadow-[0_0_18px_rgba(0,0,0,0.3)] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                >
                    {props.viewModel.showLabel}
                </button>
            )}
        </div>
    );
}
