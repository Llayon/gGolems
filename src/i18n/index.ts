import en from './en';
import ru from './ru';
import type { Locale, MessageDescriptor, TranslationDict, TranslationKey, TranslationParams } from './types';

export const LOCALE_STORAGE_KEY = 'gGolems.locale';

export type { TranslationKey } from './types';
export type Translator = (key: TranslationKey, params?: TranslationParams) => string;
export type TranslationDescriptor = MessageDescriptor<TranslationKey>;

const dictionaries: Record<Locale, TranslationDict> = {
    en,
    ru
};

function validateDictionaries() {
    const baseKeys = Object.keys(en) as TranslationKey[];

    (Object.entries(dictionaries) as Array<[Locale, TranslationDict]>).forEach(([locale, dict]) => {
        if (locale === 'en') return;

        const missing = baseKeys.filter((key) => !(key in dict));
        const extra = Object.keys(dict).filter((key) => !(key in en));

        if (missing.length > 0) {
            console.warn(`[i18n] Missing keys for ${locale}:`, missing);
        }

        if (extra.length > 0) {
            console.warn(`[i18n] Extra keys for ${locale}:`, extra);
        }
    });
}

const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

if (isDev) {
    validateDictionaries();
}

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

export function translateMessage(t: Translator, descriptor: TranslationDescriptor) {
    if (typeof descriptor === 'string') {
        return t(descriptor);
    }
    return t(descriptor.key, descriptor.params);
}
