import type { Locale } from './types';

function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercent(locale: Locale, value: number) {
    return `${formatNumber(locale, value, { maximumFractionDigits: 0 })}%`;
}

export function formatDistance(locale: Locale, meters: number) {
    const unit = locale === 'ru' ? 'м' : 'm';
    return `${formatNumber(locale, meters, { maximumFractionDigits: 0 })}${unit}`;
}

export function formatSeconds(locale: Locale, seconds: number) {
    const unit = locale === 'ru' ? 'с' : 's';
    return `${formatNumber(locale, seconds, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${unit}`;
}

export function formatSpeedUnit(locale: Locale) {
    return locale === 'ru' ? 'км/ч' : 'km/h';
}
