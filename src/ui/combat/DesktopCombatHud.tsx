import { CombatOverlayCore } from '../mobile/CombatOverlayCore';
import { formatPercent, formatSeconds, formatSpeedUnit } from '../../i18n/format';
import type { Locale } from '../../i18n/types';
import { translateMessage, type TranslationDescriptor, type Translator } from '../../i18n';
import type { GameHudState } from '../../core/gameHudState';
import {
    CockpitFrame,
    HeadingTape,
    SectionArmorDisplay,
    TorsoTwistArc,
    WeaponRack,
    angleDiff,
    clamp,
    toDegrees,
    wrapDegrees
} from './desktopHudPrimitives';

export function DesktopCombatHud(props: {
    gameState: GameHudState;
    locale: Locale;
    sessionMode: 'solo' | 'host' | 'client';
    myId: string;
    copyState: 'idle' | 'copied' | 'error';
    showPilotPanel: boolean;
    t: Translator;
    onCopyHostId: () => void;
    onTogglePilotPanel: () => void;
    onToggleLocale: () => void;
}) {
    const { gameState, locale, sessionMode, myId, copyState, showPilotPanel, t } = props;
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

    const zeroLineTop = 69;
    const forwardFillHeight = `${Math.max(0, throttleRatio) * zeroLineTop}%`;
    const reverseFillHeight = `${Math.max(0, -throttleRatio / 0.45) * (100 - zeroLineTop)}%`;
    const reticleX = Math.max(-320, Math.min(320, gameState.aimOffsetX * 320 + gameState.reticleKickX));
    const reticleY = Math.max(-220, Math.min(220, -gameState.aimOffsetY * 180 + gameState.reticleKickY));
    const hitConfirmRatio = clamp(gameState.hitConfirm / 0.22, 0, 1);
    const hitTargetRatio = clamp(gameState.hitTargetHp / Math.max(gameState.hitTargetMaxHp, 1), 0, 1);
    const sessionMessage: TranslationDescriptor = sessionMode === 'solo'
        ? 'session.solo'
        : sessionMode === 'host'
            ? 'session.host'
            : 'session.client';
    const copyMessage: TranslationDescriptor = copyState === 'copied'
        ? 'common.copied'
        : copyState === 'error'
            ? 'common.failed'
            : 'common.copy';
    const cameraModeMessage: TranslationDescriptor = gameState.cameraMode === 'thirdPerson' ? 'camera.3p' : 'camera.fp';
    const terrainDebugMessage: TranslationDescriptor = gameState.terrainColliderMode === 'heightfield'
        ? 'hud.debug.terrainHF'
        : 'hud.debug.terrainTMFallback';
    const terrainDebugTone = gameState.terrainColliderMode === 'heightfield'
        ? 'text-[#8fb8c2]'
        : 'text-[#f3b56c]';
    const sessionLabel = translateMessage(t, sessionMessage);
    const copyTextLabel = translateMessage(t, copyMessage);
    const cameraModeLabel = translateMessage(t, cameraModeMessage);
    const terrainDebugLabel = translateMessage(t, terrainDebugMessage);
    const sessionSummaryLabel = t(
        sessionMode === 'solo' ? 'pilot.summary.base' : 'pilot.summary.withId',
        sessionMode === 'solo'
            ? { session: sessionLabel, camera: cameraModeLabel }
            : { session: sessionLabel, camera: cameraModeLabel, idLabel: t('common.id'), id: myId || t('session.sync') }
    );
    const pilotPanelHideLabel = t('pilot.hide');
    const pilotPanelShowLabel = t('pilot.show');
    const alignPromptMessage: TranslationDescriptor = sessionMode === 'solo' || sessionMode === 'host' || sessionMode === 'client'
        ? 'hud.alignChassisHotkey'
        : 'hud.alignChassis';
    const localeLabel = t('locale.current', { label: t('locale.label'), value: t(locale === 'ru' ? 'locale.ru' : 'locale.en') });

    return (
        <>
            {gameState.cameraMode === 'cockpit' ? (
                <CockpitFrame
                    warning={translateMessage(t, warningMessage)}
                    throttleLabel={translateMessage(t, throttleMessage)}
                    kickX={gameState.cockpitKickX}
                    kickY={gameState.cockpitKickY}
                    kickRoll={gameState.cockpitKickRoll}
                    frameKick={gameState.cockpitFrameKick}
                    flash={gameState.cockpitFlash}
                />
            ) : null}

            {sessionMode === 'host' && myId ? (
                <div className="pointer-events-auto absolute right-4 top-4 z-30 flex items-center gap-3 rounded-2xl border border-[#8f6a38]/45 bg-[rgba(10,10,10,0.78)] px-4 py-3 text-[#e1cea7] shadow-[0_0_22px_rgba(0,0,0,0.32)] backdrop-blur-sm">
                    <div className="min-w-0">
                        <div className="text-[10px] tracking-[0.34em] text-[#8fb8c2]">{t('pilot.hostId')}</div>
                        <div className="mt-1 select-all font-bold tracking-[0.18em] text-[#efb768]">{myId}</div>
                    </div>

                    <button
                        type="button"
                        onClick={props.onCopyHostId}
                        className="shrink-0 rounded-full border border-[#8f6a38]/55 bg-black/40 px-4 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                    >
                        {copyTextLabel}
                    </button>
                </div>
            ) : null}

            <div className="absolute left-4 top-4 z-20">
                {showPilotPanel ? (
                    <div className="pointer-events-auto max-w-[280px] rounded-2xl border border-[#8f6a38]/35 bg-[rgba(10,10,10,0.62)] p-4 text-sm text-[#d7c5a1] shadow-[0_0_20px_rgba(0,0,0,0.38)] backdrop-blur-sm">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className="text-lg font-bold tracking-[0.32em] text-[#efb768]">{t('pilot.title')}</h1>
                                <p className="mt-2 text-xs tracking-[0.22em] text-[#8fb8c2]">
                                    {sessionSummaryLabel}
                                </p>
                                <div className={`mt-2 text-[10px] tracking-[0.24em] ${terrainDebugTone}`}>
                                    {terrainDebugLabel}
                                </div>
                                <button
                                    type="button"
                                    onClick={props.onToggleLocale}
                                    className="mt-3 rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-1 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                                >
                                    {localeLabel}
                                </button>
                                {sessionMode === 'host' && myId ? (
                                    <button
                                        type="button"
                                        onClick={props.onCopyHostId}
                                        className="mt-3 rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-1 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                                    >
                                        {copyTextLabel}
                                    </button>
                                ) : null}
                            </div>

                            <button
                                type="button"
                                onClick={props.onTogglePilotPanel}
                                className="rounded-full border border-[#8f6a38]/55 bg-black/45 px-3 py-1 text-[10px] tracking-[0.24em] text-[#cdb488] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                            >
                                {pilotPanelHideLabel}
                            </button>
                        </div>

                        <ul className="space-y-1 text-[11px] tracking-[0.18em] text-[#b9c7c8]">
                            <li>{t('pilot.controls.mouse')}</li>
                            <li>{t('pilot.controls.ws')}</li>
                            <li>{t('pilot.controls.ad')}</li>
                            <li>{t('pilot.controls.c')}</li>
                            <li>{t('pilot.controls.x')}</li>
                            <li>{t('pilot.controls.v')}</li>
                            <li>{t('pilot.controls.fire')}</li>
                            <li>{t('pilot.controls.fire2')}</li>
                            <li>{t('pilot.controls.fire3')}</li>
                            <li>{t('pilot.controls.alpha')}</li>
                            <li>{t('pilot.controls.shift')}</li>
                            <li>{t('pilot.controls.space')}</li>
                        </ul>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={props.onTogglePilotPanel}
                        className="pointer-events-auto rounded-full border border-[#8f6a38]/55 bg-[rgba(10,10,10,0.72)] px-4 py-2 text-[10px] tracking-[0.3em] text-[#cdb488] shadow-[0_0_18px_rgba(0,0,0,0.3)] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                    >
                        {pilotPanelShowLabel}
                    </button>
                )}
            </div>

            <TorsoTwistArc twistRatio={twistRatio} maxTwist={gameState.maxTwist} t={t} />

            <CombatOverlayCore
                reticleX={reticleX}
                reticleY={reticleY}
                hitConfirmRatio={hitConfirmRatio}
                hitTargetRatio={hitTargetRatio}
                showAlignPrompt={Math.abs(twistRatio) > 0.55}
                alignPrompt={alignPromptMessage}
                t={t}
            />

            <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 flex h-[248px] w-[min(1040px,96vw)] -translate-x-1/2 items-end justify-between px-8 pb-8">
                <div className="flex w-[190px] items-end gap-4">
                    <div className="relative h-[188px] w-20 rounded-[26px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                        <div className="mb-2 text-center text-[10px] tracking-[0.42em] text-[#efb768]">{t('hud.throttle.label')}</div>
                        <div className="relative mx-auto h-[136px] w-7 rounded-full border border-[#6c5330]/70 bg-[#060606]/80">
                            <div className="absolute inset-x-[4px] top-[69%] h-px bg-[#d1b17d]/75" />
                            <div
                                className="absolute bottom-[31%] left-[4px] right-[4px] rounded-b-full bg-[linear-gradient(180deg,#ffcc7e,#b6652f)] shadow-[0_0_12px_rgba(255,163,76,0.38)]"
                                style={{ height: forwardFillHeight }}
                            />
                            <div
                                className="absolute left-[4px] right-[4px] top-[69%] rounded-t-full bg-[linear-gradient(180deg,#7ee6f0,#2e829a)] shadow-[0_0_12px_rgba(46,130,154,0.3)]"
                                style={{ height: reverseFillHeight }}
                            />
                        </div>
                        <div className="absolute left-3 top-[44px] text-[9px] tracking-[0.28em] text-[#b8a17a]">{t('hud.throttle.forwardShort')}</div>
                        <div className="absolute left-3 top-[112px] text-[9px] tracking-[0.32em] text-[#b8a17a]">0</div>
                        <div className="absolute left-3 bottom-[18px] text-[9px] tracking-[0.28em] text-[#9dc2cc]">{t('hud.throttle.reverseShort')}</div>
                    </div>

                    <div className="flex-1 rounded-[26px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-4 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                        <div className="text-[10px] tracking-[0.34em] text-[#efb768]">{t('hud.move.label')}</div>
                        <div className="mt-3 text-3xl font-bold tracking-[0.2em] text-[#f3deb5]">
                            {Math.round(throttleRatio * 100)}
                        </div>
                        <div className="mt-1 text-[11px] tracking-[0.28em] text-[#a5bcc2]">
                            {throttleRatio > 0.05 ? t('hud.move.forward') : throttleRatio < -0.05 ? t('hud.move.reverse') : t('hud.move.stop')}
                        </div>
                        <div className="mt-4 text-[10px] tracking-[0.32em] text-[#8db0b7]">
                            {t('hud.torsoOffset', { degrees: Math.round(toDegrees(torsoOffset)).toString().padStart(3, ' ') })}
                        </div>
                    </div>
                </div>

                <div className="mx-6 flex min-w-0 flex-1 flex-col items-center gap-4">
                    <HeadingTape legYaw={gameState.legYaw} torsoYaw={gameState.torsoYaw} maxTwist={gameState.maxTwist} t={t} />

                    <WeaponRack weapons={gameState.weaponStatus} locale={locale} t={t} />

                    <div className="grid w-full grid-cols-3 gap-3 text-center">
                        <div className="rounded-2xl border border-[#8f6a38]/60 bg-black/35 px-4 py-3">
                            <div className="text-[10px] tracking-[0.34em] text-[#a1bdc4]">{t('hud.body')}</div>
                            <div className="mt-1 text-xl font-bold tracking-[0.22em] text-[#efb768]">
                                {wrapDegrees(Math.round(toDegrees(gameState.legYaw))).toString().padStart(3, '0')}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-[#8f6a38]/60 bg-black/35 px-4 py-3">
                            <div className="text-[10px] tracking-[0.34em] text-[#a1bdc4]">{t('hud.torso')}</div>
                            <div className="mt-1 text-xl font-bold tracking-[0.22em] text-[#7ee6f0]">
                                {wrapDegrees(Math.round(toDegrees(gameState.torsoYaw))).toString().padStart(3, '0')}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-[#8f6a38]/60 bg-black/35 px-4 py-3">
                            <div className="text-[10px] tracking-[0.34em] text-[#a1bdc4]">{t('hud.twist')}</div>
                            <div className="mt-1 text-xl font-bold tracking-[0.18em] text-[#f3deb5]">
                                {Math.round(toDegrees(torsoOffset))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex w-[250px] gap-4">
                    <div className="flex-1 rounded-[26px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-4 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                        <div className="text-[10px] tracking-[0.34em] text-[#efb768]">{t('hud.speed')}</div>
                        <div className="mt-3 text-4xl font-bold tracking-[0.18em] text-[#f3deb5]">
                            {displaySpeed}
                        </div>
                        <div className="mt-1 text-[11px] tracking-[0.28em] text-[#a5bcc2]">{formatSpeedUnit(locale)}</div>
                        <div className="mt-4 h-2 rounded-full bg-[#241c16]">
                            <div className="h-full rounded-full bg-[linear-gradient(90deg,#7ee6f0,#efb768)]" style={{ width: `${clamp((gameState.speed / Math.max(gameState.maxSpeed, 0.1)) * 100, 0, 100)}%` }} />
                        </div>
                    </div>

                    <div className="flex w-[132px] flex-col gap-3">
                        <SectionArmorDisplay sections={gameState.sections} maxSections={gameState.maxSections} t={t} />

                        <div className="rounded-[24px] border border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))] p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]">
                            <div className="text-[9px] tracking-[0.3em] text-[#efb768]">{t('hud.armor')}</div>
                            <div className="mt-2 h-2 rounded-full bg-[#241c16]">
                                <div className="h-full rounded-full bg-[linear-gradient(90deg,#d04838,#f0b371)]" style={{ width: `${clamp(hpRatio * 100, 0, 100)}%` }} />
                            </div>
                            <div className="mt-2 text-xs tracking-[0.16em] text-[#f3deb5]">{Math.ceil(gameState.hp)} / {gameState.maxHp}</div>
                        </div>

                        <div className={`rounded-[24px] border p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.5)] ${gameState.isOverheated ? 'border-[#f25c54]/70 bg-[linear-gradient(180deg,rgba(64,18,18,0.94),rgba(28,12,12,0.96))]' : 'border-[#8f6a38]/70 bg-[linear-gradient(180deg,rgba(13,13,13,0.94),rgba(28,20,15,0.96))]'}`}>
                            <div className="text-[9px] tracking-[0.28em] text-[#efb768]">{t('hud.pressure')}</div>
                            <div className="mt-2 h-2 rounded-full bg-[#241c16]">
                                <div className={`h-full rounded-full ${gameState.isOverheated ? 'bg-[linear-gradient(90deg,#ff8855,#f25c54)]' : 'bg-[linear-gradient(90deg,#efb768,#7ee6f0)]'}`} style={{ width: `${clamp(steamRatio * 100, 0, 100)}%` }} />
                            </div>
                            <div className="mt-2 text-xs tracking-[0.14em] text-[#f3deb5]">
                                {gameState.isOverheated ? t('hud.venting', { seconds: formatSeconds(locale, gameState.overheatTimer) }) : `${Math.ceil(gameState.steam)} / ${gameState.maxSteam}`}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
