import type { AimPreset, SessionMode } from './types';
import type { Locale } from '../../i18n/types';
import type { TranslationDescriptor, Translator } from '../../i18n';
import { translateMessage } from '../../i18n';

type MobileSettingsOverlayProps = {
    open: boolean;
    isPortrait: boolean;
    sessionMode: SessionMode;
    sessionMessage: TranslationDescriptor;
    cameraMode: 'cockpit' | 'thirdPerson';
    myId: string;
    copyMessage: TranslationDescriptor;
    leftHanded: boolean;
    aimPreset: AimPreset;
    atmosphereEnabled: boolean;
    locale: Locale;
    t: Translator;
    onClose: () => void;
    onCopyHostId: () => void;
    onToggleCameraMode: () => void;
    onToggleHanded: () => void;
    onCycleAimPreset: () => void;
    onToggleAtmosphere: () => void;
    onToggleLocale: () => void;
};

export function MobileSettingsOverlay(props: MobileSettingsOverlayProps) {
    if (!props.open) return null;

    return (
        <div className="absolute inset-0 z-50 pointer-events-auto">
            <button
                type="button"
                aria-label={props.t('common.close')}
                className="absolute inset-0 bg-[rgba(0,0,0,0.56)]"
                onClick={props.onClose}
            />

            <div
                className={`absolute border border-[#8f6a38]/45 bg-[linear-gradient(180deg,rgba(14,13,11,0.96),rgba(8,8,8,0.94))] text-[#dfcca6] shadow-[0_0_28px_rgba(0,0,0,0.4)] ${props.isPortrait ? 'inset-x-0 bottom-0 rounded-t-[30px] border-b-0 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] pt-4' : 'right-[calc(env(safe-area-inset-right,0px)+18px)] top-[calc(env(safe-area-inset-top,0px)+18px)] w-[min(420px,62vw)] rounded-[28px] p-5'}`}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-[11px] tracking-[0.34em] text-[#8fb8c2]">{props.t('mobile.settings.title')}</div>
                        <div className="mt-2 text-xs tracking-[0.24em] text-[#d3b886]">{translateMessage(props.t, props.sessionMessage)}</div>
                    </div>
                    <button
                        type="button"
                        className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a]"
                        onClick={props.onClose}
                    >
                        {props.t('common.close')}
                    </button>
                </div>

                <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 p-3">
                        <div className="text-[10px] tracking-[0.28em] text-[#8fb8c2]">{props.t('mobile.settings.controls')}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a]"
                                onClick={props.onToggleCameraMode}
                            >
                                {props.t(props.cameraMode === 'thirdPerson' ? 'camera.3p' : 'camera.fp')}
                            </button>
                            <button
                                type="button"
                                className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a]"
                                onClick={props.onToggleHanded}
                            >
                                {props.leftHanded ? props.t('mobile.settings.leftHanded') : props.t('mobile.settings.rightHanded')}
                            </button>
                            <button
                                type="button"
                                className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a]"
                                onClick={props.onCycleAimPreset}
                            >
                                {props.t('mobile.settings.aimSensitivity', { preset: props.aimPreset })}
                            </button>
                            <button
                                type="button"
                                className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a]"
                                onClick={props.onToggleAtmosphere}
                            >
                                {props.t(props.atmosphereEnabled ? 'mobile.settings.atmosphereOn' : 'mobile.settings.atmosphereOff')}
                            </button>
                            <button
                                type="button"
                                className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a]"
                                onClick={props.onToggleLocale}
                            >
                                {props.t('locale.current', { label: props.t('locale.label'), value: props.t(props.locale === 'ru' ? 'locale.ru' : 'locale.en') })}
                            </button>
                        </div>
                    </div>

                    {props.sessionMode === 'host' && props.myId ? (
                        <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 p-3">
                            <div className="text-[10px] tracking-[0.28em] text-[#8fb8c2]">{props.t('mobile.settings.hostId')}</div>
                            <div className="mt-2 select-all break-all text-sm font-bold tracking-[0.16em] text-[#efb768]">
                                {props.myId}
                            </div>
                            <button
                                type="button"
                                className="mt-3 rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a]"
                                onClick={props.onCopyHostId}
                            >
                                {translateMessage(props.t, props.copyMessage)}
                            </button>
                        </div>
                    ) : null}

                    <div className="rounded-2xl border border-[#8f6a38]/35 bg-black/30 p-3">
                        <div className="text-[10px] tracking-[0.28em] text-[#8fb8c2]">{props.t('mobile.settings.hints')}</div>
                        <ul className="mt-3 space-y-2 text-[11px] tracking-[0.16em] text-[#d7c5a1]">
                            <li>{props.t('mobile.settings.hint.leftCircle')}</li>
                            <li>{props.t('mobile.settings.hint.rightZone')}</li>
                            <li>{props.t('mobile.settings.hint.fire')}</li>
                            <li>{props.t('mobile.settings.hint.altFire')}</li>
                            <li>{props.t('mobile.settings.hint.dashVent')}</li>
                            <li>{props.t('mobile.settings.hint.centerTorso')}</li>
                            <li>{props.t('mobile.settings.hint.stopThrottle')}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
