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
      const result = await processAllLswNotifications();
      if (result.totalSent > 0) {
        console.log(
          `[LSW Cron] Processed ${result.usersProcessed} users, sent ${result.totalSent} notifications`
        );
      }
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

  console.log('✅ LSW notification cron started (every 5 min)');
}
