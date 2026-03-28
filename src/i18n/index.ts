import en from './en';
import ru from './ru';
import type { Locale, TranslationDict, TranslationParams } from './types';

export const LOCALE_STORAGE_KEY = 'gGolems.locale';

export type TranslationKey = keyof typeof en;
export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

const dictionaries: Record<Locale, TranslationDict> = {
    en,
    ru
};

function interpolate(template: string, params?: TranslationParams) {
    if (!params) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
        const value = params[key];
        return value === undefined ? `{{${key}}}` : String(value);
    });
}

export function resolveLocale(input?: string | null): Locale {
    if (!input) return 'en';
    const normalized = input.toLowerCase();
    if (normalized.startsWith('ru')) return 'ru';
    if (normalized.startsWith('en')) return 'en';
    return 'en';
}

export function getInitialLocale(): Locale {
    if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (saved) return resolveLocale(saved);
    }
    if (typeof navigator !== 'undefined') {
        return resolveLocale(navigator.language);
    }
    return 'en';
}

export function saveLocale(locale: Locale) {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
}

export function createTranslator(locale: Locale): Translator {
    return (key, params) => {
        const template = dictionaries[locale][key] ?? dictionaries.en[key];
        if (!template) {
            if (typeof console !== 'undefined') {
                console.warn(`Missing i18n key: ${String(key)}`);
            }
            return String(key);
        }
        return interpolate(template, params);
    };
}
