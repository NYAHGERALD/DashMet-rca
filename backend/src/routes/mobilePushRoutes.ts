import { Router, Response } from 'express';
import { Expo } from 'expo-server-sdk';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  registerDeviceToken,
  sendPushNotificationToDeviceToken,
  sendPushNotificationToUser,
  unregisterDeviceToken,
} from '../services/pushNotificationService';

const router = Router();

router.use(authenticate);

const VALID_PLATFORMS = new Set(['IOS', 'ANDROID', 'WEB']);
const VALID_PROVIDERS = new Set(['EXPO', 'FCM']);

const normalizePlatform = (value: unknown): 'IOS' | 'ANDROID' | 'WEB' => {
  const platform = String(value || '').trim().toUpperCase();
  return VALID_PLATFORMS.has(platform) ? (platform as 'IOS' | 'ANDROID' | 'WEB') : 'IOS';
};

const normalizeProvider = (value: unknown, token: string): 'EXPO' | 'FCM' => {
  const provider = String(value || '').trim().toUpperCase();
  if (VALID_PROVIDERS.has(provider)) return provider as 'EXPO' | 'FCM';
  return Expo.isExpoPushToken(token) ? 'EXPO' : 'FCM';
};

const normalizeTestDelaySeconds = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(15, Math.round(parsed)));
};

/**
 * POST /api/mobile/push/device-token
 * Registers the current signed-in mobile device for server push notifications.
 */
router.post('/device-token', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const token = String(req.body?.token || '').trim();

    if (!token) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }

    const provider = normalizeProvider(req.body?.provider, token);
    if (provider === 'EXPO' && !Expo.isExpoPushToken(token)) {
      return res.status(400).json({ success: false, error: 'Invalid Expo push token' });
    }

    const success = await registerDeviceToken(
      userId,
      token,
      normalizePlatform(req.body?.platform),
      req.body?.deviceId ? String(req.body.deviceId).slice(0, 160) : undefined,
      req.body?.appVersion ? String(req.body.appVersion).slice(0, 80) : undefined,
      provider,
    );

    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to register device token' });
    }

    return res.json({
      success: true,
      message: 'Device registered for mobile push notifications',
    });
  } catch (error) {
    console.error('[MobilePush] Device token registration error:', error);
    return res.status(500).json({ success: false, error: 'Failed to register device token' });
  }
});

/**
 * DELETE /api/mobile/push/device-token
 * Deactivates the current signed-in user's token, normally called on sign out.
 */
router.delete('/device-token', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const token = String(req.body?.token || '').trim();

    if (!token) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }

    const success = await unregisterDeviceToken(userId, token);
    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to unregister device token' });
    }

    return res.json({
      success: true,
      message: 'Device unregistered from mobile push notifications',
    });
  } catch (error) {
    console.error('[MobilePush] Device token removal error:', error);
    return res.status(500).json({ success: false, error: 'Failed to unregister device token' });
  }
});

/**
 * POST /api/mobile/push/test
 * Sends a signed-in user a test notification after the device is registered.
 */
router.post('/test', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const firstName = user.firstName?.trim() || user.email.split('@')[0] || 'there';
    const token = String(req.body?.token || '').trim();
    if (token && !Expo.isExpoPushToken(token)) {
      return res.status(400).json({ success: false, error: 'Invalid Expo push token' });
    }
    const delaySeconds = normalizeTestDelaySeconds(req.body?.delaySeconds);

    const payload = {
      title: 'DashMet alert test',
      body: `Hi, ${firstName}. DashMet alerts are ready on this phone. Tap to open your notification settings.`,
      sound: 'default',
      badge: 1,
      interruptionLevel: 'time-sensitive',
      ttl: 3600,
      data: {
        type: 'MOBILE_PUSH_TEST',
        screen: 'notification-settings',
        channelId: 'dashmet_alerts',
      },
    };

    const sendTest = () => token
      ? sendPushNotificationToDeviceToken(user.id, token, payload)
      : sendPushNotificationToUser(user.id, payload);

    if (delaySeconds > 0) {
      setTimeout(() => {
        sendTest().catch((error) => {
          console.error('[MobilePush] Delayed test push error:', error);
        });
      }, delaySeconds * 1000);

      return res.json({
        success: true,
        data: {
          successCount: 0,
          failureCount: 0,
          queued: true,
          delaySeconds,
          target: token ? 'current_device' : 'all_devices',
        },
      });
    }

    const result = token
      ? await sendPushNotificationToDeviceToken(user.id, token, payload)
      : await sendPushNotificationToUser(user.id, payload);

    return res.json({ success: true, data: { ...result, target: token ? 'current_device' : 'all_devices' } });
  } catch (error) {
    console.error('[MobilePush] Test push error:', error);
    return res.status(500).json({ success: false, error: 'Failed to send test notification' });
  }
});

export default router;
