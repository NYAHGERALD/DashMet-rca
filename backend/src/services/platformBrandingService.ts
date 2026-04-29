import { adminStorage } from '../config/firebase-admin';

export interface PlatformBrandingConfig {
  loginBackgroundUrl: string | null;
  emailLogoUrl: string | null;
  updatedAt: string | null;
  updatedById: string | null;
}

export const FALLBACK_LOGIN_BACKGROUND_URL = '/images/landing-page-image.jpg';
export const FALLBACK_EMAIL_LOGO_URL = '/images/logo.png';

const BRANDING_CONFIG_STORAGE_PATH = 'platform-branding/config/branding.json';
const EMPTY_BRANDING_CONFIG: PlatformBrandingConfig = {
  loginBackgroundUrl: null,
  emailLogoUrl: null,
  updatedAt: null,
  updatedById: null,
};

const sanitizeOptionalUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeConfig = (raw: any): PlatformBrandingConfig => ({
  loginBackgroundUrl: sanitizeOptionalUrl(raw?.loginBackgroundUrl),
  emailLogoUrl: sanitizeOptionalUrl(raw?.emailLogoUrl),
  updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : null,
  updatedById: typeof raw?.updatedById === 'string' ? raw.updatedById : null,
});

const getConfigFile = () => adminStorage.bucket().file(BRANDING_CONFIG_STORAGE_PATH);

export async function readPlatformBrandingConfig(): Promise<PlatformBrandingConfig> {
  try {
    const configFile = getConfigFile();
    const [exists] = await configFile.exists();
    if (!exists) return { ...EMPTY_BRANDING_CONFIG };

    const [buffer] = await configFile.download();
    const parsed = JSON.parse(buffer.toString('utf-8'));
    return normalizeConfig(parsed);
  } catch {
    return { ...EMPTY_BRANDING_CONFIG };
  }
}

export async function writePlatformBrandingConfig(
  values: Pick<PlatformBrandingConfig, 'loginBackgroundUrl' | 'emailLogoUrl'> & { updatedById?: string | null }
): Promise<PlatformBrandingConfig> {
  const payload: PlatformBrandingConfig = {
    loginBackgroundUrl: sanitizeOptionalUrl(values.loginBackgroundUrl),
    emailLogoUrl: sanitizeOptionalUrl(values.emailLogoUrl),
    updatedAt: new Date().toISOString(),
    updatedById: values.updatedById || null,
  };

  const configFile = getConfigFile();
  await configFile.save(JSON.stringify(payload, null, 2), {
    resumable: false,
    contentType: 'application/json',
    metadata: {
      cacheControl: 'no-store',
    },
  });

  return payload;
}
