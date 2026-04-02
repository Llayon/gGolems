import { formatPercent, formatSeconds } from '../../i18n/format';
import { translateMessage, type TranslationDescriptor } from '../../i18n';
import { clamp, angleDiff, toDegrees, wrapDegrees } from './desktopHudPrimitives';
import type {
    DesktopCombatHudProps,
    DesktopCombatHudViewModel,
    DesktopHudCopyState,
    DesktopHudSessionMode
} from './desktopHudTypes';

function getSessionMessage(sessionMode: DesktopHudSessionMode): TranslationDescriptor {
    return sessionMode === 'solo'
        ? 'session.solo'
        : sessionMode === 'host'
            ? 'session.host'
            : 'session.client';
}

function getCopyMessage(copyState: DesktopHudCopyState): TranslationDescriptor {
    return copyState === 'copied'
        ? 'common.copied'
        : copyState === 'error'
            ? 'common.failed'
            : 'common.copy';
}

export function buildDesktopHudViewModel(props: DesktopCombatHudProps): DesktopCombatHudViewModel {
    const { gameState, locale, sessionMode, myId, copyState, showPilotPanel, atmosphereEnabled, t } = props;
    const torsoOffset = angleDiff(gameState.legYaw, gameState.torsoYaw);
    const twistRatio = gameState.maxTwist > 0 ? clamp(torsoOffset / gameState.maxTwist, -1, 1) : 0;
    const throttleRatio = clamp(gameState.throttle, -0.45, 1);
    const hpRatio = gameState.maxHp > 0 ? gameState.hp / gameState.maxHp : 0;
    const steamRatio = gameState.maxSteam > 0 ? gameState.steam / gameState.maxSteam : 0;
    const displaySpeed = Math.round((gameState.speed / Math.max(gameState.maxSpeed, 0.1)) * 68);

    const throttleMessage: TranslationDescriptor = throttleRatio > 0.05
        ? { key: 'hud.throttle.forward', params: { percent: formatPercent(locale, Math.round(throttleRatio * 100)) } }
        : throttleRatio < -0.05
            ? { key: 'hud.throttle.reverse', params: { percent: formatPercent(locale, Math.round(-throttleRatio * 100)) } }
            : { key: 'hud.throttle.zero' };
    const warningMessage: TranslationDescriptor = gameState.isOverheated
        ? { key: 'hud.warning.overheat', params: { seconds: formatSeconds(locale, gameState.overheatTimer) } }
        : Math.abs(twistRatio) > 0.86
            ? { key: 'hud.warning.torsoLimit' }
            : Math.abs(twistRatio) > 0.6
                ? { key: 'hud.warning.centerTorso' }
                : throttleRatio < -0.05
                    ? { key: 'hud.warning.reverse' }
                    : throttleRatio > 0.7
                        ? { key: 'hud.warning.fullAhead' }
                        : { key: 'hud.warning.cruise' };

    const sessionLabel = translateMessage(t, getSessionMessage(sessionMode));
    const copyLabel = translateMessage(t, getCopyMessage(copyState));
    const cameraModeLabel = translateMessage(t, gameState.cameraMode === 'thirdPerson' ? 'camera.3p' : 'camera.fp');
    const terrainDebugLabel = translateMessage(
        t,
        gameState.terrainColliderMode === 'heightfield' ? 'hud.debug.terrainHF' : 'hud.debug.terrainTMFallback'
    );
    const sessionSummaryLabel = t(
        sessionMode === 'solo' ? 'pilot.summary.base' : 'pilot.summary.withId',
        sessionMode === 'solo'
            ? { session: sessionLabel, camera: cameraModeLabel }
            : { session: sessionLabel, camera: cameraModeLabel, idLabel: t('common.id'), id: myId || t('session.sync') }
    );

    const zeroLineTop = 69;
    return {
        cockpitFrame: gameState.cameraMode === 'cockpit'
            ? {
                warning: translateMessage(t, warningMessage),
                throttleLabel: translateMessage(t, throttleMessage),
                kickX: gameState.cockpitKickX,
                kickY: gameState.cockpitKickY,
                kickRoll: gameState.cockpitKickRoll,
                frameKick: gameState.cockpitFrameKick,
                flash: gameState.cockpitFlash
            }
            : null,
        hostBadge: sessionMode === 'host' && myId
            ? {
                hostIdLabel: t('pilot.hostId'),
                hostId: myId,
                copyLabel
            }
            : null,
        pilotPanel: {
            visible: showPilotPanel,
            title: t('pilot.title'),
            summary: sessionSummaryLabel,
            terrainDebugLabel,
            terrainDebugTone: gameState.terrainColliderMode === 'heightfield' ? 'text-[#8fb8c2]' : 'text-[#f3b56c]',
            atmosphereLabel: t(atmosphereEnabled ? 'mobile.settings.atmosphereOn' : 'mobile.settings.atmosphereOff'),
            localeLabel: t('locale.current', { label: t('locale.label'), value: t(locale === 'ru' ? 'locale.ru' : 'locale.en') }),
            copyLabel,
            showHostCopy: sessionMode === 'host' && Boolean(myId),
            hideLabel: t('pilot.hide'),
            showLabel: t('pilot.show'),
            controls: [
                t('pilot.controls.mouse'),
                t('pilot.controls.ws'),
                t('pilot.controls.ad'),
                t('pilot.controls.c'),
                t('pilot.controls.x'),
                t('pilot.controls.v'),
                t('pilot.controls.fire'),
                t('pilot.controls.fire2'),
                t('pilot.controls.fire3'),
                t('pilot.controls.alpha'),
                t('pilot.controls.shift'),
                t('pilot.controls.space')
            ]
        },
        overlay: {
            reticleX: Math.max(-320, Math.min(320, gameState.aimOffsetX * 320 + gameState.reticleKickX)),
            reticleY: Math.max(-220, Math.min(220, -gameState.aimOffsetY * 180 + gameState.reticleKickY)),
            hitConfirmRatio: clamp(gameState.hitConfirm / 0.22, 0, 1),
            hitTargetRatio: clamp(gameState.hitTargetHp / Math.max(gameState.hitTargetMaxHp, 1), 0, 1),
            showAlignPrompt: Math.abs(twistRatio) > 0.55,
            alignPrompt:
                sessionMode === 'solo' || sessionMode === 'host' || sessionMode === 'client'
                    ? 'hud.alignChassisHotkey'
                    : 'hud.alignChassis'
        },
        bottomHud: {
            twistRatio,
            torsoOffsetDegrees: Math.round(toDegrees(torsoOffset)).toString().padStart(3, ' '),
            throttlePercent: Math.round(throttleRatio * 100),
            throttleDirectionLabel: throttleRatio > 0.05
                ? t('hud.move.forward')
                : throttleRatio < -0.05
                    ? t('hud.move.reverse')
                    : t('hud.move.stop'),
            forwardFillHeight: `${Math.max(0, throttleRatio) * zeroLineTop}%`,
            reverseFillHeight: `${Math.max(0, -throttleRatio / 0.45) * (100 - zeroLineTop)}%`,
            displaySpeed,
            speedFillPercent: clamp((gameState.speed / Math.max(gameState.maxSpeed, 0.1)) * 100, 0, 100),
            hpFillPercent: clamp(hpRatio * 100, 0, 100),
            hpLabel: `${Math.ceil(gameState.hp)} / ${gameState.maxHp}`,
            steamFillPercent: clamp(steamRatio * 100, 0, 100),
            steamLabel: gameState.isOverheated
                ? t('hud.venting', { seconds: formatSeconds(locale, gameState.overheatTimer) })
                : `${Math.ceil(gameState.steam)} / ${gameState.maxSteam}`,
            steamWarning: gameState.isOverheated,
            bodyHeadingLabel: wrapDegrees(Math.round(toDegrees(gameState.legYaw))).toString().padStart(3, '0'),
            torsoHeadingLabel: wrapDegrees(Math.round(toDegrees(gameState.torsoYaw))).toString().padStart(3, '0'),
            twistHeadingLabel: Math.round(toDegrees(torsoOffset)).toString()
        }
    };
}
