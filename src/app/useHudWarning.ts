import { formatSeconds } from '../i18n/format';
import type { Locale } from '../i18n/types';
import type { TranslationDescriptor } from '../i18n';

export type HudInput = {
    isTouchDevice: boolean;
    torsoYaw: number;
    legYaw: number;
    maxTwist: number;
    throttle: number;
    hp: number;
    maxHp: number;
    steam: number;
    maxSteam: number;
    isOverheated: boolean;
    overheatTimer: number;
};

export function computeHudWarning(input: HudInput, locale: Locale): TranslationDescriptor {
    const torsoOffset = Math.atan2(
        Math.sin(input.torsoYaw - input.legYaw),
        Math.cos(input.torsoYaw - input.legYaw)
    );
    const twistRatio = input.maxTwist > 0
        ? Math.max(-1, Math.min(1, torsoOffset / input.maxTwist))
        : 0;
    const throttleRatio = Math.max(-0.45, Math.min(1, input.throttle));

    if (input.isOverheated) {
        return { key: 'hud.warning.overheat', params: { seconds: formatSeconds(locale, input.overheatTimer) } };
    }
    if (Math.abs(twistRatio) > 0.86) {
        return { key: 'hud.warning.torsoLimit' };
    }
    if (!input.isTouchDevice && Math.abs(twistRatio) > 0.6) {
        return { key: 'hud.warning.centerTorso' };
    }
    if (throttleRatio < -0.05) {
        return { key: 'hud.warning.reverse' };
    }
    if (throttleRatio > 0.7) {
        return { key: 'hud.warning.fullAhead' };
    }
    return { key: 'hud.warning.cruise' };
}

export function computeHudRatios(input: { hp: number; maxHp: number; steam: number; maxSteam: number; throttle: number }) {
    return {
        hpRatio: input.maxHp > 0 ? input.hp / input.maxHp : 0,
        steamRatio: input.maxSteam > 0 ? input.steam / input.maxSteam : 0,
        throttleRatio: Math.max(-0.45, Math.min(1, input.throttle))
    };
}
