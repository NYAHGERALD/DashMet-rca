// Industry-standard i18n React Provider
// Uses static translation files for instant, reliable translations

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getTranslation, LanguageCode, LANGUAGES, getAvailableLanguages, isLanguageAvailable } from './index';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';

// Map database enum to language code
const DB_TO_CODE: Record<string, LanguageCode> = {
  ENGLISH: 'en',
  SPANISH: 'es',
  FRENCH: 'fr',
  GERMAN: 'de',
  PORTUGUESE: 'pt',
  ITALIAN: 'it',
  CHINESE: 'zh',
  JAPANESE: 'ja',
  KOREAN: 'ko',
  ARABIC: 'ar',
  HINDI: 'hi',
  RUSSIAN: 'ru',
  DUTCH: 'nl',
  POLISH: 'pl',
  TURKISH: 'tr',
  VIETNAMESE: 'vi',
  THAI: 'th',
  INDONESIAN: 'id',
  MALAY: 'ms',
  FILIPINO: 'tl',
};

const CODE_TO_DB: Record<LanguageCode, string> = Object.entries(DB_TO_CODE).reduce(
  (acc, [db, code]) => ({ ...acc, [code]: db }),
  {} as Record<LanguageCode, string>
);

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  availableLanguages: ReturnType<typeof getAvailableLanguages>;
  allLanguages: typeof LANGUAGES;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: React.ReactNode;
  defaultLanguage?: LanguageCode;
}

export function I18nProvider({ children, defaultLanguage = 'en' }: I18nProviderProps) {
  const [language, setLanguageState] = useState<LanguageCode>(defaultLanguage);
  const [isLoading, setIsLoading] = useState(true);

  // Load language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        // First check localStorage
        const stored = localStorage.getItem('userLanguage') as LanguageCode | null;
        if (stored && isLanguageAvailable(stored)) {
          setLanguageState(stored);
        }

        // Only try to load from user preferences if user is logged in
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          try {
            const response = await api.get('/preferences');
            if (response.data?.data?.language) {
              const dbLang = response.data.data.language;
              const langCode = DB_TO_CODE[dbLang] || 'en';
              if (isLanguageAvailable(langCode)) {
                setLanguageState(langCode);
                localStorage.setItem('userLanguage', langCode);
              }
            }
          } catch {
            // User might not have preferences set, use localStorage value
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  // Set language and persist
  const setLanguage = useCallback(async (lang: LanguageCode) => {
    // Only allow available languages
    if (!isLanguageAvailable(lang)) {
      console.warn(`Language ${lang} is not available yet. Using English.`);
      lang = 'en';
    }

    setLanguageState(lang);
    localStorage.setItem('userLanguage', lang);

    // Save to user preferences only if logged in
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      try {
        await api.patch('/preferences', { language: CODE_TO_DB[lang] || 'ENGLISH' });
      } catch {
        // Failed to save to server, localStorage is still updated
      }
    }
  }, []);

  // Translation function
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return getTranslation(key, language, params);
    },
    [language]
  );

  // Memoize available languages
  const availableLanguages = useMemo(() => getAvailableLanguages(), []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      availableLanguages,
      allLanguages: LANGUAGES,
      isLoading,
    }),
    [language, setLanguage, t, availableLanguages, isLoading]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Hook to access i18n functionality
 * 
 * @example
 * const { t, language, setLanguage } = useI18n();
 * 
 * // Simple translation
 * <h1>{t('settings.title')}</h1>
 * 
 * // With parameters
 * <p>{t('time.minutes_ago', { count: 5 })}</p>
 * 
 * // Change language
 * <button onClick={() => setLanguage('es')}>Español</button>
 */
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

/**
 * Hook to get just the translation function (lighter weight)
 */
export function useTranslate() {
  const { t } = useI18n();
  return t;
}

export default I18nProvider;
