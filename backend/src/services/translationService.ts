// Real-time Translation Service
// Uses OpenAI GPT-4 for dynamic UI text translation

import OpenAI from 'openai';

// Lazy initialization of OpenAI client
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Supported languages with their full names
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  ru: 'Russian',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Filipino/Tagalog',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// In-memory cache for translations (per-session, expires after 1 hour)
interface CacheEntry {
  translation: string;
  timestamp: number;
}

const translationCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Generate cache key
function getCacheKey(text: string, targetLang: string): string {
  return `${targetLang}:${text}`;
}

// Clean expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of translationCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      translationCache.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

/**
 * Translate a single text string
 */
export async function translateText(
  text: string,
  targetLanguage: SupportedLanguage,
  sourceLanguage: SupportedLanguage = 'en'
): Promise<string> {
  // Don't translate if source and target are the same
  if (targetLanguage === sourceLanguage) {
    return text;
  }

  // Don't translate empty strings
  if (!text || text.trim() === '') {
    return text;
  }

  // Check cache first
  const cacheKey = getCacheKey(text, targetLanguage);
  const cached = translationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.translation;
  }

  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('Translation unavailable: No OpenAI API key configured');
    return text; // Graceful fallback to original text
  }

  try {
    const targetLangName = SUPPORTED_LANGUAGES[targetLanguage];
    const sourceLangName = SUPPORTED_LANGUAGES[sourceLanguage];

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: `You are a professional UI translator. Translate the following text from ${sourceLangName} to ${targetLangName}. 
          
Rules:
- Keep the translation natural and contextually appropriate for a software UI
- Preserve any technical terms, brand names, or proper nouns
- Maintain the same tone and formality level
- Preserve any special characters, numbers, or formatting
- If the text contains placeholders like {name} or {{count}}, keep them unchanged
- Return ONLY the translated text, nothing else
- If the text is already in the target language or cannot be translated, return it unchanged`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3, // Lower temperature for consistent translations
      max_completion_tokens: 500,
    });

    const translation = completion.choices[0]?.message?.content?.trim() || text;

    // Cache the result
    translationCache.set(cacheKey, {
      translation,
      timestamp: Date.now(),
    });

    return translation;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Graceful fallback
  }
}

/**
 * Translate multiple texts in batch (more efficient)
 */
export async function translateBatch(
  texts: string[],
  targetLanguage: SupportedLanguage,
  sourceLanguage: SupportedLanguage = 'en'
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Don't translate if source and target are the same
  if (targetLanguage === sourceLanguage) {
    texts.forEach((text) => {
      results[text] = text;
    });
    return results;
  }

  // Filter out empty strings and check cache
  const toTranslate: string[] = [];
  texts.forEach((text) => {
    if (!text || text.trim() === '') {
      results[text] = text;
      return;
    }

    const cacheKey = getCacheKey(text, targetLanguage);
    const cached = translationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results[text] = cached.translation;
    } else {
      toTranslate.push(text);
    }
  });

  // If all translations were cached, return early
  if (toTranslate.length === 0) {
    return results;
  }

  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('Translation unavailable: No OpenAI API key configured');
    toTranslate.forEach((text) => {
      results[text] = text;
    });
    return results;
  }

  try {
    const targetLangName = SUPPORTED_LANGUAGES[targetLanguage];
    const sourceLangName = SUPPORTED_LANGUAGES[sourceLanguage];

    // Format texts for batch translation
    const numberedTexts = toTranslate
      .map((text, index) => `[${index + 1}] ${text}`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: `You are a professional UI translator. Translate the following numbered texts from ${sourceLangName} to ${targetLangName}.

Rules:
- Keep translations natural and contextually appropriate for a software UI
- Preserve any technical terms, brand names, or proper nouns
- Maintain the same tone and formality level
- Preserve any special characters, numbers, or formatting
- If texts contain placeholders like {name} or {{count}}, keep them unchanged
- Return ONLY the translations in the same numbered format
- Each translation should be on its own line, starting with [number]`,
        },
        {
          role: 'user',
          content: numberedTexts,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content?.trim() || '';

    // Parse the numbered response
    const lines = response.split('\n');
    lines.forEach((line) => {
      const match = line.match(/^\[(\d+)\]\s*(.+)$/);
      if (match) {
        const index = parseInt(match[1], 10) - 1;
        const translation = match[2].trim();
        if (index >= 0 && index < toTranslate.length) {
          const originalText = toTranslate[index];
          results[originalText] = translation;

          // Cache the result
          const cacheKey = getCacheKey(originalText, targetLanguage);
          translationCache.set(cacheKey, {
            translation,
            timestamp: Date.now(),
          });
        }
      }
    });

    // Fill in any missing translations with original text
    toTranslate.forEach((text) => {
      if (!results[text]) {
        results[text] = text;
      }
    });

    return results;
  } catch (error) {
    console.error('Batch translation error:', error);
    // Fallback to original texts
    toTranslate.forEach((text) => {
      results[text] = text;
    });
    return results;
  }
}

/**
 * Clear translation cache (useful for testing or forced refresh)
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; hitRate?: number } {
  return {
    size: translationCache.size,
  };
}
