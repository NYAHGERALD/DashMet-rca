// Industry-standard i18n (Internationalization) System
// Static translation files - fast, reliable, works offline

import en from './translations/en.json';
import es from './translations/es.json';
import fr from './translations/fr.json';

// All available translations
const translations: Record<string, typeof en> = {
  en,
  es,
  fr,
};

// Supported language codes
export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'zh' | 'ja' | 'ko' | 'ar' | 'hi' | 'ru' | 'nl' | 'pl' | 'tr' | 'vi' | 'th' | 'id' | 'ms' | 'tl';

// Language metadata
export const LANGUAGES: Record<LanguageCode, { name: string; nativeName: string; flag: string; available: boolean }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸', available: true },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', available: true },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷', available: true },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', available: false },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', available: false },
  it: { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', available: false },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳', available: false },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', available: false },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷', available: false },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', available: false },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', available: false },
  ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', available: false },
  nl: { name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', available: false },
  pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', available: false },
  tr: { name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', available: false },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', available: false },
  th: { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', available: false },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', available: false },
  ms: { name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾', available: false },
  tl: { name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭', available: false },
};

// Get available languages only
export const getAvailableLanguages = () => {
  return Object.entries(LANGUAGES)
    .filter(([_, lang]) => lang.available)
    .reduce((acc, [code, lang]) => {
      acc[code as LanguageCode] = lang;
      return acc;
    }, {} as Record<LanguageCode, typeof LANGUAGES[LanguageCode]>);
};

// Type for translation keys (dot notation paths)
type PathsToStringProps<T> = T extends string
  ? []
  : {
      [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>];
    }[Extract<keyof T, string>];

type Join<T extends string[], D extends string> = T extends []
  ? never
  : T extends [infer F]
  ? F
  : T extends [infer F, ...infer R]
  ? F extends string
    ? `${F}${D}${Join<Extract<R, string[]>, D>}`
    : never
  : string;

export type TranslationKey = Join<PathsToStringProps<typeof en>, '.'>;

/**
 * Get a translation value by key path
 * @param key - Dot notation path like "settings.title" or "common.save"
 * @param lang - Language code
 * @param params - Optional parameters for interpolation
 */
export function getTranslation(
  key: string,
  lang: LanguageCode = 'en',
  params?: Record<string, string | number>
): string {
  const translation = translations[lang] || translations.en;
  
  // Navigate through nested object using dot notation
  const keys = key.split('.');
  let value: unknown = translation;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      // Fallback to English if key not found
      value = getFromEnglish(keys);
      break;
    }
  }
  
  if (typeof value !== 'string') {
    // Return the key if translation not found
    console.warn(`Translation not found: ${key}`);
    return key;
  }
  
  // Handle parameter interpolation like {count} or {name}
  if (params) {
    return interpolate(value, params);
  }
  
  return value;
}

// Get value from English translations as fallback
function getFromEnglish(keys: string[]): unknown {
  let value: unknown = translations.en;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return value;
}

// Interpolate parameters into translation string
function interpolate(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key]?.toString() ?? `{${key}}`;
  });
}

/**
 * Create a translator function for a specific language
 */
export function createTranslator(lang: LanguageCode) {
  return (key: string, params?: Record<string, string | number>) => 
    getTranslation(key, lang, params);
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(lang: string): lang is LanguageCode {
  return lang in LANGUAGES;
}

/**
 * Check if a language has translations available
 */
export function isLanguageAvailable(lang: string): boolean {
  return lang in translations;
}

// Export translations for direct access if needed
export { translations };

// Default export
export default {
  getTranslation,
  createTranslator,
  isLanguageSupported,
  isLanguageAvailable,
  getAvailableLanguages,
  LANGUAGES,
};
