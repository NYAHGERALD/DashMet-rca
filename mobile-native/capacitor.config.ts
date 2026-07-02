/// <reference types="@capacitor-firebase/authentication" />
import type { CapacitorConfig } from '@capacitor/cli';

const hostedWebUrl = process.env.CAPACITOR_SERVER_URL || 'https://www.dashmet.com';
const useHostedWebPreview =
  process.env.CAPACITOR_WEB_MODE === 'hosted' || Boolean(process.env.CAPACITOR_SERVER_URL);
const allowedWebHosts = Array.from(
  new Set(
    [
      'www.dashmet.com',
      'dashmet.com',
      ...String(process.env.CAPACITOR_ALLOWED_WEB_HOSTS || '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean),
      (() => {
        try {
          return new URL(hostedWebUrl).hostname;
        } catch {
          return '';
        }
      })(),
    ].filter(Boolean)
  )
);

const config: CapacitorConfig = {
  appId: 'com.dashmet.operations',
  appName: 'DashMet',
  webDir: 'dist',
  server: {
    ...(useHostedWebPreview ? { url: hostedWebUrl, cleartext: false } : {}),
    allowNavigation: allowedWebHosts,
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['phone'],
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
