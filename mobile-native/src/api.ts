import { mobileConfig } from './config';
import type { DashMetUser, MobileSession, MobileWebHandoff, SessionResponse } from './types';

const MOBILE_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'X-DashMet-Mobile-App': 'rca-mobile',
};

type ApiOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

class MobileApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MobileApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${mobileConfig.apiBaseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...MOBILE_HEADERS,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new MobileApiError(
      payload?.error || payload?.message || 'Unable to complete request',
      response.status
    );
  }

  return payload as T;
}

export async function createFirebaseMobileSession(firebaseIdToken: string): Promise<SessionResponse> {
  return request<SessionResponse>('/mobile/session/firebase', {
    method: 'POST',
    token: firebaseIdToken,
    body: {},
  });
}

export async function startEmailLink(firebaseIdToken: string, email: string): Promise<string> {
  const response = await request<{ success: true; message: string }>('/mobile/session/email-link/start', {
    method: 'POST',
    token: firebaseIdToken,
    body: { email },
  });
  return response.message;
}

export async function verifyEmailLink(
  firebaseIdToken: string,
  email: string,
  code: string
): Promise<MobileSession> {
  const response = await request<{ success: true; data: MobileSession }>(
    '/mobile/session/email-link/verify',
    {
      method: 'POST',
      token: firebaseIdToken,
      body: { email, code },
    }
  );
  return response.data;
}

export async function getCurrentUser(accessToken: string): Promise<DashMetUser> {
  const response = await request<{ success: true; data: { user: DashMetUser } }>('/auth/me', {
    token: accessToken,
  });
  return response.data.user;
}

export async function createWebHandoff(accessToken: string): Promise<MobileWebHandoff> {
  const response = await request<{ success: true; data: MobileWebHandoff }>('/mobile/session/web-handoff', {
    method: 'POST',
    token: accessToken,
    body: {},
  });
  return response.data;
}

export async function logoutMobileSession(session: MobileSession): Promise<void> {
  await request('/auth/logout', {
    method: 'POST',
    token: session.accessToken,
    body: { refreshToken: session.refreshToken },
  });
}

export async function registerMobilePushToken(
  accessToken: string,
  body: {
    token: string;
    provider: 'FCM' | 'EXPO';
    platform: 'ANDROID' | 'IOS';
    deviceId?: string;
    appVersion?: string;
  }
): Promise<void> {
  await request('/mobile/push/device-token', {
    method: 'POST',
    token: accessToken,
    body,
  });
}
