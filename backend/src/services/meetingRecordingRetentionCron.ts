import cron from 'node-cron';
import { cleanupExpiredMeetingRecordings } from './meetingRecordingStorageService';

let retentionCronStarted = false;

export function startMeetingRecordingRetentionCron() {
  if (retentionCronStarted) return;
  retentionCronStarted = true;

  // Run nightly during low traffic. A small batch keeps startup and free-tier
  // instances responsive while still enforcing the configured retention window.
  cron.schedule('35 2 * * *', async () => {
    try {
      const result = await cleanupExpiredMeetingRecordings(100);
      if (result.deleted > 0) {
        console.log(`[MeetingRecordingRetention] Deleted ${result.deleted}/${result.scanned} expired audio object(s).`);
      }
    } catch (error: any) {
      console.error('[MeetingRecordingRetention] Cleanup failed:', error?.message || error);
    }
  });
}
