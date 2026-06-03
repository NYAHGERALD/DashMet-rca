ALTER TABLE "lsw_notification_preferences"
  ADD COLUMN IF NOT EXISTS "vacationMobilePushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "vacationRequestCreatedPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "vacationRequestApprovedPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "vacationRequestDeniedPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "vacationRequestCancelledPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "vacationRequestDeletedPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "vacationPendingReminderPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "vacationPendingReminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "vacationStartDayPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "vacationReturnReminderPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "vacationReturnReminderDaysBefore" INTEGER NOT NULL DEFAULT 1;

UPDATE "lsw_notification_preferences"
SET
  "vacationPendingReminderDaysBefore" = LEAST(60, GREATEST(0, "vacationPendingReminderDaysBefore")),
  "vacationReturnReminderDaysBefore" = LEAST(60, GREATEST(0, "vacationReturnReminderDaysBefore"));
