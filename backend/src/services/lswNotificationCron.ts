/**
 * LSW Notification Cron Job
 * 
 * Runs every 5 minutes to check for overdue items and upcoming reminders
 * for all users who have LSW notifications enabled.
 * 
 * Also runs a daily cleanup of old notification logs.
 */

import cron from 'node-cron';
import {
  processAllLswNotifications,
  cleanupOldNotificationLogs,
} from './lswNotificationService';
import { checkPendingExpoPushReceipts } from './pushNotificationService';

let isRunning = false;

/**
 * Start the LSW notification cron job.
 * Runs every 5 minutes to process notifications.
 */
export function startLswNotificationCron() {
  // Check for notifications every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    if (isRunning) {
      console.log('[LSW Cron] Previous run still in progress — skipping');
      return;
    }

    isRunning = true;
    try {
      console.log('[LSW Cron] Running notification check...');
      const result = await processAllLswNotifications();
      console.log(
        `[LSW Cron] Done — ${result.usersProcessed} users, ${result.totalSent} notifications sent`
      );
    } catch (err) {
      console.error('[LSW Cron] Error processing notifications:', err);
    } finally {
      isRunning = false;
    }
  });

  // Cleanup old notification logs daily at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      const deleted = await cleanupOldNotificationLogs();
      if (deleted > 0) {
        console.log(`[LSW Cron] Cleaned up ${deleted} old notification log entries`);
      }
    } catch (err) {
      console.error('[LSW Cron] Error cleaning up notification logs:', err);
    }
  });

  // Expo push receipts are available after delivery attempts. Checking them
  // lets us deactivate tokens from uninstalled apps or revoked permissions.
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await checkPendingExpoPushReceipts();
      if (result.checked > 0 || result.invalidated > 0 || result.failed > 0) {
        console.log(
          `[MobilePush] Receipts checked=${result.checked}, failed=${result.failed}, invalidated=${result.invalidated}`,
        );
      }
    } catch (err) {
      console.error('[MobilePush] Receipt cron error:', err);
    }
  });

  console.log('✅ LSW notification cron started (every 5 min); mobile push receipts checked every 15 min');
}
