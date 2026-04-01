import { formatSeconds } from '../../i18n/format';
import { type Locale } from '../../i18n/types';
import type { WeaponStatusView } from '../../combat/weaponTypes';
import { type SectionName, type SectionState } from '../../core/gameHudState';
import type { TranslationKey, Translator } from '../../i18n';

const sectionLabelKeys: Record<SectionName, TranslationKey> = {
    head: 'hud.section.head',
    centerTorso: 'hud.section.centerTorso',
    leftTorso: 'hud.section.leftTorso',
    rightTorso: 'hud.section.rightTorso',
    leftArm: 'hud.section.leftArm',
    rightArm: 'hud.section.rightArm',
    leftLeg: 'hud.section.leftLeg',
    rightLeg: 'hud.section.rightLeg'
};

export function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export function angleDiff(from: number, to: number) {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
}

export function toDegrees(radians: number) {
    return radians * (180 / Math.PI);
}

export function wrapDegrees(degrees: number) {
    let wrapped = degrees % 360;
    if (wrapped < 0) wrapped += 360;
    return wrapped;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + radius * Math.cos(angleRad),
        y: cy + radius * Math.sin(angleRad)
    };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function HeadingTape(props: { legYaw: number; torsoYaw: number; maxTwist: number; t: Translator }) {
    const { legYaw, torsoYaw, maxTwist } = props;
    const bodyOffsetPx = clamp(angleDiff(torsoYaw, legYaw) / (maxTwist * 1.1), -1, 1) * 184;
    const centerHeading = wrapDegrees(Math.round(toDegrees(torsoYaw)));
    const chassisHeading = wrapDegrees(Math.round(toDegrees(legYaw)));
    const ticks = Array.from({ length: 17 }, (_, index) => index - 8);

    return (
        <div className="relative h-24 overflow-hidden rounded-[28px] border border-[#9d7740]/70 bg-[linear-gradient(180deg,rgba(21,18,13,0.96),rgba(8,8,7,0.96))] shadow-[inset_0_0_20px_rgba(0,0,0,0.55),0_0_20px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-x-5 top-4 h-px bg-[#7f653e]/60" />
            <div className="absolute inset-x-5 top-[36px] h-[1px] bg-[#2e9bb4]/20" />
            {ticks.map((tick) => {
                const left = `calc(50% + ${tick * 44}px)`;
                const label = wrapDegrees(centerHeading + tick * 15);
                const major = tick % 2 === 0;
                return (
                    <div key={tick} className="absolute top-2 bottom-2" style={{ left }}>
                        <div className={`absolute top-4 -translate-x-1/2 rounded-full ${major ? 'h-6 w-[2px] bg-[#d0b07a]' : 'h-3 w-px bg-[#78603b]'}`} />
                        {major ? (
                            <div className="absolute top-11 -translate-x-1/2 text-[10px] tracking-[0.28em] text-[#c5b187]/90">
                                {label.toString().padStart(3, '0')}
                            </div>
                        ) : null}
                    </div>
                );
            })}

            <div className="absolute left-1/2 top-[7px] -translate-x-1/2 text-[10px] font-bold tracking-[0.42em] text-[#7ee6f0]">
                {props.t('hud.heading.gaze')}
            </div>
            <div className="absolute left-1/2 top-1 -translate-x-1/2">
                <div className="h-0 w-0 border-x-[8px] border-x-transparent border-t-[14px] border-t-[#7ee6f0] drop-shadow-[0_0_8px_rgba(126,230,240,0.55)]" />
            </div>

            <div className="absolute top-[7px] text-[10px] font-bold tracking-[0.36em] text-[#efb768]" style={{ left: `calc(50% + ${bodyOffsetPx}px)`, transform: 'translateX(-50%)' }}>
                {props.t('hud.heading.chassis')}
            </div>
            <div className="absolute top-2" style={{ left: `calc(50% + ${bodyOffsetPx}px)`, transform: 'translateX(-50%)' }}>
                <div className="h-0 w-0 border-x-[8px] border-x-transparent border-t-[14px] border-t-[#efb768] drop-shadow-[0_0_10px_rgba(239,183,104,0.55)]" />
            </div>

            <div className="absolute left-5 bottom-2 text-[11px] tracking-[0.22em] text-[#9cb5bb]">{props.t('hud.heading.torso')} {centerHeading.toString().padStart(3, '0')}</div>
            <div className="absolute right-5 bottom-2 text-[11px] tracking-[0.22em] text-[#d0b07a]">{props.t('hud.body')} {chassisHeading.toString().padStart(3, '0')}</div>
        </div>
    );
}

export function TorsoTwistArc(props: { twistRatio: number; maxTwist: number; t: Translator }) {
    const { twistRatio, maxTwist } = props;
    const clampedRatio = clamp(twistRatio, -1, 1);
    const pipAngle = 270 + clampedRatio * 60;
    const trackPath = describeArc(110, 110, 84, 210, 330);
    const leftLimit = polarToCartesian(110, 110, 84, 210);
    const rightLimit = polarToCartesian(110, 110, 84, 330);
    const pip = polarToCartesian(110, 110, 84, pipAngle);
    const segmentPath = clampedRatio >= 0
        ? describeArc(110, 110, 84, 270, pipAngle)
        : describeArc(110, 110, 84, pipAngle, 270);

    return (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2">
            <svg viewBox="0 0 220 220" className="h-full w-full overflow-visible">
                <path d={trackPath} fill="none" stroke="rgba(123,104,72,0.75)" strokeWidth="6" strokeLinecap="round" />
                <path d={segmentPath} fill="none" stroke={Math.abs(clampedRatio) > 0.78 ? '#ff9f43' : '#7ee6f0'} strokeWidth="5" strokeLinecap="round" />
                <circle cx={pip.x} cy={pip.y} r="6.5" fill={Math.abs(clampedRatio) > 0.78 ? '#ff9f43' : '#7ee6f0'} />
                <circle cx="110" cy="110" r="3.5" fill="#d0b07a" />
                <circle cx={leftLimit.x} cy={leftLimit.y} r="4" fill="#9d7740" />
                <circle cx={rightLimit.x} cy={rightLimit.y} r="4" fill="#9d7740" />
            </svg>
            <div className="absolute inset-x-0 bottom-[18px] text-center text-[10px] tracking-[0.46em] text-[#a0bcc3]">
                {props.t('hud.torsoLimitDegrees', { degrees: Math.round(toDegrees(maxTwist)) })}
            </div>
        </div>
    );
}

export function CockpitFrame(props: {
    warning: string;
    throttleLabel: string;
    kickX: number;
    kickY: number;
    kickRoll: number;
    frameKick: number;
    flash: number;
}) {
    const frameTransform = `translate3d(${props.kickX * 0.55}px, ${props.kickY * 0.48 - props.frameKick * 3.6}px, 0) rotate(${props.kickRoll * 0.65}deg)`;

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" style={{ transform: frameTransform }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.08)_48%,rgba(0,0,0,0.32)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0)_18%,rgba(0,0,0,0)_68%,rgba(255,164,63,0.05)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(255,255,255,0.045),rgba(255,255,255,0)_22%,rgba(255,255,255,0)_76%,rgba(255,255,255,0.03))]" />
            <div
                className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,208,148,0.32),rgba(255,208,148,0.06)_32%,rgba(255,208,148,0)_70%)]"
                style={{ opacity: clamp(props.flash, 0, 1) }}
            />

            <div className="absolute inset-x-0 top-0 h-20 border-b border-[#7f653e]/70 bg-[linear-gradient(180deg,rgba(80,55,30,0.95),rgba(28,20,14,0.92),rgba(0,0,0,0))] shadow-[0_8px_18px_rgba(0,0,0,0.35)]" />
            <div className="absolute left-0 top-0 bottom-0 w-28 border-r border-[#7f653e]/60 bg-[linear-gradient(90deg,rgba(54,39,24,0.96),rgba(22,17,13,0.78),rgba(0,0,0,0))]" />
            <div className="absolute right-0 top-0 bottom-0 w-28 border-l border-[#7f653e]/60 bg-[linear-gradient(270deg,rgba(54,39,24,0.96),rgba(22,17,13,0.78),rgba(0,0,0,0))]" />

            <div className="absolute left-[72px] top-12 bottom-[170px] w-5 rounded-full border border-[#9d7740]/70 bg-[linear-gradient(180deg,#5b4125,#241911)] shadow-[0_0_20px_rgba(0,0,0,0.45)]" />
            <div className="absolute right-[72px] top-12 bottom-[170px] w-5 rounded-full border border-[#9d7740]/70 bg-[linear-gradient(180deg,#5b4125,#241911)] shadow-[0_0_20px_rgba(0,0,0,0.45)]" />
            <div className="absolute left-[58px] top-[86px] h-3 w-14 rotate-[-18deg] rounded-full border border-[#b18c53]/60 bg-[#3d2b18]" />
            <div className="absolute right-[58px] top-[86px] h-3 w-14 rotate-[18deg] rounded-full border border-[#b18c53]/60 bg-[#3d2b18]" />

            <div className="absolute bottom-0 left-1/2 h-[248px] w-[min(1040px,96vw)] -translate-x-1/2 rounded-t-[44px] border border-[#8b6636]/80 bg-[linear-gradient(180deg,rgba(69,50,31,0.98),rgba(19,15,12,0.98))] shadow-[0_-14px_32px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,220,168,0.08)]" />
            <div className="absolute bottom-[202px] left-1/2 h-7 w-[min(920px,84vw)] -translate-x-1/2 rounded-full border border-[#a67d47]/50 bg-[linear-gradient(180deg,rgba(94,67,37,0.92),rgba(31,24,18,0.72))]" />
            <div className="absolute left-1/2 top-[52px] flex -translate-x-1/2 gap-3">
                {['#efb768', '#7ee6f0', '#efb768', '#f36f58', '#efb768'].map((color, index) => (
                    <div
                        key={`${color}-${index}`}
                        className="h-2.5 w-8 rounded-full border border-black/30 shadow-[0_0_12px_rgba(0,0,0,0.35)]"
                        style={{ backgroundColor: color, opacity: index === 3 ? 0.92 : 0.72 }}
                    />
                ))}
            </div>
            <div className="absolute bottom-[226px] left-1/2 flex w-[min(860px,78vw)] -translate-x-1/2 justify-between px-8">
                {Array.from({ length: 9 }, (_, index) => (
                    <div key={index} className="h-3 w-3 rounded-full border border-[#2c2014] bg-[linear-gradient(180deg,#c89a58,#5f4425)] shadow-[inset_0_1px_1px_rgba(255,236,196,0.3)]" />
                ))}
            </div>

            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-[#8f6a38]/70 bg-[rgba(12,10,8,0.82)] px-6 py-2 text-[11px] tracking-[0.42em] text-[#f1bd6e] shadow-[0_0_18px_rgba(0,0,0,0.4)]">
                {props.warning}
            </div>
            <div className="absolute left-1/2 bottom-[214px] -translate-x-1/2 rounded-full border border-[#5f4d2e]/70 bg-[rgba(7,7,7,0.82)] px-5 py-2 text-[10px] tracking-[0.4em] text-[#a7c1c8]">
                {props.throttleLabel}
            </div>
        </div>
    );
}

export function SectionArmorDisplay(props: { sections: SectionState; maxSections: SectionState; t: Translator }) {
    const { sections, maxSections } = props;

    const ratioOf = (section: SectionName) => clamp(sections[section] / Math.max(maxSections[section], 1), 0, 1);
    const colorOf = (section: SectionName) => {
        const ratio = ratioOf(section);
        if (ratio <= 0) return '#291d16';
        if (ratio < 0.35) return '#f25c54';
        if (ratio < 0.7) return '#efb768';
        return '#7ee6f0';
    };

    const sectionBox = (section: SectionName, className: string) => (
        <div
            className={`absolute rounded-[12px] border border-[#5b4427]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${className}`}
            style={{ backgroundColor: colorOf(section), opacity: 0.2 + ratioOf(section) * 0.8 }}
            title={props.t(sectionLabelKeys[section])}
        />
    );

    return (
        <div className="rounded-[24px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
            <div className="text-center text-[9px] tracking-[0.28em] text-[#efb768]">{props.t('hud.sections')}</div>
            <div className="relative mx-auto mt-3 h-[130px] w-[120px]">
                {sectionBox('head', 'left-1/2 top-0 h-4 w-4 -translate-x-1/2')}
                {sectionBox('centerTorso', 'left-1/2 top-5 h-9 w-7 -translate-x-1/2')}
                {sectionBox('leftTorso', 'left-[25px] top-7 h-7 w-5')}
                {sectionBox('rightTorso', 'right-[25px] top-7 h-7 w-5')}
                {sectionBox('leftArm', 'left-0 top-7 h-8 w-5')}
                {sectionBox('rightArm', 'right-0 top-7 h-8 w-5')}
                {sectionBox('leftLeg', 'left-[42px] bottom-0 h-12 w-4')}
                {sectionBox('rightLeg', 'right-[42px] bottom-0 h-12 w-4')}
            </div>
        </div>
    );
}

export function WeaponRack(props: { weapons: WeaponStatusView[]; locale: Locale; t: Translator }) {
    if (props.weapons.length === 0) return null;

    return (
        <div className="w-full rounded-[24px] border border-[#8f6a38]/60 bg-black/28 p-3 shadow-[inset_0_0_16px_rgba(0,0,0,0.38)]">
            <div className="mb-2 text-center text-[10px] tracking-[0.32em] text-[#a1bdc4]">{props.t('hud.weapons')}</div>
            <div className="grid grid-cols-3 gap-2">
                {props.weapons.map((weapon) => {
                    const stateTone = weapon.state === 'ready'
                        ? 'text-[#7ee6f0] border-[#2e829a]/55'
                        : weapon.state === 'recycle'
                            ? 'text-[#efb768] border-[#8f6a38]/55'
                            : weapon.state === 'offline'
                                ? 'text-[#8d7760] border-[#5a4630]/40'
                                : 'text-[#f25c54] border-[#9a433c]/50';
                    const baseStateLabel = weapon.state === 'ready'
                        ? props.t('weapon.state.ready')
                        : weapon.state === 'recycle'
                            ? props.t('weapon.state.recycle')
                            : weapon.state === 'offline'
                                ? props.t('weapon.state.offline')
                                : props.t('weapon.state.heat');
                    const stateLabel = weapon.state === 'recycle'
                        ? `${baseStateLabel} ${formatSeconds(props.locale, weapon.cooldownRemaining)}`
                        : baseStateLabel;

                    return (
                        <div key={weapon.mountId} className={`rounded-2xl border bg-[rgba(10,10,10,0.76)] px-3 py-2 ${stateTone}`}>
                            <div className="flex items-center justify-between text-[9px] tracking-[0.22em]">
                                <span>{props.t('weapon.group', { group: weapon.group })}</span>
                                <span className="text-[#c6b08a]">{weapon.heatCost}</span>
                            </div>
                            <div className="mt-1 text-sm font-bold tracking-[0.18em] text-[#f3deb5]">{props.t(weapon.shortKey)}</div>
                            <div className="mt-1 text-[9px] tracking-[0.18em]">{stateLabel}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
