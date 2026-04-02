import { LobbySectionCard } from './LobbySectionCard';
import type { LobbyScreenProps } from './lobbyTypes';

type LobbyModeSectionProps = Pick<LobbyScreenProps, 't' | 'selectedGameMode' | 'onSelectGameMode'>;

export function LobbyModeSection(props: LobbyModeSectionProps) {
    return (
        <LobbySectionCard title={props.t('lobby.modeTitle')}>
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => props.onSelectGameMode('control')}
                    className={`rounded-xl border px-4 py-3 text-[11px] font-bold tracking-[0.18em] transition-colors ${props.selectedGameMode === 'control' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                >
                    {props.t('lobby.mode.control')}
                </button>
                <button
                    type="button"
                    onClick={() => props.onSelectGameMode('tdm')}
                    className={`rounded-xl border px-4 py-3 text-[11px] font-bold tracking-[0.18em] transition-colors ${props.selectedGameMode === 'tdm' ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                >
                    {props.t('lobby.mode.tdm')}
                </button>
            </div>
            <div className="mt-3 text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                {props.t(props.selectedGameMode === 'control' ? 'lobby.modeHint.control' : 'lobby.modeHint.tdm')}
            </div>
        </LobbySectionCard>
    );
}
