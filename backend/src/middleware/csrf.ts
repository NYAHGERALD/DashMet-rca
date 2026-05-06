import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from './errorHandler';
import { CSRF_COOKIE_NAME, getCookie } from '../utils/sessionCookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const normalizeHeaderValue = (value: string | string[] | undefined): string => {
  if (!value) return '';
  return Array.isArray(value) ? value[0] || '' : value;
};

const isNativeMobileRequest = (req: Request): boolean =>
  normalizeHeaderValue(req.headers['x-dashmet-mobile-app']).toLowerCase() === 'rca-mobile';

const hasNativeMobileCredential = (req: Request): boolean =>
  normalizeHeaderValue(req.headers.authorization).startsWith('Bearer ') ||
  typeof req.body?.refreshToken === 'string';

const constantTimeEquals = (a: string, b: string): boolean => {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

export const requireCsrf = (req: Request, _res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  // Native mobile clients authenticate with bearer/refresh tokens stored in the
  // device secure enclave/keystore rather than browser cookies. CSRF protects
  // cookie-backed browser sessions, so it is not required for this credential
  // mode and would make token refresh unreliable in React Native.
  if (isNativeMobileRequest(req) && hasNativeMobileCredential(req)) {
    return next();
  }

  const csrfCookieToken = getCookie(req, CSRF_COOKIE_NAME);
  const csrfHeaderToken = normalizeHeaderValue(req.headers['x-csrf-token']);

  if (!csrfCookieToken || !csrfHeaderToken || !constantTimeEquals(csrfCookieToken, csrfHeaderToken)) {
    return next(new ForbiddenError('Invalid CSRF token'));
  }

  return next();
};

/**
 * Lightweight CSRF guard for public auth endpoints (login/reset/auth bootstrap).
 *
 * Why: public form posts can bypass CORS and do not include custom headers.
 * Requiring X-Requested-With blocks cross-site HTML form submissions while
 * preserving first-party SPA/API calls that already set this header.
 */
export const requireAjaxRequest = (req: Request, _res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  const requestedWith = normalizeHeaderValue(req.headers['x-requested-with']).toLowerCase();
  if (requestedWith !== 'xmlhttprequest') {
    return next(new ForbiddenError('Invalid request source'));
  }

  return next();
};
