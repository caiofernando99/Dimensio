import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, AVAILABLE_LANGUAGES, Translations, LanguageOption } from './types';
import { ptTranslations } from './locales/pt';
import { esTranslations } from './locales/es';
import { enTranslations } from './locales/en';

const STORAGE_KEY = 'dimensio_locale';

const translationsMap: Record<Language, Translations> = {
  pt: ptTranslations,
  es: esTranslations,
  en: enTranslations,
};

interface I18nContextType {
  language: Language;
  currentLanguage: LanguageOption;
  availableLanguages: LanguageOption[];
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  translations: Translations;
}

const I18nContext = createContext<I18nContextType | null>(null);

function detectInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'pt';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Language;
    if (saved && ['pt', 'es', 'en'].includes(saved)) {
      return saved;
    }
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('es')) return 'es';
    if (navLang.startsWith('en')) return 'en';
    return 'pt';
  } catch {
    return 'pt';
  }
}

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // storage unavailable
    }
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // ignore
    }
  }, [language]);

  /**
   * Safe property-path resolver (e.g. t('auth.login') or t('nav.presence'))
   * with automatic fallback to Portuguese if the key is missing.
   */
  const t = (path: string, params?: Record<string, string | number>): string => {
    const currentDict = translationsMap[language] || ptTranslations;
    const fallbackDict = ptTranslations;

    const resolve = (obj: any, p: string) => {
      return p.split('.').reduce((prev, curr) => (prev && prev[curr] !== undefined ? prev[curr] : undefined), obj);
    };

    let val = resolve(currentDict, path);
    if (val === undefined) {
      val = resolve(fallbackDict, path);
    }

    if (typeof val !== 'string') {
      return path;
    }

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        val = (val as string).replace(new RegExp(`{${k}}`, 'g'), String(v));
      });
    }

    return val;
  };

  const currentOption = AVAILABLE_LANGUAGES.find((l) => l.code === language) || AVAILABLE_LANGUAGES[0];

  return (
    <I18nContext.Provider
      value={{
        language,
        currentLanguage: currentOption,
        availableLanguages: AVAILABLE_LANGUAGES,
        setLanguage,
        t,
        translations: translationsMap[language] || ptTranslations,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback if called outside provider
    const fallbackOption = AVAILABLE_LANGUAGES[0];
    return {
      language: 'pt',
      currentLanguage: fallbackOption,
      availableLanguages: AVAILABLE_LANGUAGES,
      setLanguage: () => {},
      t: (path: string) => path,
      translations: ptTranslations,
    };
  }
  return ctx;
}

export * from './types';
