import { useCallback } from 'react';
import { create } from 'zustand';
import ruRU from 'antd/locale/ru_RU';
import uzUZ from 'antd/locale/uz_UZ';
import type { Locale } from 'antd/es/locale';
import { ru, type Dictionary, type TranslationKey } from './ru';
import { uzCyrl } from './uzCyrl';
import { uzLatn } from './uzLatn';

export type Language = 'ru' | 'uz-Cyrl' | 'uz-Latn';
export type { TranslationKey };

const DICTIONARIES: Record<Language, Dictionary> = { ru, 'uz-Cyrl': uzCyrl, 'uz-Latn': uzLatn };

/** Each option is labelled in its own language/script so users can always find theirs. */
export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'uz-Cyrl', label: 'Ўзбекча' },
  { value: 'uz-Latn', label: 'Oʻzbekcha' },
];

/** antd ships only a Latin-script Uzbek locale; it covers both Uzbek options (pagination, pickers). */
export const ANTD_LOCALES: Record<Language, Locale> = { ru: ruRU, 'uz-Cyrl': uzUZ, 'uz-Latn': uzUZ };

const STORAGE_KEY = 'troyka.language';

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in DICTIONARIES) return stored as Language;
  } catch {
    // storage blocked (private mode etc.) — fall back to the default
  }
  return 'ru';
}

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: readStoredLanguage(),
  setLanguage: (language) => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // not persisted, still applied for this visit
    }
    document.documentElement.lang = language;
    set({ language });
  },
}));

export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** `t('signal.minutes', { n: 5 })` → "5 мин" / "5 daq" / "5 дақ". */
export function useT(): TFunction {
  const language = useLanguageStore((s) => s.language);
  return useCallback(
    (key, params) => {
      const template = DICTIONARIES[language][key] ?? ru[key];
      return params ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`)) : template;
    },
    [language],
  );
}

/** Backend error codes (e.g. "EMAIL_TAKEN") → translated message; unknown codes fall back to a generic one. */
export function translateError(t: TFunction, code: string | undefined, status: number): string {
  const key = `error.${code}` as TranslationKey;
  return code && key in ru ? t(key) : t('error.REQUEST_FAILED', { status });
}
