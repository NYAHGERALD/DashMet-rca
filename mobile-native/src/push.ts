import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerMobilePushToken } from './api';

async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;

  const channels = [
    {
      id: 'dashmet_alerts',
      name: 'DashMet Alerts',
      description: 'Operational alerts, reminders, and assigned work notifications.',
    },
    {
      id: 'action_items',
      name: 'Action Items',
      description: 'Action item assignments and updates.',
    },
  ];

  await Promise.all(
    channels.map((channel) =>
      PushNotifications.createChannel({
        ...channel,
        importance: 5,
        visibility: 1,
        lights: true,
        lightColor: '#14b8a6',
        vibration: true,
        sound: 'default',
      }).catch(() => undefined)
    )
  );
}

export async function registerPushForSession(accessToken: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    return 'Push registration is available on native builds.';
  }

  await ensureAndroidNotificationChannels();

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    return 'Push notifications were not enabled on this device.';
  }

  const appInfo = await App.getInfo().catch(() => ({ version: undefined }));
  const deviceId = await Device.getId().catch(() => ({ identifier: undefined }));

  await PushNotifications.removeAllListeners();

  const registrationMessage = await new Promise<string>((resolve) => {
    let settled = false;
    const finish = (message: string) => {
      if (settled) return;
      settled = true;
      resolve(message);
    };

    PushNotifications.addListener('registration', async (token) => {
      try {
        await registerMobilePushToken(accessToken, {
          token: token.value,
          provider: 'FCM',
          platform: Capacitor.getPlatform() === 'ios' ? 'IOS' : 'ANDROID',
          deviceId: deviceId.identifier,
          appVersion: appInfo.version,
        });
        finish('Push notifications are ready on this device.');
      } catch {
        finish('The device token was received, but the backend could not register it.');
      }
    });

    PushNotifications.addListener('registrationError', () => {
      finish('Push notification registration failed on this device.');
    });

    PushNotifications.register();
  });

  return registrationMessage;
}
