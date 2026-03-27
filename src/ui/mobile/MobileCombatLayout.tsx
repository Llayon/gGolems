import { angleDiff, clamp, polarToCartesian, toDegrees, wrapDegrees } from './helpers';
import { MobileControls } from './MobileControls';
import type { RadarContact } from './types';

type MobileCombatLayoutProps = {
    warning: string;
    throttleText: string;
    legYaw: number;
    torsoYaw: number;
    twistRatio: number;
    hpRatio: number;
    steamRatio: number;
    speed: number;
    maxSpeed: number;
    radarContacts: RadarContact[];
    isPortrait: boolean;
    leftHanded: boolean;
    aimSensitivity: number;
    game: any;
    onOpenSettings: () => void;
};

type StatusClusterProps = Pick<
    MobileCombatLayoutProps,
    'throttleText' | 'legYaw' | 'torsoYaw' | 'twistRatio' | 'hpRatio' | 'steamRatio' | 'speed' | 'maxSpeed' | 'radarContacts'
> & {
    variant: 'portrait' | 'landscape';
};

function StatusCluster(props: StatusClusterProps) {
    const chassisHeading = wrapDegrees(Math.round(toDegrees(props.legYaw))).toString().padStart(3, '0');
    const torsoHeading = wrapDegrees(Math.round(toDegrees(props.torsoYaw))).toString().padStart(3, '0');
    const twistDegrees = Math.round(toDegrees(angleDiff(props.legYaw, props.torsoYaw)));
    const twistText = `${twistDegrees > 0 ? '+' : ''}${twistDegrees}`;
    const speedDisplay = Math.round((props.speed / Math.max(props.maxSpeed, 0.1)) * 86);
    const torsoMarker = polarToCartesian(42, 42, 22, 270 + clamp(props.twistRatio, -1, 1) * 72);
    const leftLimit = polarToCartesian(42, 42, 22, 198);
    const rightLimit = polarToCartesian(42, 42, 22, 342);
    const nearestContact = props.radarContacts[0] ?? null;
    const nearestLabel = nearestContact ? (nearestContact.kind === 'bot' ? 'БОТ' : 'ВРАГ') : 'ЧИСТО';
    const nearestColor = nearestContact?.kind === 'bot' ? '#f25c54' : '#efb768';
    const nearestX = nearestContact ? 42 + nearestContact.x * 24 : 42;
    const nearestY = nearestContact ? 42 - nearestContact.y * 24 : 42;
    const nearestText = nearestContact ? `${nearestLabel} ${nearestContact.meters}М` : 'НЕТ';

    const radar = (
        <div className="relative h-[84px] w-[84px] shrink-0 rounded-full border border-[#8f6a38]/55 bg-[radial-gradient(circle_at_center,rgba(20,18,16,0.95),rgba(7,7,7,0.88))]">
            <svg viewBox="0 0 84 84" className="h-full w-full">
                <circle cx="42" cy="42" r="22" fill="none" stroke="rgba(157,119,64,0.45)" strokeWidth="2.5" />
                <circle cx={leftLimit.x} cy={leftLimit.y} r="2.8" fill="#9d7740" />
                <circle cx={rightLimit.x} cy={rightLimit.y} r="2.8" fill="#9d7740" />
                {nearestContact ? (
                    <>
                        <circle cx={nearestX} cy={nearestY} r="7.2" fill="none" stroke={nearestColor} strokeWidth="1.6" opacity="0.75" />
                        <line x1="42" y1="42" x2={nearestX} y2={nearestY} stroke={nearestColor} strokeWidth="1.2" opacity="0.45" />
                    </>
                ) : null}
                {props.radarContacts.map((contact, index) => (
                    <circle
                        key={`${contact.kind}-${index}`}
                        cx={42 + contact.x * 24}
                        cy={42 - contact.y * 24}
                        r={contact.kind === 'bot' ? 3.4 : 3}
                        fill={contact.kind === 'bot' ? '#f25c54' : '#efb768'}
                        opacity={1 - contact.distance * 0.35}
                    />
                ))}
                <circle cx={torsoMarker.x} cy={torsoMarker.y} r="4" fill="#7ee6f0" />
                <circle cx="42" cy="42" r="3" fill="#efb768" />
            </svg>
            <div className="absolute left-1/2 top-[11px] h-0 w-0 -translate-x-1/2 border-x-[5px] border-x-transparent border-b-[10px] border-b-[#efb768]" />
            <div className="absolute inset-x-0 bottom-[8px] text-center text-[8px] tracking-[0.26em] text-[#9fc4cc]">КУРС</div>
        </div>
    );

    if (props.variant === 'landscape') {
        return (
            <div className="mx-auto flex w-[min(92vw,780px)] items-center gap-3 rounded-[28px] border border-[#8f6a38]/55 bg-[linear-gradient(180deg,rgba(18,17,15,0.92),rgba(8,8,8,0.9))] px-3 py-3 shadow-[0_0_22px_rgba(0,0,0,0.34),inset_0_0_18px_rgba(0,0,0,0.45)]">
                {radar}

                <div className="grid min-w-[180px] flex-1 grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-2 py-2">
                        <div className="text-[8px] tracking-[0.22em] text-[#8fb8c2]">ШАССИ</div>
                        <div className="mt-1 text-sm font-bold tracking-[0.14em] text-[#efb768]">{chassisHeading}</div>
                    </div>
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-2 py-2">
                        <div className="text-[8px] tracking-[0.22em] text-[#8fb8c2]">ТОРС</div>
                        <div className="mt-1 text-sm font-bold tracking-[0.14em] text-[#7ee6f0]">{torsoHeading}</div>
                    </div>
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-2 py-2">
                        <div className="text-[8px] tracking-[0.22em] text-[#8fb8c2]">СДВИГ</div>
                        <div className="mt-1 text-sm font-bold tracking-[0.14em]" style={{ color: Math.abs(props.twistRatio) > 0.78 ? '#ffb28c' : '#f3deb5' }}>
                            {twistText}
                        </div>
                    </div>
                </div>

                <div className="min-w-[170px] rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-3 py-2">
                    <div className="text-[8px] tracking-[0.26em] text-[#8fb8c2]">КОНТАКТ</div>
                    <div className="mt-2 text-[10px] font-bold tracking-[0.18em]" style={{ color: nearestContact ? nearestColor : '#9fc4cc' }}>
                        {nearestText}
                    </div>
                    <div className="mt-2 text-[9px] tracking-[0.22em] text-[#d7c5a1]">{props.throttleText}</div>
                </div>

                <div className="min-w-[180px] rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-3 py-2">
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <div>
                            <div className="mb-1 text-[8px] tracking-[0.22em] text-[#d0b07a]">БРОНЯ</div>
                            <div className="h-2 rounded-full bg-[#241c16]">
                                <div className="h-full rounded-full bg-[linear-gradient(90deg,#d04838,#f0b371)]" style={{ width: `${props.hpRatio * 100}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="mb-1 text-[8px] tracking-[0.22em] text-[#d0b07a]">ПАР</div>
                            <div className="h-2 rounded-full bg-[#241c16]">
                                <div className="h-full rounded-full bg-[linear-gradient(90deg,#efb768,#7ee6f0)]" style={{ width: `${props.steamRatio * 100}%` }} />
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-[8px] tracking-[0.22em] text-[#8fb8c2]">ХОД</div>
                            <div className="mt-1 text-lg font-bold tracking-[0.14em] text-[#f3deb5]">{speedDisplay}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-[min(92vw,360px)] items-center gap-3 rounded-[28px] border border-[#8f6a38]/55 bg-[linear-gradient(180deg,rgba(18,17,15,0.92),rgba(8,8,8,0.9))] px-3 py-3 shadow-[0_0_22px_rgba(0,0,0,0.34),inset_0_0_18px_rgba(0,0,0,0.45)]">
            {radar}

            <div className="min-w-0 flex-1">
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-2 py-2">
                        <div className="text-[8px] tracking-[0.22em] text-[#8fb8c2]">ШАССИ</div>
                        <div className="mt-1 text-sm font-bold tracking-[0.14em] text-[#efb768]">{chassisHeading}</div>
                    </div>
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-2 py-2">
                        <div className="text-[8px] tracking-[0.22em] text-[#8fb8c2]">ТОРС</div>
                        <div className="mt-1 text-sm font-bold tracking-[0.14em] text-[#7ee6f0]">{torsoHeading}</div>
                    </div>
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-2 py-2">
                        <div className="text-[8px] tracking-[0.22em] text-[#8fb8c2]">СДВИГ</div>
                        <div className="mt-1 text-sm font-bold tracking-[0.14em]" style={{ color: Math.abs(props.twistRatio) > 0.78 ? '#ffb28c' : '#f3deb5' }}>
                            {twistText}
                        </div>
                    </div>
                </div>

                <div className="mt-2 grid grid-cols-[1.1fr_1fr] gap-2">
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-3 py-2">
                        <div className="text-[8px] tracking-[0.26em] text-[#8fb8c2]">КОНТАКТ</div>
                        <div className="mt-1 text-[10px] font-bold tracking-[0.18em]" style={{ color: nearestContact ? nearestColor : '#9fc4cc' }}>
                            {nearestText}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-3 py-2">
                        <div className="text-[8px] tracking-[0.26em] text-[#8fb8c2]">ТЯГА</div>
                        <div className="mt-1 text-[10px] font-bold tracking-[0.18em] text-[#d7c5a1]">{props.throttleText}</div>
                    </div>
                </div>

                <div className="mt-2 grid grid-cols-[0.9fr_0.9fr_0.7fr] gap-2">
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-2 py-2">
                        <div className="mb-1 text-[8px] tracking-[0.22em] text-[#d0b07a]">БРОНЯ</div>
                        <div className="h-2 rounded-full bg-[#241c16]">
                            <div className="h-full rounded-full bg-[linear-gradient(90deg,#d04838,#f0b371)]" style={{ width: `${props.hpRatio * 100}%` }} />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-2 py-2">
                        <div className="mb-1 text-[8px] tracking-[0.22em] text-[#d0b07a]">ПАР</div>
                        <div className="h-2 rounded-full bg-[#241c16]">
                            <div className="h-full rounded-full bg-[linear-gradient(90deg,#efb768,#7ee6f0)]" style={{ width: `${props.steamRatio * 100}%` }} />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 px-2 py-2 text-center">
                        <div className="text-[8px] tracking-[0.22em] text-[#8fb8c2]">ХОД</div>
                        <div className="mt-1 text-sm font-bold tracking-[0.14em] text-[#f3deb5]">{speedDisplay}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PortraitCombatLayout(props: MobileCombatLayoutProps) {
    return (
        <>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
                <div className="mx-auto flex max-w-[min(96vw,420px)] items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 rounded-full border border-[#8f6a38]/55 bg-[rgba(10,10,10,0.8)] px-4 py-3 text-center text-[10px] tracking-[0.22em] text-[#efb768] shadow-[0_0_18px_rgba(0,0,0,0.3)]">
                        {props.warning}
                    </div>
                    <button
                        type="button"
                        className="pointer-events-auto shrink-0 rounded-full border border-[#8f6a38]/60 bg-[rgba(10,10,10,0.8)] px-4 py-3 text-[10px] tracking-[0.2em] text-[#d7c5a1]"
                        onClick={props.onOpenSettings}
                    >
                        МЕНЮ
                    </button>
                </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 z-20 px-3" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 160px)' }}>
                <StatusCluster
                    variant="portrait"
                    throttleText={props.throttleText}
                    legYaw={props.legYaw}
                    torsoYaw={props.torsoYaw}
                    twistRatio={props.twistRatio}
                    hpRatio={props.hpRatio}
                    steamRatio={props.steamRatio}
                    speed={props.speed}
                    maxSpeed={props.maxSpeed}
                    radarContacts={props.radarContacts}
                />
            </div>

            <MobileControls
                game={props.game}
                leftHanded={props.leftHanded}
                isPortrait
                aimSensitivity={props.aimSensitivity}
            />
        </>
    );
}

function LandscapeCombatLayout(props: MobileCombatLayoutProps) {
    return (
        <>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
                <div className="mx-auto flex max-w-[min(96vw,860px)] items-center justify-between gap-3">
                    <div className="min-w-0 rounded-full border border-[#8f6a38]/55 bg-[rgba(10,10,10,0.8)] px-4 py-3 text-[10px] tracking-[0.22em] text-[#efb768] shadow-[0_0_18px_rgba(0,0,0,0.3)]">
                        {props.warning}
                    </div>
                    <button
                        type="button"
                        className="pointer-events-auto shrink-0 rounded-full border border-[#8f6a38]/60 bg-[rgba(10,10,10,0.8)] px-4 py-3 text-[10px] tracking-[0.2em] text-[#d7c5a1]"
                        onClick={props.onOpenSettings}
                    >
                        МЕНЮ
                    </button>
                </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 z-20 px-3" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}>
                <StatusCluster
                    variant="landscape"
                    throttleText={props.throttleText}
                    legYaw={props.legYaw}
                    torsoYaw={props.torsoYaw}
                    twistRatio={props.twistRatio}
                    hpRatio={props.hpRatio}
                    steamRatio={props.steamRatio}
                    speed={props.speed}
                    maxSpeed={props.maxSpeed}
                    radarContacts={props.radarContacts}
                />
            </div>

            <MobileControls
                game={props.game}
                leftHanded={props.leftHanded}
                isPortrait={false}
                aimSensitivity={props.aimSensitivity}
            />
        </>
    );
}

export function MobileCombatLayout(props: MobileCombatLayoutProps) {
    if (props.isPortrait) {
        return <PortraitCombatLayout {...props} />;
    }
    return <LandscapeCombatLayout {...props} />;
}
