import api from './api';

export interface PlatformBranding {
  loginBackgroundUrl: string | null;
  emailLogoUrl: string | null;
  fallbackLoginBackgroundUrl: string;
  fallbackEmailLogoUrl: string;
  updatedAt: string | null;
}

const DEFAULT_BRANDING: PlatformBranding = {
  loginBackgroundUrl: null,
  emailLogoUrl: null,
  fallbackLoginBackgroundUrl: '/images/landing-page-image.jpg',
  fallbackEmailLogoUrl: '/images/logo.png',
  updatedAt: null,
};

const BRANDING_CACHE_TTL_MS = 2 * 60 * 1000;

let cachedBranding: PlatformBranding | null = null;
let cacheExpiresAt = 0;
let inflightRequest: Promise<PlatformBranding> | null = null;

const normalizeBranding = (raw: any): PlatformBranding => ({
  loginBackgroundUrl: typeof raw?.loginBackgroundUrl === 'string' ? raw.loginBackgroundUrl : null,
  emailLogoUrl: typeof raw?.emailLogoUrl === 'string' ? raw.emailLogoUrl : null,
  fallbackLoginBackgroundUrl:
    typeof raw?.fallbackLoginBackgroundUrl === 'string' && raw.fallbackLoginBackgroundUrl.trim()
      ? raw.fallbackLoginBackgroundUrl
      : DEFAULT_BRANDING.fallbackLoginBackgroundUrl,
  fallbackEmailLogoUrl:
    typeof raw?.fallbackEmailLogoUrl === 'string' && raw.fallbackEmailLogoUrl.trim()
      ? raw.fallbackEmailLogoUrl
      : DEFAULT_BRANDING.fallbackEmailLogoUrl,
  updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : null,
});

export const getLoginBackgroundUrl = (branding?: Partial<PlatformBranding> | null): string =>
  branding?.loginBackgroundUrl || branding?.fallbackLoginBackgroundUrl || DEFAULT_BRANDING.fallbackLoginBackgroundUrl;

export const getEmailLogoUrl = (branding?: Partial<PlatformBranding> | null): string =>
  branding?.emailLogoUrl || branding?.fallbackEmailLogoUrl || DEFAULT_BRANDING.fallbackEmailLogoUrl;

export const clearPlatformBrandingCache = (): void => {
  cachedBranding = null;
  cacheExpiresAt = 0;
  inflightRequest = null;
};

export async function fetchPublicPlatformBranding(forceRefresh = false): Promise<PlatformBranding> {
  const now = Date.now();
  if (!forceRefresh && cachedBranding && now < cacheExpiresAt) {
    return cachedBranding;
  }

  if (!forceRefresh && inflightRequest) {
    return inflightRequest;
  }

  inflightRequest = api
    .get('/system-admin/branding/public', { timeout: 10000 })
    .then((response) => {
      const normalized = normalizeBranding(response.data?.data);
      cachedBranding = normalized;
      cacheExpiresAt = Date.now() + BRANDING_CACHE_TTL_MS;
      return normalized;
    })
    .catch((error) => {
      console.warn('Failed to fetch public branding settings. Falling back to bundled assets.', error);
      cachedBranding = DEFAULT_BRANDING;
      cacheExpiresAt = Date.now() + 30 * 1000;
      return DEFAULT_BRANDING;
    })
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
}
