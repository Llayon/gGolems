import { angleDiff, clamp, polarToCartesian, toDegrees, wrapDegrees } from './helpers';
import { MobileControls } from './MobileControls';
import type { RadarContact } from './types';
import type { Translator } from '../../i18n';
import type { Locale } from '../../i18n/types';
import { formatDistance } from '../../i18n/format';

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
    locale: Locale;
    t: Translator;
    onOpenSettings: () => void;
};

type Variant = 'portrait' | 'landscape';

type HudMetrics = {
    chassisHeading: string;
    torsoHeading: string;
    twistText: string;
    speedDisplay: number;
    nearestContact: RadarContact | null;
    nearestColor: string;
    nearestText: string;
};

function buildHudMetrics(props: Pick<MobileCombatLayoutProps, 'legYaw' | 'torsoYaw' | 'twistRatio' | 'speed' | 'maxSpeed' | 'radarContacts' | 'locale' | 't'>): HudMetrics {
    const twistDegrees = Math.round(toDegrees(angleDiff(props.legYaw, props.torsoYaw)));
    const nearestContact = props.radarContacts[0] ?? null;
    const nearestText = nearestContact
        ? props.t(nearestContact.kind === 'bot' ? 'mobile.nearest.bot' : 'mobile.nearest.enemy', { distance: formatDistance(props.locale, nearestContact.meters) })
        : props.t('mobile.nearest.clear');

    return {
        chassisHeading: wrapDegrees(Math.round(toDegrees(props.legYaw))).toString().padStart(3, '0'),
        torsoHeading: wrapDegrees(Math.round(toDegrees(props.torsoYaw))).toString().padStart(3, '0'),
        twistText: `${twistDegrees > 0 ? '+' : ''}${twistDegrees}`,
        speedDisplay: Math.round((props.speed / Math.max(props.maxSpeed, 0.1)) * 68),
        nearestContact,
        nearestColor: nearestContact?.kind === 'bot' ? '#f25c54' : '#efb768',
        nearestText
    };
}

function ValueBadge(props: { label: string; value: string | number; tone?: 'chassis' | 'torso' | 'twist' | 'speed' }) {
    const toneClass = props.tone === 'torso'
        ? 'text-[#7ee6f0]'
        : props.tone === 'twist'
            ? 'text-[#f3deb5]'
            : props.tone === 'speed'
                ? 'text-[#f3deb5]'
                : 'text-[#efb768]';

    return (
        <div className="rounded-full border border-[#8f6a38]/35 bg-[rgba(9,9,9,0.78)] px-3 py-1.5 text-center shadow-[inset_0_0_10px_rgba(0,0,0,0.35)]">
            <div className="text-[6px] tracking-[0.24em] text-[#8fb8c2]">{props.label}</div>
            <div className={`mt-0.5 text-[11px] font-bold tracking-[0.12em] ${toneClass}`}>{props.value}</div>
        </div>
    );
}

function MeterBadge(props: { label: string; ratio: number; gradient: string }) {
    return (
        <div className="min-w-[70px] rounded-full border border-[#8f6a38]/35 bg-[rgba(9,9,9,0.78)] px-3 py-1.5 shadow-[inset_0_0_10px_rgba(0,0,0,0.35)]">
            <div className="text-[6px] tracking-[0.24em] text-[#d0b07a]">{props.label}</div>
            <div className="mt-1 h-1.5 rounded-full bg-[#241c16]">
                <div className={`h-full rounded-full ${props.gradient}`} style={{ width: `${clamp(props.ratio * 100, 0, 100)}%` }} />
            </div>
        </div>
    );
}

function RadarDial(props: { radarContacts: RadarContact[]; twistRatio: number; variant: Variant; t: Translator }) {
    const size = props.variant === 'portrait' ? 88 : 96;
    const center = 48;
    const radius = 28;
    const torsoMarker = polarToCartesian(center, center, radius, 270 + clamp(props.twistRatio, -1, 1) * 72);
    const leftLimit = polarToCartesian(center, center, radius, 198);
    const rightLimit = polarToCartesian(center, center, radius, 342);

    return (
        <div
            className="relative shrink-0 rounded-full border border-[#8f6a38]/60 bg-[radial-gradient(circle_at_center,rgba(20,18,16,0.95),rgba(7,7,7,0.9))] shadow-[0_0_22px_rgba(0,0,0,0.28),inset_0_0_14px_rgba(0,0,0,0.4)]"
            style={{ width: size, height: size }}
        >
            <svg viewBox="0 0 96 96" className="h-full w-full">
                <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(157,119,64,0.42)" strokeWidth="2.5" />
                <circle cx={center} cy={center} r={18} fill="none" stroke="rgba(157,119,64,0.22)" strokeWidth="1.2" />
                <circle cx={leftLimit.x} cy={leftLimit.y} r="2.8" fill="#9d7740" />
                <circle cx={rightLimit.x} cy={rightLimit.y} r="2.8" fill="#9d7740" />
                {props.radarContacts.map((contact, index) => (
                    <circle
                        key={`${contact.kind}-${index}`}
                        cx={center + contact.x * 30}
                        cy={center - contact.y * 30}
                        r={contact.kind === 'bot' ? 3.7 : 3.2}
                        fill={contact.kind === 'bot' ? '#f25c54' : '#efb768'}
                        opacity={1 - contact.distance * 0.35}
                    />
                ))}
                <circle cx={torsoMarker.x} cy={torsoMarker.y} r="4.2" fill="#7ee6f0" />
                <circle cx={center} cy={center} r="3.4" fill="#efb768" />
            </svg>
            <div className="absolute left-1/2 top-[10px] h-0 w-0 -translate-x-1/2 border-x-[5px] border-x-transparent border-b-[10px] border-b-[#efb768]" />
            <div className="absolute inset-x-0 bottom-[7px] text-center text-[7px] tracking-[0.24em] text-[#9fc4cc]">{props.t('mobile.radar')}</div>
        </div>
    );
}

function PortraitRadarDock(props: Pick<MobileCombatLayoutProps, 'legYaw' | 'torsoYaw' | 'twistRatio' | 'hpRatio' | 'steamRatio' | 'speed' | 'maxSpeed' | 'radarContacts' | 'locale' | 't'>) {
    const metrics = buildHudMetrics(props);

    return (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom,0px)+14px)] left-1/2 z-20 -translate-x-1/2">
            <div className="flex flex-col items-center gap-1.5">
                {metrics.nearestContact ? (
                    <div
                        className="rounded-full border border-[#8f6a38]/45 bg-[rgba(8,8,8,0.82)] px-3 py-1 text-[8px] font-bold tracking-[0.18em] shadow-[0_0_14px_rgba(0,0,0,0.24)]"
                        style={{ color: metrics.nearestColor }}
                    >
                        {metrics.nearestText}
                    </div>
                ) : null}

                <div className="flex items-center gap-1.5">
                    <ValueBadge label={props.t('mobile.status.chassis')} value={metrics.chassisHeading} tone="chassis" />
                    <ValueBadge label={props.t('mobile.status.torso')} value={metrics.torsoHeading} tone="torso" />
                    <ValueBadge label={props.t('mobile.status.shift')} value={metrics.twistText} tone="twist" />
                </div>

                <RadarDial radarContacts={props.radarContacts} twistRatio={props.twistRatio} variant="portrait" t={props.t} />

                <div className="flex items-center gap-1.5">
                    <MeterBadge label={props.t('mobile.status.armor')} ratio={props.hpRatio} gradient="bg-[linear-gradient(90deg,#d04838,#f0b371)]" />
                    <ValueBadge label={props.t('mobile.status.speed')} value={metrics.speedDisplay} tone="speed" />
                    <MeterBadge label={props.t('mobile.status.steam')} ratio={props.steamRatio} gradient="bg-[linear-gradient(90deg,#efb768,#7ee6f0)]" />
                </div>
            </div>
        </div>
    );
}

function LandscapeTopStrip(props: Pick<MobileCombatLayoutProps, 'warning' | 'legYaw' | 'torsoYaw' | 'twistRatio' | 'hpRatio' | 'steamRatio' | 'speed' | 'maxSpeed' | 'radarContacts' | 'onOpenSettings' | 'locale' | 't'>) {
    const metrics = buildHudMetrics(props);

    return (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
            <div className="mx-auto flex max-w-[min(96vw,980px)] items-center gap-2">
                <div className="min-w-0 flex-1 rounded-full border border-[#8f6a38]/55 bg-[rgba(10,10,10,0.8)] px-4 py-2 text-[9px] tracking-[0.22em] text-[#efb768] shadow-[0_0_18px_rgba(0,0,0,0.3)]">
                    {props.warning}
                </div>

                <div className="flex items-center gap-1.5">
                    <ValueBadge label={props.t('mobile.status.chassis')} value={metrics.chassisHeading} tone="chassis" />
                    <ValueBadge label={props.t('mobile.status.torso')} value={metrics.torsoHeading} tone="torso" />
                    <ValueBadge label={props.t('mobile.status.shift')} value={metrics.twistText} tone="twist" />
                </div>

                <div className="flex items-center gap-1.5">
                    <MeterBadge label={props.t('mobile.status.armor')} ratio={props.hpRatio} gradient="bg-[linear-gradient(90deg,#d04838,#f0b371)]" />
                    <MeterBadge label={props.t('mobile.status.steam')} ratio={props.steamRatio} gradient="bg-[linear-gradient(90deg,#efb768,#7ee6f0)]" />
                    <ValueBadge label={props.t('mobile.status.speed')} value={metrics.speedDisplay} tone="speed" />
                </div>

                <button
                    type="button"
                    className="pointer-events-auto shrink-0 rounded-full border border-[#8f6a38]/60 bg-[rgba(10,10,10,0.8)] px-4 py-2 text-[9px] tracking-[0.2em] text-[#d7c5a1]"
                    onClick={props.onOpenSettings}
                >
                    {props.t('common.menu')}
                </button>
            </div>
        </div>
    );
}

function LandscapeRadarDock(props: Pick<MobileCombatLayoutProps, 'radarContacts' | 'twistRatio' | 't'> & { nearestText: string; nearestColor: string; showContact: boolean }) {
    return (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] left-1/2 z-20 -translate-x-1/2">
            <div className="flex flex-col items-center gap-1.5">
                {props.showContact ? (
                    <div
                        className="rounded-full border border-[#8f6a38]/45 bg-[rgba(8,8,8,0.82)] px-3 py-1 text-[8px] font-bold tracking-[0.18em] shadow-[0_0_14px_rgba(0,0,0,0.24)]"
                        style={{ color: props.nearestColor }}
                    >
                        {props.nearestText}
                    </div>
                ) : null}
                <RadarDial radarContacts={props.radarContacts} twistRatio={props.twistRatio} variant="landscape" t={props.t} />
            </div>
        </div>
    );
}

function PortraitTopStrip(props: Pick<MobileCombatLayoutProps, 'warning' | 'onOpenSettings' | 't'>) {
    return (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
            <div className="mx-auto flex max-w-[min(96vw,420px)] items-start justify-between gap-2">
                <div className="min-w-0 flex-1 rounded-full border border-[#8f6a38]/55 bg-[rgba(10,10,10,0.8)] px-4 py-2.5 text-center text-[9px] tracking-[0.22em] text-[#efb768] shadow-[0_0_18px_rgba(0,0,0,0.3)]">
                    {props.warning}
                </div>
                <button
                    type="button"
                    className="pointer-events-auto shrink-0 rounded-full border border-[#8f6a38]/60 bg-[rgba(10,10,10,0.8)] px-4 py-2.5 text-[9px] tracking-[0.2em] text-[#d7c5a1]"
                    onClick={props.onOpenSettings}
                >
                    {props.t('common.menu')}
                </button>
            </div>
        </div>
    );
}

function PortraitCombatLayout(props: MobileCombatLayoutProps) {
    return (
        <>
            <PortraitTopStrip warning={props.warning} onOpenSettings={props.onOpenSettings} t={props.t} />
            <PortraitRadarDock
                legYaw={props.legYaw}
                torsoYaw={props.torsoYaw}
                twistRatio={props.twistRatio}
                hpRatio={props.hpRatio}
                steamRatio={props.steamRatio}
                speed={props.speed}
                maxSpeed={props.maxSpeed}
                radarContacts={props.radarContacts}
                locale={props.locale}
                t={props.t}
            />
            <MobileControls
                game={props.game}
                leftHanded={props.leftHanded}
                isPortrait
                aimSensitivity={props.aimSensitivity}
                t={props.t}
            />
        </>
    );
}

function LandscapeCombatLayout(props: MobileCombatLayoutProps) {
    const metrics = buildHudMetrics(props);

    return (
        <>
            <LandscapeTopStrip
                warning={props.warning}
                legYaw={props.legYaw}
                torsoYaw={props.torsoYaw}
                twistRatio={props.twistRatio}
                hpRatio={props.hpRatio}
                steamRatio={props.steamRatio}
                speed={props.speed}
                maxSpeed={props.maxSpeed}
                radarContacts={props.radarContacts}
                onOpenSettings={props.onOpenSettings}
                locale={props.locale}
                t={props.t}
            />
            <LandscapeRadarDock
                radarContacts={props.radarContacts}
                twistRatio={props.twistRatio}
                nearestText={metrics.nearestText}
                nearestColor={metrics.nearestColor}
                showContact={Boolean(metrics.nearestContact)}
                t={props.t}
            />
            <MobileControls
                game={props.game}
                leftHanded={props.leftHanded}
                isPortrait={false}
                aimSensitivity={props.aimSensitivity}
                t={props.t}
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
