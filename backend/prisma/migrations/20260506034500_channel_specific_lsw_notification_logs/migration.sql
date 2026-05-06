-- Track LSW notification delivery separately for email, browser, and mobile push.
-- The previous unique key treated one accepted channel as "sent" for every
-- channel, which prevented retries when another channel failed or was silent.
ALTER TABLE "lsw_notification_logs"
  DROP CONSTRAINT IF EXISTS "lsw_notification_logs_userId_entityType_entityId_notificationType_key";

CREATE UNIQUE INDEX IF NOT EXISTS "lsw_notification_logs_user_channel_notification_key"
  ON "lsw_notification_logs"("userId", "entityType", "entityId", "notificationType", "channel");
