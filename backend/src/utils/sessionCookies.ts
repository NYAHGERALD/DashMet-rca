import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

export const ACCESS_COOKIE_NAME = 'dashmet_access';
export const REFRESH_COOKIE_NAME = 'dashmet_refresh';
export const CSRF_COOKIE_NAME = 'dashmet_csrf';
export const TRUSTED_DEVICE_COOKIE_NAME = 'dashmet_trusted_device';

const ACCESS_COOKIE_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const TRUSTED_DEVICE_COOKIE_PATH = '/api/auth/login';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

type CookieSameSite = 'Lax' | 'Strict' | 'None';

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateCsrfToken = (): string => crypto.randomBytes(32).toString('hex');

const normalizeSameSite = (value?: string): CookieSameSite | undefined => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'lax') return 'Lax';
  if (normalized === 'strict') return 'Strict';
  if (normalized === 'none') return 'None';
  return undefined;
};

const getSessionCookieSameSite = (): CookieSameSite => {
  const configuredSameSite = normalizeSameSite(process.env.SESSION_COOKIE_SAME_SITE);
  if (configuredSameSite) return configuredSameSite;

  return process.env.NODE_ENV === 'production' ? 'None' : 'Lax';
};

const shouldUseSecureCookies = (sameSite: CookieSameSite): boolean =>
  process.env.NODE_ENV === 'production' || sameSite === 'None';

export const getCookie = (req: Request, name: string): string | undefined => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return undefined;
};

const buildCookie = (
  name: string,
  value: string,
  maxAgeSeconds: number,
  options?: {
    httpOnly?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    path?: string;
  }
): string => {
  const sameSite = options?.sameSite || getSessionCookieSameSite();
  const secure = shouldUseSecureCookies(sameSite) ? 'Secure' : '';
  const httpOnly = options?.httpOnly === false ? '' : 'HttpOnly';
  const path = options?.path || '/';

  return [
    `${name}=${encodeURIComponent(value)}`,
    httpOnly,
    `Path=${path}`,
    `SameSite=${sameSite}`,
    `Max-Age=${maxAgeSeconds}`,
    secure,
  ]
    .filter(Boolean)
    .join('; ');
};

const appendSetCookieHeader = (res: Response, cookies: string[]) => {
  const existing = res.getHeader('Set-Cookie');
  const existingCookies = Array.isArray(existing)
    ? existing.map(String)
    : typeof existing === 'string'
      ? [existing]
      : [];

  res.setHeader('Set-Cookie', [...existingCookies, ...cookies]);
};

export const attachCsrfTokenHeader = (res: Response, csrfToken?: string) => {
  if (csrfToken) {
    res.setHeader(CSRF_HEADER_NAME, csrfToken);
  }
};

export const exposeRequestCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  attachCsrfTokenHeader(res, getCookie(req, CSRF_COOKIE_NAME));
  next();
};

export const setCsrfCookie = (res: Response): string => {
  const csrfToken = generateCsrfToken();
  attachCsrfTokenHeader(res, csrfToken);
  appendSetCookieHeader(res, [
    buildCookie(CSRF_COOKIE_NAME, csrfToken, REFRESH_COOKIE_MAX_AGE_SECONDS, {
      httpOnly: false,
    }),
  ]);
  return csrfToken;
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  const csrfToken = generateCsrfToken();
  attachCsrfTokenHeader(res, csrfToken);
  appendSetCookieHeader(res, [
    buildCookie(ACCESS_COOKIE_NAME, accessToken, ACCESS_COOKIE_MAX_AGE_SECONDS),
    buildCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_MAX_AGE_SECONDS),
    buildCookie(CSRF_COOKIE_NAME, csrfToken, REFRESH_COOKIE_MAX_AGE_SECONDS, {
      httpOnly: false,
    }),
  ]);
};

export const clearAuthCookies = (res: Response) => {
  appendSetCookieHeader(res, [
    buildCookie(ACCESS_COOKIE_NAME, '', 0),
    buildCookie(REFRESH_COOKIE_NAME, '', 0),
    buildCookie(CSRF_COOKIE_NAME, '', 0, {
      httpOnly: false,
    }),
  ]);
};

export const setTrustedDeviceCookie = (
  res: Response,
  value: string,
  maxAgeSeconds: number
) => {
  appendSetCookieHeader(res, [
    buildCookie(TRUSTED_DEVICE_COOKIE_NAME, value, maxAgeSeconds, {
      path: TRUSTED_DEVICE_COOKIE_PATH,
    }),
  ]);
};

export const clearTrustedDeviceCookie = (res: Response) => {
  appendSetCookieHeader(res, [
    buildCookie(TRUSTED_DEVICE_COOKIE_NAME, '', 0, {
      path: TRUSTED_DEVICE_COOKIE_PATH,
    }),
  ]);
};

export const getAccessTokenFromRequest = (req: Request): string | undefined => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length).trim()
    : undefined;

  return getCookie(req, ACCESS_COOKIE_NAME) || bearer;
};

export const getRefreshTokenFromRequest = (req: Request): string | undefined =>
  getCookie(req, REFRESH_COOKIE_NAME) || req.body?.refreshToken;
