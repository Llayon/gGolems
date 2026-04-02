import { LobbySectionCard } from './LobbySectionCard';
import type { LobbyScreenProps } from './lobbyTypes';

type LobbyLoadoutSectionProps = Pick<
    LobbyScreenProps,
    't' | 'availableLoadouts' | 'selectedLoadoutId' | 'selectedLoadout' | 'onSelectLoadout'
>;

export function LobbyLoadoutSection(props: LobbyLoadoutSectionProps) {
    return (
        <LobbySectionCard title={props.t('lobby.loadoutTitle')}>
            <div className="grid grid-cols-1 gap-2">
                {props.availableLoadouts.map((loadout) => (
                    <button
                        key={loadout.id}
                        type="button"
                        onClick={() => props.onSelectLoadout(loadout.id)}
                        className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                            props.selectedLoadoutId === loadout.id
                                ? 'border-[#efb768]/80 bg-[#7d4f22]/40 text-[#fff1d4]'
                                : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] font-bold tracking-[0.18em]">{loadout.name}</div>
                            <div className="text-[9px] tracking-[0.18em] text-[#8fb8c2]">
                                {loadout.assignments.map((assignment) => assignment.weaponId.replace('_', ' ')).join(' / ')}
                            </div>
                        </div>
                        <div className="mt-2 text-[10px] leading-4 tracking-[0.08em] text-[#cdbb97]">
                            {loadout.description}
                        </div>
                    </button>
                ))}
            </div>
            <div className="mt-3 text-center text-[11px] tracking-[0.12em] text-[#b9c7c8]">
                {props.t('lobby.loadoutHint', { loadout: props.selectedLoadout.name })}
            </div>
        </LobbySectionCard>
    );
}
