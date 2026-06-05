import { type Translator } from '../i18n';
import { formatSeconds } from '../i18n/format';
import type { Locale } from '../i18n/types';
import type { StartupFailure } from './useGameSession';
import type { TranslationKey } from '../i18n';

const startupPhaseLabelKeys: Record<'startWorld' | 'createSession' | 'connectToHost', TranslationKey> = {
    startWorld: 'errors.startWorld',
    createSession: 'errors.createSession',
    connectToHost: 'errors.connectToHost'
};

export async function copyText(text: string) {
    if (!text) return false;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Fallback below.
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const result = document.execCommand('copy');
        document.body.removeChild(textarea);
        return result;
    } catch {
        return false;
    }
}

export function getStartupFailureMessage(t: Translator, locale: Locale, failure: StartupFailure) {
    const withDetail = (message: string) => failure.detail
        ? `${message}\n\n${t('errors.detail', { detail: failure.detail })}`
        : message;

    switch (failure.code) {
        case 'timeout':
            return withDetail(t('errors.timeout', {
                label: failure.phase ? t(startupPhaseLabelKeys[failure.phase]) : t('errors.startWorld'),
                seconds: formatSeconds(locale, failure.seconds ?? 15)
            }));
        case 'hostIdRequired':
            return t('errors.hostIdRequired');
        case 'peerUnavailable':
            return withDetail(t('errors.peerUnavailable'));
        case 'peerIdUnavailable':
            return withDetail(t('errors.peerIdUnavailable'));
        case 'networkUnavailable':
            return withDetail(t('errors.networkUnavailable'));
        case 'serverError':
            return withDetail(t('errors.serverError'));
        case 'connectionFailed':
            return withDetail(t('errors.connectionFailed'));
        case 'invalidHostId':
            return withDetail(t('errors.invalidHostId'));
        default:
            if (failure.phase) {
                return withDetail(t('errors.phaseFailed', { label: t(startupPhaseLabelKeys[failure.phase]) }));
            }
            return t('errors.startup', { message: failure.detail || t('errors.unknown') });
    }
}

export function releasePointerLock() {
    if (typeof document === 'undefined' || typeof document.exitPointerLock !== 'function') {
        return;
    }
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
}
