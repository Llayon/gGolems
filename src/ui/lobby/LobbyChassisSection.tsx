import type { TranslationKey } from '../../i18n';
import { LobbySectionCard } from './LobbySectionCard';
import type { LobbyScreenProps } from './lobbyTypes';

type LobbyChassisSectionProps = Pick<
    LobbyScreenProps,
    't' | 'availableChassis' | 'selectedChassisId' | 'selectedChassis' | 'onSelectChassis'
>;

export function LobbyChassisSection(props: LobbyChassisSectionProps) {
    return (
        <LobbySectionCard title={props.t('lobby.frameTitle')}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {props.availableChassis.map((chassis) => (
                    <button
                        key={chassis.id}
                        type="button"
                        onClick={() => props.onSelectChassis(chassis.id)}
                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                            props.selectedChassisId === chassis.id
                                ? 'border-[#efb768]/80 bg-[#7d4f22]/40 text-[#fff1d4]'
                                : 'border-[#8f6a38]/30 bg-black/25 text-[#d3bc94] hover:border-[#efb768]/50'
                        }`}
                    >
                        <div className="text-[11px] font-bold tracking-[0.18em]">{chassis.name}</div>
                        <div className="mt-1 text-[9px] tracking-[0.18em] text-[#8fb8c2]">
                            {props.t(`lobby.weight.${chassis.weightClass}` as TranslationKey)} / {chassis.familyId.toUpperCase()}
                        </div>
                        <div className="mt-2 text-[10px] leading-4 tracking-[0.08em] text-[#cdbb97]">
                            {chassis.description}
                        </div>
                    </button>
                ))}
            </div>
            <div className="mt-3 rounded-xl border border-[#8f6a38]/25 bg-black/25 px-4 py-3 text-[11px] tracking-[0.12em] text-[#cdbb97]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{props.selectedChassis.name}</span>
                    <span className="text-[#8fb8c2]">
                        {props.t('lobby.chassisStats', {
                            speed: props.selectedChassis.topSpeed.toFixed(1),
                            steam: props.selectedChassis.maxSteam,
                            mass: props.selectedChassis.mass.toFixed(1)
                        })}
                    </span>
                </div>
            </div>
        </LobbySectionCard>
    );
}
