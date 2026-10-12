import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, AVAILABLE_LANGUAGES, Translations, LanguageOption } from './types';
import { ptTranslations } from './locales/pt';
import { esTranslations } from './locales/es';
import { enTranslations } from './locales/en';
import { frTranslations } from './locales/fr';
import { deTranslations } from './locales/de';

const STORAGE_KEY = 'dimensio_locale';
const CUSTOM_LANGS_KEY = 'dimensio_custom_languages';

// Extensible registry of translations
const translationsMap: Record<string, Translations> = {
  pt: ptTranslations,
  es: esTranslations,
  en: enTranslations,
  fr: frTranslations,
  de: deTranslations,
};

let dynamicLanguageList: LanguageOption[] = [...AVAILABLE_LANGUAGES];

function deepMergeTranslations(base: any, override: any): any {
  if (!override || typeof override !== 'object') return base;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      override[key] &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      base[key] &&
      typeof base[key] === 'object'
    ) {
      result[key] = deepMergeTranslations(base[key], override[key]);
    } else if (override[key] !== undefined) {
      result[key] = override[key];
    }
  }
  return result;
}

// Hydrate saved custom languages from localStorage
try {
  if (typeof window !== 'undefined') {
    const rawSavedCustom = localStorage.getItem(CUSTOM_LANGS_KEY);
    if (rawSavedCustom) {
      const parsed = JSON.parse(rawSavedCustom) as Array<{ option: LanguageOption; translations: Partial<Translations> }>;
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item?.option?.code && item?.translations) {
            if (!dynamicLanguageList.some((l) => l.code === item.option.code)) {
              dynamicLanguageList.push(item.option);
            }
            translationsMap[item.option.code] = deepMergeTranslations(ptTranslations, item.translations);
          }
        });
      }
    }
  }
} catch {
  // ignore
}

/**
 * Register a new language dynamically at runtime.
 * Guarantees zero-breaking fallback to base translations.
 */
export function registerLanguage(option: LanguageOption, customTranslations: Partial<Translations>) {
  if (!dynamicLanguageList.some((l) => l.code === option.code)) {
    dynamicLanguageList.push(option);
  }
  translationsMap[option.code] = deepMergeTranslations(ptTranslations, customTranslations);

  try {
    if (typeof window !== 'undefined') {
      const currentSaved: Array<{ option: LanguageOption; translations: Partial<Translations> }> = [];
      dynamicLanguageList.forEach((lang) => {
        if (!AVAILABLE_LANGUAGES.some((base) => base.code === lang.code)) {
          currentSaved.push({ option: lang, translations: translationsMap[lang.code] || {} });
        }
      });
      localStorage.setItem(CUSTOM_LANGS_KEY, JSON.stringify(currentSaved));
    }
  } catch {
    // ignore
  }
}

export function unregisterLanguage(code: string) {
  if (AVAILABLE_LANGUAGES.some((base) => base.code === code)) return; // Don't delete built-in languages
  dynamicLanguageList = dynamicLanguageList.filter((l) => l.code !== code);
  delete translationsMap[code];

  try {
    if (typeof window !== 'undefined') {
      const currentSaved: Array<{ option: LanguageOption; translations: Partial<Translations> }> = [];
      dynamicLanguageList.forEach((lang) => {
        if (!AVAILABLE_LANGUAGES.some((base) => base.code === lang.code)) {
          currentSaved.push({ option: lang, translations: translationsMap[lang.code] || {} });
        }
      });
      localStorage.setItem(CUSTOM_LANGS_KEY, JSON.stringify(currentSaved));
    }
  } catch {
    // ignore
  }
}

interface I18nContextType {
  language: Language;
  currentLanguage: LanguageOption;
  availableLanguages: LanguageOption[];
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  translations: Translations;
  registerCustomLanguage: (option: LanguageOption, translations: Partial<Translations>) => void;
  removeCustomLanguage: (code: string) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

function detectInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'pt';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Language;
    if (saved && dynamicLanguageList.some((l) => l.code === saved)) {
      return saved;
    }
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('es')) return 'es';
    if (navLang.startsWith('en')) return 'en';
    if (navLang.startsWith('fr')) return 'fr';
    if (navLang.startsWith('de')) return 'de';
    return 'pt';
  } catch {
    return 'pt';
  }
}

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage);
  const [availableList, setAvailableList] = useState<LanguageOption[]>(dynamicLanguageList);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // storage unavailable
    }
  };

  const registerCustomLanguage = (option: LanguageOption, customTranslations: Partial<Translations>) => {
    registerLanguage(option, customTranslations);
    setAvailableList([...dynamicLanguageList]);
  };

  const removeCustomLanguage = (code: string) => {
    unregisterLanguage(code);
    setAvailableList([...dynamicLanguageList]);
    if (language === code) {
      setLanguage('pt');
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
   * Safe property-path resolver (e.g. t('auth.login') or t('nav.presence') or t('home.title'))
   * with automatic fallback to Portuguese if the key is missing in active locale.
   */
  const t = (path: string, params?: Record<string, string | number>): string => {
    const currentDict = translationsMap[language] || ptTranslations;
    const fallbackDict = ptTranslations;

    const resolve = (obj: any, p: string) => {
      if (!obj) return undefined;
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

  const currentOption = availableList.find((l) => l.code === language) || availableList[0];

  return (
    <I18nContext.Provider
      value={{
        language,
        currentLanguage: currentOption,
        availableLanguages: availableList,
        setLanguage,
        t,
        translations: translationsMap[language] || ptTranslations,
        registerCustomLanguage,
        removeCustomLanguage,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    const fallbackOption = dynamicLanguageList[0];
    return {
      language: 'pt',
      currentLanguage: fallbackOption,
      availableLanguages: dynamicLanguageList,
      setLanguage: () => {},
      t: (path: string) => path,
      translations: ptTranslations,
      registerCustomLanguage: () => {},
      removeCustomLanguage: () => {},
    };
  }
  return ctx;
}

export * from './types';
