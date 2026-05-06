ALTER TABLE "lsw_notification_preferences"
  ADD COLUMN IF NOT EXISTS "issueMobilePushEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "issueCreatedPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "issueStatusPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "issueEditedPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "issueDeletedPushEnabled" BOOLEAN NOT NULL DEFAULT true;
