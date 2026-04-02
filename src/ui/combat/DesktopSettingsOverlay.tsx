import { translateMessage, type TranslationDescriptor, type Translator } from '../../i18n';
import type { Locale } from '../../i18n/types';
import type { DesktopHudCopyState, DesktopHudSessionMode } from './desktopHudTypes';

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

type DesktopSettingsOverlayProps = {
    open: boolean;
    sessionMode: DesktopHudSessionMode;
    cameraMode: 'cockpit' | 'thirdPerson';
    myId: string;
    copyState: DesktopHudCopyState;
    atmosphereEnabled: boolean;
    locale: Locale;
    t: Translator;
    onClose: () => void;
    onCopyHostId: () => void;
    onToggleCameraMode: () => void;
    onToggleAtmosphere: () => void;
    onToggleLocale: () => void;
};

export function DesktopSettingsOverlay(props: DesktopSettingsOverlayProps) {
    if (!props.open) return null;

    return (
        <div className="absolute inset-0 z-30 pointer-events-auto">
            <button
                type="button"
                aria-label={props.t('common.close')}
                className="absolute inset-0 bg-[rgba(0,0,0,0.42)]"
                onClick={props.onClose}
            />

            <div className="absolute right-4 top-4 w-[min(360px,calc(100vw-32px))] rounded-[28px] border border-[#8f6a38]/45 bg-[linear-gradient(180deg,rgba(14,13,11,0.96),rgba(8,8,8,0.94))] p-5 text-[#dfcca6] shadow-[0_0_28px_rgba(0,0,0,0.4)]">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-[11px] tracking-[0.34em] text-[#8fb8c2]">{props.t('mobile.settings.title')}</div>
                        <div className="mt-2 text-xs tracking-[0.24em] text-[#d3b886]">
                            {translateMessage(props.t, getSessionMessage(props.sessionMode))}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                        onClick={props.onClose}
                    >
                        {props.t('common.close')}
                    </button>
                </div>

                <div className="mt-4 rounded-2xl border border-[#8f6a38]/35 bg-black/30 p-3">
                    <div className="text-[10px] tracking-[0.28em] text-[#8fb8c2]">{props.t('mobile.settings.controls')}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                            onClick={props.onToggleCameraMode}
                        >
                            {props.t(props.cameraMode === 'thirdPerson' ? 'camera.3p' : 'camera.fp')}
                        </button>
                        <button
                            type="button"
                            className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                            onClick={props.onToggleAtmosphere}
                        >
                            {props.t(props.atmosphereEnabled ? 'mobile.settings.atmosphereOn' : 'mobile.settings.atmosphereOff')}
                        </button>
                        <button
                            type="button"
                            className="rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.22em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                            onClick={props.onToggleLocale}
                        >
                            {props.t('locale.current', { label: props.t('locale.label'), value: props.t(props.locale === 'ru' ? 'locale.ru' : 'locale.en') })}
                        </button>
                    </div>
                </div>

                {props.sessionMode === 'host' && props.myId ? (
                    <div className="mt-3 rounded-2xl border border-[#8f6a38]/35 bg-black/30 p-3">
                        <div className="text-[10px] tracking-[0.28em] text-[#8fb8c2]">{props.t('mobile.settings.hostId')}</div>
                        <div className="mt-2 select-all break-all text-sm font-bold tracking-[0.16em] text-[#efb768]">
                            {props.myId}
                        </div>
                        <button
                            type="button"
                            className="mt-3 rounded-full border border-[#8f6a38]/55 bg-black/35 px-3 py-2 text-[10px] tracking-[0.24em] text-[#d8c19a] transition-colors hover:border-[#efb768]/70 hover:text-[#efb768]"
                            onClick={props.onCopyHostId}
                        >
                            {translateMessage(props.t, getCopyMessage(props.copyState))}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
