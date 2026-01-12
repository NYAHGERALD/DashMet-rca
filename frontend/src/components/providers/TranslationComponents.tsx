// Translation Utilities and Components
// Provides easy-to-use components for translating UI text

'use client';

import React, { useEffect, useState, memo } from 'react';
import { useTranslation, LanguageCode, LANGUAGES } from './TranslationProvider';

// ============ Translatable Text Component ============
interface TProps {
  children: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  fallback?: React.ReactNode;
  [key: string]: any;
}

/**
 * Translatable text component
 * Wraps text and automatically translates based on current language
 * 
 * @example
 * <T>Hello, World!</T>
 * <T as="h1" className="text-2xl">Welcome</T>
 */
export const T = memo(function T({ 
  children, 
  as: Component = 'span', 
  className,
  fallback,
  ...props 
}: TProps) {
  const { translate, isTranslating, language } = useTranslation();
  const [translatedText, setTranslatedText] = useState(children);

  useEffect(() => {
    setTranslatedText(translate(children));
  }, [children, translate, language]);

  // Show fallback while translating if provided
  if (isTranslating && fallback) {
    return <>{fallback}</>;
  }

  return (
    <Component className={className} {...props}>
      {translatedText}
    </Component>
  );
});

// ============ Async Translatable Text Component ============
interface TAsyncProps extends TProps {
  loadingText?: string;
}

/**
 * Async translatable text component
 * Fetches translation and updates when ready
 */
export const TAsync = memo(function TAsync({
  children,
  as: Component = 'span',
  className,
  loadingText,
  ...props
}: TAsyncProps) {
  const { translateAsync, language, isEnabled } = useTranslation();
  const [translatedText, setTranslatedText] = useState(children);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (language === 'en' || !isEnabled) {
      setTranslatedText(children);
      return;
    }

    setLoading(true);
    translateAsync(children)
      .then(setTranslatedText)
      .finally(() => setLoading(false));
  }, [children, translateAsync, language, isEnabled]);

  return (
    <Component className={className} {...props}>
      {loading && loadingText ? loadingText : translatedText}
    </Component>
  );
});

// ============ Language Selector Component ============
interface LanguageSelectorProps {
  className?: string;
  showFlags?: boolean;
  showNativeName?: boolean;
  compact?: boolean;
  onChange?: (lang: LanguageCode) => void;
}

/**
 * Language selector dropdown component
 */
export function LanguageSelector({
  className = '',
  showFlags = true,
  showNativeName = false,
  compact = false,
  onChange,
}: LanguageSelectorProps) {
  const { language, setLanguage, availableLanguages, isEnabled } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = async (lang: LanguageCode) => {
    await setLanguage(lang);
    setIsOpen(false);
    onChange?.(lang);
  };

  const currentLang = availableLanguages[language];

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
          bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
          ${compact ? 'px-2 py-1' : ''}`}
        disabled={!isEnabled}
      >
        {showFlags && <span className="text-lg">{currentLang.flag}</span>}
        {!compact && (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {showNativeName ? currentLang.nativeName : currentLang.name}
          </span>
        )}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto rounded-lg shadow-lg 
            bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-50">
            <div className="py-1">
              {(Object.entries(availableLanguages) as [LanguageCode, typeof currentLang][]).map(
                ([code, lang]) => (
                  <button
                    key={code}
                    onClick={() => handleSelect(code)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left
                      hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                      ${language === code ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    {showFlags && <span className="text-lg">{lang.flag}</span>}
                    <div className="flex-1">
                      <div className="font-medium">{lang.name}</div>
                      {showNativeName && lang.name !== lang.nativeName && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{lang.nativeName}</div>
                      )}
                    </div>
                    {language === code && (
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============ Translation Toggle Component ============
interface TranslationToggleProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Toggle to enable/disable real-time translation
 */
export function TranslationToggle({ className = '', showLabel = true }: TranslationToggleProps) {
  const { isEnabled, setEnabled, language } = useTranslation();

  // Don't show toggle if language is English
  if (language === 'en') {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className="text-sm text-gray-600 dark:text-gray-400">Auto-translate</span>
      )}
      <button
        onClick={() => setEnabled(!isEnabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${isEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        role="switch"
        aria-checked={isEnabled}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}

// ============ HOC for translating component props ============
interface WithTranslationProps {
  t: (text: string) => string;
}

/**
 * Higher-order component that injects translation function
 * 
 * @example
 * const MyComponent = withTranslation(({ t, ...props }) => (
 *   <div>
 *     <h1>{t('Welcome')}</h1>
 *     <p>{t('Hello, World!')}</p>
 *   </div>
 * ));
 */
export function withTranslation<P extends object>(
  Component: React.ComponentType<P & WithTranslationProps>
): React.FC<Omit<P, keyof WithTranslationProps>> {
  return function WithTranslationWrapper(props: Omit<P, keyof WithTranslationProps>) {
    const { translate } = useTranslation();
    return <Component {...(props as P)} t={translate} />;
  };
}

// ============ Translation Status Indicator ============
interface TranslationStatusProps {
  className?: string;
}

/**
 * Shows translation status indicator
 */
export function TranslationStatus({ className = '' }: TranslationStatusProps) {
  const { isTranslating, language, isEnabled } = useTranslation();
  const currentLang = LANGUAGES[language];

  if (language === 'en') {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-lg">{currentLang.flag}</span>
      <span className="text-gray-600 dark:text-gray-400">{currentLang.name}</span>
      {isTranslating && isEnabled && (
        <span className="flex items-center gap-1 text-blue-500">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Translating...
        </span>
      )}
    </div>
  );
}
