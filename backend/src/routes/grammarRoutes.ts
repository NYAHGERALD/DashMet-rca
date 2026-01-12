/**
 * Grammar & Writing Assistant API Routes
 * Enterprise-level Grammarly-like functionality
 * 
 * Note: These routes are public to allow grammar checking in all text fields
 * regardless of authentication state. The service doesn't access user-specific data.
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  analyzeGrammar,
  quickFixText,
  enhanceText,
  getSuggestions,
  checkSpelling,
  autoComplete,
} from '../services/grammarService';

const router = Router();

/**
 * POST /api/grammar/analyze
 * Analyze text for grammar, spelling, and style issues
 */
router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    const result = await analyzeGrammar(text, context);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/grammar/quick-fix
 * Automatically fix all spelling and grammar errors
 */
router.post('/quick-fix', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    const result = await quickFixText(text);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/grammar/enhance
 * Enhance text for better clarity and professionalism
 */
router.post('/enhance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, style = 'professional', context } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    const validStyles = ['professional', 'formal', 'concise', 'detailed'];
    if (!validStyles.includes(style)) {
      return res.status(400).json({
        success: false,
        error: `Invalid style. Must be one of: ${validStyles.join(', ')}`,
      });
    }

    const result = await enhanceText(text, style, context);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/grammar/suggestions
 * Get writing suggestions for selected text
 */
router.post('/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, selectedText, suggestionType = 'rephrase' } = req.body;

    if (!text || !selectedText) {
      return res.status(400).json({
        success: false,
        error: 'Text and selectedText are required',
      });
    }

    const validTypes = ['rephrase', 'expand', 'shorten', 'formalize', 'simplify'];
    if (!validTypes.includes(suggestionType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid suggestionType. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const suggestions = await getSuggestions(text, selectedText, suggestionType);

    res.json({
      success: true,
      data: { suggestions },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/grammar/check-spelling
 * Check spelling of a single word
 */
router.post('/check-spelling', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { word } = req.body;

    if (!word) {
      return res.status(400).json({
        success: false,
        error: 'Word is required',
      });
    }

    const result = await checkSpelling(word);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/grammar/auto-complete
 * Get auto-completion suggestions for text
 */
router.post('/auto-complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    const completions = await autoComplete(text, context);

    res.json({
      success: true,
      data: { completions },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
