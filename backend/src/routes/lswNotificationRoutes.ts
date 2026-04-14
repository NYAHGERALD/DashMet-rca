/**
 * LSW Notification Preference Routes
 * 
 * GET  /api/lsw/notification-preferences       — Get user's LSW notification preferences
 * PUT  /api/lsw/notification-preferences       — Update notification preferences
 * POST /api/lsw/notification-preferences/check — Trigger on-demand notification check
 * GET  /api/lsw/notification-preferences/browser-pending — Get pending browser notifications
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  processUserLswNotifications,
  getPendingBrowserNotifications,
} from '../services/lswNotificationService';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/lsw/notification-preferences
 * Get the current user's LSW notification preferences (auto-creates if not exists)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const prefs = await getNotificationPreferences(userId);
    res.json({ success: true, data: prefs });
  } catch (err: any) {
    console.error('[LSW NotifPrefs] GET error:', err);
    res.status(500).json({ success: false, error: 'Failed to load notification preferences' });
  }
});

/**
 * PUT /api/lsw/notification-preferences
 * Update LSW notification preferences
 */
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Whitelist allowed fields
    const {
      emailEnabled,
      browserEnabled,
      bakeryEmailEnabled,
      bakeryBrowserEnabled,
      notifyTaskOverdue,
      notifyTodoOverdue,
      notifyMeetingOverdue,
      notifyFollowUpOverdue,
      notifyFreqTaskOverdue,
      upcomingReminderEnabled,
      reminderMinutesBefore,
      reminderDaysBefore,
      reminderWeeksBefore,
      reminderMonthsBefore,
      digestFrequency,
      quietHoursStart,
      quietHoursEnd,
      timezone,
    } = req.body;

    // Validate digest frequency
    const validFrequencies = ['realtime', 'hourly', 'daily', 'weekly'];
    if (digestFrequency && !validFrequencies.includes(digestFrequency)) {
      return res.status(400).json({
        success: false,
        error: `Invalid digestFrequency. Must be one of: ${validFrequencies.join(', ')}`,
      });
    }

    // Validate reminder values
    if (reminderMinutesBefore !== undefined && (reminderMinutesBefore < 0 || reminderMinutesBefore > 1440)) {
      return res.status(400).json({
        success: false,
        error: 'reminderMinutesBefore must be between 0 and 1440',
      });
    }

    if (reminderDaysBefore !== undefined && (reminderDaysBefore < 0 || reminderDaysBefore > 30)) {
      return res.status(400).json({
        success: false,
        error: 'reminderDaysBefore must be between 0 and 30',
      });
    }

    // Validate quiet hours format
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (quietHoursStart && !timeRegex.test(quietHoursStart)) {
      return res.status(400).json({
        success: false,
        error: 'quietHoursStart must be in HH:MM format',
      });
    }
    if (quietHoursEnd && !timeRegex.test(quietHoursEnd)) {
      return res.status(400).json({
        success: false,
        error: 'quietHoursEnd must be in HH:MM format',
      });
    }

    // Build update data (only include provided fields)
    const updateData: Record<string, any> = {};
    if (emailEnabled !== undefined) updateData.emailEnabled = Boolean(emailEnabled);
    if (browserEnabled !== undefined) updateData.browserEnabled = Boolean(browserEnabled);
    if (bakeryEmailEnabled !== undefined) updateData.bakeryEmailEnabled = Boolean(bakeryEmailEnabled);
    if (bakeryBrowserEnabled !== undefined) updateData.bakeryBrowserEnabled = Boolean(bakeryBrowserEnabled);
    if (notifyTaskOverdue !== undefined) updateData.notifyTaskOverdue = Boolean(notifyTaskOverdue);
    if (notifyTodoOverdue !== undefined) updateData.notifyTodoOverdue = Boolean(notifyTodoOverdue);
    if (notifyMeetingOverdue !== undefined) updateData.notifyMeetingOverdue = Boolean(notifyMeetingOverdue);
    if (notifyFollowUpOverdue !== undefined) updateData.notifyFollowUpOverdue = Boolean(notifyFollowUpOverdue);
    if (notifyFreqTaskOverdue !== undefined) updateData.notifyFreqTaskOverdue = Boolean(notifyFreqTaskOverdue);
    if (upcomingReminderEnabled !== undefined) updateData.upcomingReminderEnabled = Boolean(upcomingReminderEnabled);
    if (reminderMinutesBefore !== undefined) updateData.reminderMinutesBefore = Number(reminderMinutesBefore);
    if (reminderDaysBefore !== undefined) updateData.reminderDaysBefore = Number(reminderDaysBefore);
    if (reminderWeeksBefore !== undefined) updateData.reminderWeeksBefore = Number(reminderWeeksBefore);
    if (reminderMonthsBefore !== undefined) updateData.reminderMonthsBefore = Number(reminderMonthsBefore);
    if (digestFrequency !== undefined) updateData.digestFrequency = digestFrequency;
    if (quietHoursStart !== undefined) updateData.quietHoursStart = quietHoursStart || null;
    if (quietHoursEnd !== undefined) updateData.quietHoursEnd = quietHoursEnd || null;
    if (timezone !== undefined) updateData.timezone = timezone;

    const prefs = await updateNotificationPreferences(userId, updateData);
    res.json({ success: true, data: prefs });
  } catch (err: any) {
    console.error('[LSW NotifPrefs] PUT error:', err);
    res.status(500).json({ success: false, error: 'Failed to update notification preferences' });
  }
});

/**
 * POST /api/lsw/notification-preferences/check
 * Trigger an on-demand notification check for the current user
 */
router.post('/check', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const sentCount = await processUserLswNotifications(userId);
    res.json({ success: true, data: { sentCount } });
  } catch (err: any) {
    console.error('[LSW NotifPrefs] CHECK error:', err);
    res.status(500).json({ success: false, error: 'Failed to process notifications' });
  }
});

/**
 * GET /api/lsw/notification-preferences/browser-pending
 * Get pending browser notifications for the current user
 */
router.get('/browser-pending', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notifications = await getPendingBrowserNotifications(userId);
    res.json({ success: true, data: notifications });
  } catch (err: any) {
    console.error('[LSW NotifPrefs] BROWSER-PENDING error:', err);
    res.status(500).json({ success: false, error: 'Failed to get pending notifications' });
  }
});

export default router;
