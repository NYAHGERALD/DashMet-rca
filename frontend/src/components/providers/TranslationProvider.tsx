// Real-time Dynamic Translation Provider
// Provides enterprise-grade, real-time translation for all UI text

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import api from '@/lib/api';

// Supported language codes
export type LanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'hi'
  | 'ru'
  | 'nl'
  | 'pl'
  | 'tr'
  | 'vi'
  | 'th'
  | 'id'
  | 'ms'
  | 'tl';

// Language metadata
export const LANGUAGES: Record<LanguageCode, { name: string; nativeName: string; flag: string }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  it: { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  nl: { name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  tr: { name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  th: { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  ms: { name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  tl: { name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
};

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

interface TranslationContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  translate: (text: string) => string;
  translateAsync: (text: string) => Promise<string>;
  translateBatch: (texts: string[]) => Promise<Record<string, string>>;
  isTranslating: boolean;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  availableLanguages: typeof LANGUAGES;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

// Local cache for translations (persists across renders)
const translationCache = new Map<string, string>();
const pendingTranslations = new Map<string, Promise<string>>();

// Batch queue for efficient translation requests
let batchQueue: string[] = [];
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_DELAY = 100; // ms to wait before sending batch
const MAX_BATCH_SIZE = 50;

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [isEnabled, setEnabled] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [, forceUpdate] = useState({});
  const mountedRef = useRef(true);

  // Load language from localStorage and user preferences on mount
  useEffect(() => {
    const loadLanguage = async () => {
      // First check localStorage for session preference
      const storedLang = localStorage.getItem('userLanguage') as LanguageCode | null;
      const storedEnabled = localStorage.getItem('translationEnabled');

      if (storedLang && storedLang in LANGUAGES) {
        setLanguageState(storedLang);
      }

      if (storedEnabled !== null) {
        setEnabled(storedEnabled === 'true');
      }

      try {
        const response = await api.get('/preferences');
        if (response.data?.data?.language) {
          const dbLang = response.data.data.language;
          const langCode = DB_TO_CODE[dbLang] || 'en';
          setLanguageState(langCode);
          localStorage.setItem('userLanguage', langCode);
        }
      } catch (error) {
        // User might not be logged in or may not have preferences set.
      }
    };

    loadLanguage();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Set language and persist
  const setLanguage = useCallback(async (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('userLanguage', lang);

    // Clear translation cache when language changes
    translationCache.clear();
    pendingTranslations.clear();

    // Force re-render to update translations
    forceUpdate({});

    try {
      await api.patch('/preferences', { language: lang });
    } catch (error) {
      // Failed to save to server, localStorage is still updated
      console.debug('Could not save language preference to server');
    }
  }, []);

  // Get cache key
  const getCacheKey = useCallback(
    (text: string): string => {
      return `${language}:${text}`;
    },
    [language]
  );

  // Process batch translations
  const processBatch = useCallback(async () => {
    if (batchQueue.length === 0) return;

    const textsToTranslate = [...batchQueue];
    batchQueue = [];
    batchTimeout = null;

    // Filter out already cached items
    const uncached = textsToTranslate.filter((text) => {
      const key = `${language}:${text}`;
      return !translationCache.has(key);
    });

    if (uncached.length === 0) {
      forceUpdate({});
      return;
    }

    setIsTranslating(true);

    try {
      const response = await api.post('/translation/batch', {
        texts: uncached,
        targetLanguage: language,
        sourceLanguage: 'en',
      });

      if (response.data?.success && response.data?.data?.translations) {
        const translations = response.data.data.translations;
        Object.entries(translations).forEach(([original, translated]) => {
          const key = `${language}:${original}`;
          translationCache.set(key, translated as string);
        });
      }
    } catch (error) {
      console.error('Batch translation failed:', error);
      // Cache original text as fallback
      uncached.forEach((text) => {
        const key = `${language}:${text}`;
        translationCache.set(key, text);
      });
    } finally {
      if (mountedRef.current) {
        setIsTranslating(false);
        forceUpdate({});
      }
    }
  }, [language]);

  // Queue text for batch translation
  const queueForTranslation = useCallback(
    (text: string) => {
      if (!text || language === 'en' || !isEnabled) return;

      const key = getCacheKey(text);
      if (translationCache.has(key)) return;

      if (!batchQueue.includes(text)) {
        batchQueue.push(text);
      }

      if (batchQueue.length >= MAX_BATCH_SIZE) {
        if (batchTimeout) clearTimeout(batchTimeout);
        processBatch();
      } else if (!batchTimeout) {
        batchTimeout = setTimeout(processBatch, BATCH_DELAY);
      }
    },
    [language, isEnabled, getCacheKey, processBatch]
  );

  // Synchronous translate - returns cached value or original
  const translate = useCallback(
    (text: string): string => {
      if (!text || language === 'en' || !isEnabled) {
        return text;
      }

      const key = getCacheKey(text);
      const cached = translationCache.get(key);

      if (cached) {
        return cached;
      }

      // Queue for translation and return original for now
      queueForTranslation(text);
      return text;
    },
    [language, isEnabled, getCacheKey, queueForTranslation]
  );

  // Async translate - returns translated value
  const translateAsync = useCallback(
    async (text: string): Promise<string> => {
      if (!text || language === 'en' || !isEnabled) {
        return text;
      }

      const key = getCacheKey(text);
      const cached = translationCache.get(key);

      if (cached) {
        return cached;
      }

      // Check if already pending
      const pending = pendingTranslations.get(key);
      if (pending) {
        return pending;
      }

      // Create translation promise
      const translationPromise = (async () => {
        try {
          const response = await api.post('/translation/translate', {
            text,
            targetLanguage: language,
            sourceLanguage: 'en',
          });

          const translation = response.data?.data?.translation || text;
          translationCache.set(key, translation);
          pendingTranslations.delete(key);
          return translation;
        } catch (error) {
          console.error('Translation failed:', error);
          translationCache.set(key, text);
          pendingTranslations.delete(key);
          return text;
        }
      })();

      pendingTranslations.set(key, translationPromise);
      return translationPromise;
    },
    [language, isEnabled, getCacheKey]
  );

  // Batch translate multiple texts
  const translateBatch = useCallback(
    async (texts: string[]): Promise<Record<string, string>> => {
      const results: Record<string, string> = {};

      if (language === 'en' || !isEnabled) {
        texts.forEach((text) => {
          results[text] = text;
        });
        return results;
      }

      // Check cache first
      const uncached: string[] = [];
      texts.forEach((text) => {
        const key = getCacheKey(text);
        const cached = translationCache.get(key);
        if (cached) {
          results[text] = cached;
        } else {
          uncached.push(text);
        }
      });

      if (uncached.length === 0) {
        return results;
      }

      try {
        const response = await api.post('/translation/batch', {
          texts: uncached,
          targetLanguage: language,
          sourceLanguage: 'en',
        });

        if (response.data?.success && response.data?.data?.translations) {
          const translations = response.data.data.translations;
          Object.entries(translations).forEach(([original, translated]) => {
            const key = getCacheKey(original);
            translationCache.set(key, translated as string);
            results[original] = translated as string;
          });
        }
      } catch (error) {
        console.error('Batch translation failed:', error);
        uncached.forEach((text) => {
          results[text] = text;
        });
      }

      return results;
    },
    [language, isEnabled, getCacheKey]
  );

  // Toggle enabled state
  const handleSetEnabled = useCallback((enabled: boolean) => {
    setEnabled(enabled);
    localStorage.setItem('translationEnabled', String(enabled));
    if (!enabled) {
      // Clear cache when disabling
      translationCache.clear();
      pendingTranslations.clear();
    }
    forceUpdate({});
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      translate,
      translateAsync,
      translateBatch,
      isTranslating,
      isEnabled,
      setEnabled: handleSetEnabled,
      availableLanguages: LANGUAGES,
    }),
    [
      language,
      setLanguage,
      translate,
      translateAsync,
      translateBatch,
      isTranslating,
      isEnabled,
      handleSetEnabled,
    ]
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

// Hook to use translation context
export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}

// Shorthand hook for just the translate function
export function useT() {
  const { translate } = useTranslation();
  return translate;
}
