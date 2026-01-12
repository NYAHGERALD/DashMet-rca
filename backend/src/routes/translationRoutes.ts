// Translation API Routes
// Provides endpoints for real-time UI translation

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  translateText,
  translateBatch,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  clearTranslationCache,
  getCacheStats,
} from '../services/translationService';

const router = Router();

/**
 * GET /api/translation/languages
 * Get list of supported languages
 */
router.get('/languages', async (_req: Request, res: Response) => {
  try {
    const languages = Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
      code,
      name,
    }));

    res.json({
      success: true,
      data: languages,
    });
  } catch (error) {
    console.error('Error fetching languages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supported languages',
    });
  }
});

/**
 * POST /api/translation/translate
 * Translate a single text string
 */
router.post('/translate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { text, targetLanguage, sourceLanguage = 'en' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    if (!targetLanguage || !(targetLanguage in SUPPORTED_LANGUAGES)) {
      return res.status(400).json({
        success: false,
        error: 'Valid target language is required',
        supportedLanguages: Object.keys(SUPPORTED_LANGUAGES),
      });
    }

    const translation = await translateText(
      text,
      targetLanguage as SupportedLanguage,
      sourceLanguage as SupportedLanguage
    );

    res.json({
      success: true,
      data: {
        original: text,
        translation,
        targetLanguage,
        sourceLanguage,
      },
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      success: false,
      error: 'Translation failed',
    });
  }
});

/**
 * POST /api/translation/batch
 * Translate multiple texts in a batch (more efficient)
 */
router.post('/batch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { texts, targetLanguage, sourceLanguage = 'en' } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Texts array is required',
      });
    }

    if (texts.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 texts per batch',
      });
    }

    if (!targetLanguage || !(targetLanguage in SUPPORTED_LANGUAGES)) {
      return res.status(400).json({
        success: false,
        error: 'Valid target language is required',
        supportedLanguages: Object.keys(SUPPORTED_LANGUAGES),
      });
    }

    const translations = await translateBatch(
      texts,
      targetLanguage as SupportedLanguage,
      sourceLanguage as SupportedLanguage
    );

    res.json({
      success: true,
      data: {
        translations,
        targetLanguage,
        sourceLanguage,
        count: texts.length,
      },
    });
  } catch (error) {
    console.error('Batch translation error:', error);
    res.status(500).json({
      success: false,
      error: 'Batch translation failed',
    });
  }
});

/**
 * GET /api/translation/cache/stats
 * Get translation cache statistics (admin only)
 */
router.get('/cache/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Only allow admins
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    const stats = getCacheStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache stats',
    });
  }
});

/**
 * DELETE /api/translation/cache
 * Clear translation cache (admin only)
 */
router.delete('/cache', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Only allow admins
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    clearTranslationCache();

    res.json({
      success: true,
      message: 'Translation cache cleared',
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
});

export default router;
