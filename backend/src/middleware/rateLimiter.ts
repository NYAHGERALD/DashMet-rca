import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import crypto from 'crypto';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, getCookie } from '../utils/sessionCookies';

const isProduction = process.env.NODE_ENV === 'production';
const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const GLOBAL_RATE_LIMIT_WINDOW_MS = parsePositiveInt(
  process.env.API_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const GLOBAL_RATE_LIMIT_MAX = parsePositiveInt(
  process.env.API_RATE_LIMIT_MAX,
  isProduction ? 1200 : 10000
);
const LOGIN_IP_RATE_LIMIT_WINDOW_MS = parsePositiveInt(
  process.env.LOGIN_IP_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const LOGIN_IP_RATE_LIMIT_MAX = parsePositiveInt(
  process.env.LOGIN_IP_RATE_LIMIT_MAX,
  isProduction ? 200 : 10000
);
const REFRESH_RATE_LIMIT_WINDOW_MS = parsePositiveInt(
  process.env.REFRESH_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const REFRESH_RATE_LIMIT_MAX = parsePositiveInt(
  process.env.REFRESH_RATE_LIMIT_MAX,
  isProduction ? 120 : 10000
);

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

const getSessionRateLimitKey = (req: Request): string | null => {
  const accessToken = getCookie(req, ACCESS_COOKIE_NAME);
  if (accessToken) {
    return `session:${hashIdentifier(accessToken)}`;
  }

  const refreshToken = getCookie(req, REFRESH_COOKIE_NAME);
  if (refreshToken) {
    return `refresh:${hashIdentifier(refreshToken)}`;
  }

  return null;
};

const getRefreshRateLimitKey = (req: Request): string => {
  const refreshToken = getCookie(req, REFRESH_COOKIE_NAME);
  if (refreshToken) {
    return `refresh-token:${hashIdentifier(refreshToken)}`;
  }

  return `refresh-ip:${getClientKey(req)}`;
};

const isGlobalRateLimitExempt = (req: Request): boolean => {
  const path = String(req.path || req.originalUrl || req.url || '').toLowerCase();

  // Health checks should always pass.
  if (path === '/health' || path === '/api/health') {
    return true;
  }

  // Auth session lifecycle routes have dedicated, stricter limiters.
  if (path.startsWith('/auth/me') || path.startsWith('/auth/refresh') || path.startsWith('/auth/logout')) {
    return true;
  }

  return false;
};

const getEmailOrPhoneIdentifier = (req: Request): string => {
  const email = normalizeIdentifier(req.body?.email);
  if (email) return `email:${email}`;

  const phone = normalizeIdentifier(req.body?.phone);
  if (phone) return `phone:${phone}`;

  return 'anonymous';
};

// ── Global API Rate Limiter ──
export const rateLimiter = rateLimit({
  windowMs: GLOBAL_RATE_LIMIT_WINDOW_MS,
  max: GLOBAL_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getSessionRateLimitKey(req) || `ip:${getClientKey(req)}`,
  skipFailedRequests: true,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  skip: isGlobalRateLimitExempt,
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
  windowMs: LOGIN_IP_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_IP_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
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
  windowMs: REFRESH_RATE_LIMIT_WINDOW_MS,
  max: REFRESH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRefreshRateLimitKey,
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
