import { Router, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';

const router = Router();

// Valid language codes mapped to database enum values
const LANGUAGE_MAP: Record<string, string> = {
  en: 'ENGLISH',
  es: 'SPANISH',
  fr: 'FRENCH',
  de: 'GERMAN',
  pt: 'PORTUGUESE',
  it: 'ITALIAN',
  zh: 'CHINESE',
  ja: 'JAPANESE',
  ko: 'KOREAN',
  ar: 'ARABIC',
  hi: 'HINDI',
  ru: 'RUSSIAN',
  nl: 'DUTCH',
  pl: 'POLISH',
  tr: 'TURKISH',
  vi: 'VIETNAMESE',
  th: 'THAI',
  id: 'INDONESIAN',
  ms: 'MALAY',
  tl: 'FILIPINO',
};

const VALID_LANGUAGES = Object.values(LANGUAGE_MAP);

// GET /api/preferences - Get current user's preferences
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        theme: true,
        language: true,
        defaultSiteId: true,
        defaultLineId: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  })
);

// PATCH /api/preferences - Update current user's preferences
router.patch(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { theme, language, defaultSiteId, defaultLineId } = req.body;

    // Validate theme if provided
    if (theme && !['LIGHT', 'DARK', 'SYSTEM'].includes(theme)) {
      throw new ValidationError('Invalid theme value');
    }

    // Validate language if provided
    // Accept both short codes (en, es, fr) and full names (ENGLISH, SPANISH, FRENCH)
    let languageValue = language;
    if (language) {
      // Check if it's a short code and convert to enum value
      if (LANGUAGE_MAP[language.toLowerCase()]) {
        languageValue = LANGUAGE_MAP[language.toLowerCase()];
      }
      // Validate the final value
      if (!VALID_LANGUAGES.includes(languageValue.toUpperCase())) {
        throw new ValidationError('Invalid language value');
      }
      languageValue = languageValue.toUpperCase();
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(theme && { theme }),
        ...(languageValue && { language: languageValue }),
        ...(defaultSiteId !== undefined && { defaultSiteId }),
        ...(defaultLineId !== undefined && { defaultLineId }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        theme: true,
        language: true,
        defaultSiteId: true,
        defaultLineId: true,
      },
    });

    res.json({
      success: true,
      data: user,
      message: 'Preferences updated successfully',
    });
  })
);

export default router;
