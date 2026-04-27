import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

// ── Key generator: use X-Forwarded-For behind proxy, fallback to IP ──
const getClientKey = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.ip
    || 'unknown';
};

const normalizeIdentifier = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase();

const hashIdentifier = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);

const getEmailOrPhoneIdentifier = (req: Request): string => {
  const email = normalizeIdentifier(req.body?.email);
  if (email) return `email:${email}`;

  const phone = normalizeIdentifier(req.body?.phone);
  if (phone) return `phone:${phone}`;

  return 'anonymous';
};

// ── Global API Rate Limiter ──
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 minutes
  max: isProduction ? 200 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') {
      const skipPaths = ['/auth/me', '/health'];
      return skipPaths.some(path => req.path.includes(path));
    }
    return false;
  },
});

// ── Strict Auth Rate Limiter (Login/Register) ──
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 minutes
  max: isProduction ? 10 : 10000,
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

// ── Login Rate Limiter (per-account+IP failures) ──
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 5 : 10000,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = getClientKey(req);
    const subject = getEmailOrPhoneIdentifier(req);
    return `login-subject:${hashIdentifier(subject)}:${ip}`;
  },
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

// ── Login Burst Limiter (per-IP total attempts) ──
export const loginIpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 20 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `login-ip:${getClientKey(req)}`,
  message: {
    success: false,
    error: 'Too many authentication attempts from this network. Please try again later.',
  },
});

// ── User Enumeration Protection (check-user, check-phone, check-email) ──
export const enumerationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,     // 1 hour
  max: isProduction ? 10 : 10000,
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
  max: isProduction ? 5 : 10000,
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
  max: isProduction ? 50 : 10000,
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
  max: isProduction ? 10 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'AI processing limit reached. Please wait a moment.',
  },
});

// ── Forgot Password Rate Limiter (per-account+IP request limit) ──
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProduction ? 3 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = getClientKey(req);
    const email = normalizeIdentifier(req.body?.email) || 'anonymous';
    return `forgot-password:${hashIdentifier(email)}:${ip}`;
  },
  message: {
    success: false,
    error: 'Too many password reset requests. Please try again in 1 hour.',
  },
});

// ── Forgot Password IP Burst Limiter ──
export const forgotPasswordIpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProduction ? 20 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `forgot-password-ip:${getClientKey(req)}`,
  message: {
    success: false,
    error: 'Too many password reset requests from this network. Please try again later.',
  },
});

// ── Reset Password Rate Limiter ──
// Strict limit: reset tokens are single-use and time-limited; this protects
// against token-guessing and brute-force attempts.
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,     // 1 hour
  max: isProduction ? 5 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = getClientKey(req);
    const token = normalizeIdentifier(req.body?.token);
    const tokenFingerprint = token ? hashIdentifier(token) : 'no-token';
    return `reset-password:${tokenFingerprint}:${ip}`;
  },
  message: {
    success: false,
    error: 'Too many password reset attempts. Please try again in 1 hour.',
  },
});

// ── Refresh Token Rate Limiter ──
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 30 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `refresh:${getClientKey(req)}`,
  message: {
    success: false,
    error: 'Too many token refresh attempts. Please try again later.',
  },
});

// ── System Admin Authentication Rate Limiter ──
export const systemAdminAuthRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,     // 1 hour
  max: isProduction ? 20 : 10000,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
  },
});
