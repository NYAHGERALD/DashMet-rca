import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// ── Key generator: use X-Forwarded-For behind proxy, fallback to IP ──
const getClientKey = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.ip
    || 'unknown';
};

// ── Global API Rate Limiter ──
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') {
      const skipPaths = ['/firebase-auth/me', '/health'];
      return skipPaths.some(path => req.path.includes(path));
    }
    return false;
  },
});

// ── Strict Auth Rate Limiter (Login/Register) ──
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 10000,
  skipSuccessfulRequests: true,  // Only count failures
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const identifier = req.body?.email || req.body?.phone || '';
    const ip = getClientKey(req);
    return `${identifier}:${ip}`;
  },
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

// ── User Enumeration Protection (check-user, check-phone, check-email) ──
export const enumerationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,     // 1 hour
  max: process.env.NODE_ENV === 'production' ? 10 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
});

// ── OTP / Access Code Rate Limiter ──
export const otpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,     // 1 hour
  max: process.env.NODE_ENV === 'production' ? 5 : 10000,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'Too many verification attempts. Please try again in 1 hour.',
  },
});

// ── File Upload Rate Limiter ──
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,     // 1 hour
  max: process.env.NODE_ENV === 'production' ? 50 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'Upload limit reached. Please try again later.',
  },
});

// ── AI/OpenAI Endpoint Rate Limiter ──
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute
  max: process.env.NODE_ENV === 'production' ? 10 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'AI processing limit reached. Please wait a moment.',
  },
});

// ── Password Reset Rate Limiter (server-reset-password) ──
// Strict limit: 3 attempts per hour per IP. oobCodes are single-use and time-limited,
// but rate limiting prevents brute-force attempts against the endpoint.
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,     // 1 hour
  max: process.env.NODE_ENV === 'production' ? 3 : 10000,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'Too many password reset attempts. Please try again in 1 hour.',
  },
});

// ── System Admin Master Key Rate Limiter ──
export const masterKeyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,     // 1 hour
  max: process.env.NODE_ENV === 'production' ? 3 : 10000,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'Access denied. Too many attempts.',
  },
});
