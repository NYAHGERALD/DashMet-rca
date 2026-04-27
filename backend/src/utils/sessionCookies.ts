import crypto from 'crypto';
import { Request, Response } from 'express';

export const ACCESS_COOKIE_NAME = 'dashmet_access';
export const REFRESH_COOKIE_NAME = 'dashmet_refresh';
export const CSRF_COOKIE_NAME = 'dashmet_csrf';

const ACCESS_COOKIE_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateCsrfToken = (): string => crypto.randomBytes(32).toString('hex');

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
  }
): string => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const httpOnly = options?.httpOnly === false ? '' : 'HttpOnly';
  const sameSite = options?.sameSite || 'Lax';

  return [
    `${name}=${encodeURIComponent(value)}`,
    httpOnly,
    'Path=/',
    `SameSite=${sameSite}`,
    `Max-Age=${maxAgeSeconds}`,
    secure.replace(/^; /, ''),
  ]
    .filter(Boolean)
    .join('; ');
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  const csrfToken = generateCsrfToken();
  res.setHeader('Set-Cookie', [
    buildCookie(ACCESS_COOKIE_NAME, accessToken, ACCESS_COOKIE_MAX_AGE_SECONDS),
    buildCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_MAX_AGE_SECONDS),
    buildCookie(CSRF_COOKIE_NAME, csrfToken, REFRESH_COOKIE_MAX_AGE_SECONDS, {
      httpOnly: false,
      sameSite: 'Lax',
    }),
  ]);
};

export const clearAuthCookies = (res: Response) => {
  res.setHeader('Set-Cookie', [
    buildCookie(ACCESS_COOKIE_NAME, '', 0),
    buildCookie(REFRESH_COOKIE_NAME, '', 0),
    buildCookie(CSRF_COOKIE_NAME, '', 0, {
      httpOnly: false,
      sameSite: 'Lax',
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
