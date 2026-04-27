import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5001/api');
const CSRF_COOKIE_NAME = 'dashmet_csrf';
export const SESSION_EXPIRED_EVENT = 'dashmet:session-expired';
let sessionExpiredEventEmitted = false;
let csrfTokenFromHeader: string | null = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 120000,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 30000,
  withCredentials: true,
});

const readCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const captureCsrfToken = (headers: any) => {
  const headerValue = headers?.['x-csrf-token'] || headers?.['X-CSRF-Token'];
  const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof token === 'string' && token.trim()) {
    csrfTokenFromHeader = token;
  }
};

const applyCsrfHeader = (config: InternalAxiosRequestConfig) => {
  const method = String(config.method || 'get').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return config;
  }

  const csrfToken = readCookieValue(CSRF_COOKIE_NAME) || csrfTokenFromHeader;
  if (!csrfToken) {
    return config;
  }

  if (typeof config.headers?.set === 'function') {
    config.headers.set('X-CSRF-Token', csrfToken);
  } else {
    config.headers = {
      ...(config.headers || {}),
      'X-CSRF-Token': csrfToken,
    } as any;
  }
  return config;
};

api.interceptors.request.use(applyCsrfHeader);
refreshClient.interceptors.request.use(applyCsrfHeader);
refreshClient.interceptors.response.use(
  (response) => {
    captureCsrfToken(response.headers);
    return response;
  },
  (error) => {
    captureCsrfToken(error.response?.headers);
    return Promise.reject(error);
  }
);

/**
 * Create an axios instance with a custom timeout for long-running AI operations.
 */
export function createLongRunningRequest(timeoutMs: number = 180000) {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    timeout: timeoutMs,
    withCredentials: true,
  });
}

/**
 * Make an API request with extended timeout for AI-intensive operations.
 */
export async function apiWithExtendedTimeout<T = any>(
  config: AxiosRequestConfig,
  timeoutMs: number = 180000
): Promise<T> {
  const instance = createLongRunningRequest(timeoutMs);
  const response = await instance.request<T>(config);
  return response.data;
}

const isAuthRoute = (url = '') =>
  url.includes('/auth/login') ||
  url.includes('/auth/logout') ||
  url.includes('/auth/refresh') ||
  url.includes('/auth/forgot-password') ||
  url.includes('/auth/reset-password');

const shouldStayOnAuthPage = () => {
  if (typeof window === 'undefined') return true;

  const publicPaths = [
    '/',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/accept-invite',
    '/account-locked',
    '/dashmet-control/login',
  ];

  const { pathname } = window.location;
  return publicPaths.some((path) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  });
};

const emitSessionExpired = () => {
  if (typeof window === 'undefined' || sessionExpiredEventEmitted) return;
  sessionExpiredEventEmitted = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
};

api.interceptors.response.use(
  (response) => {
    captureCsrfToken(response.headers);
    return response;
  },
  async (error) => {
    captureCsrfToken(error.response?.headers);
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRoute(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        await refreshClient.post('/auth/refresh');
        sessionExpiredEventEmitted = false;
        return api(originalRequest);
      } catch {
        if (typeof window !== 'undefined' && !shouldStayOnAuthPage()) {
          emitSessionExpired();
        }
      }
    }

    if (error.response?.status === 429) {
      console.warn('Rate limited, please try again later');
    }

    return Promise.reject(error);
  }
);

export default api;
