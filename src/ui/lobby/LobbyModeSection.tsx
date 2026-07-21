import { LobbySectionCard } from './LobbySectionCard';
import type { TranslationKey } from '../../i18n/types';
import type { GameMode } from '../../gameplay/types';
import type { LobbyScreenProps } from './lobbyTypes';

type LobbyModeSectionProps = Pick<LobbyScreenProps, 't' | 'selectedGameMode' | 'onSelectGameMode'>;

const MODES: GameMode[] = ['control', 'tdm', '1v1'];

const MODE_KEYS: Record<GameMode, TranslationKey> = {
    control: 'lobby.mode.control',
    tdm: 'lobby.mode.tdm',
    '1v1': 'lobby.mode.1v1'
};

const MODE_HINT_KEYS: Record<GameMode, TranslationKey> = {
    control: 'lobby.modeHint.control',
    tdm: 'lobby.modeHint.tdm',
    '1v1': 'lobby.modeHint.1v1'
};

export function LobbyModeSection(props: LobbyModeSectionProps) {
    return (
        <LobbySectionCard title={props.t('lobby.modeTitle')}>
            <div className="grid grid-cols-3 gap-2">
                {MODES.map((mode) => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => props.onSelectGameMode(mode)}
                        className={`rounded-xl border px-3 py-3 text-[11px] font-bold tracking-[0.18em] transition-colors ${props.selectedGameMode === mode ? 'border-[#efb768]/80 bg-[#7d4f22]/55 text-[#fff1d4]' : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'}`}
                    >
                        {props.t(MODE_KEYS[mode])}
                    </button>
                ))}
            </div>
            <div className="mt-3 text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                {props.t(MODE_HINT_KEYS[props.selectedGameMode])}
            </div>
        </LobbySectionCard>
    );
}
