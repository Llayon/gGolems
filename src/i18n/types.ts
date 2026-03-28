export type Locale = 'en' | 'ru';

export type TranslationParams = Record<string, string | number>;

export type TranslationDict = Record<string, string>;

export type MessageDescriptor<K extends string = string> =
    | K
    | {
        key: K;
        params?: TranslationParams;
    };
