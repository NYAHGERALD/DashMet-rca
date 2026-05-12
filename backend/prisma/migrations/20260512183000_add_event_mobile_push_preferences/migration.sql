ALTER TABLE "lsw_notification_preferences"
  ADD COLUMN IF NOT EXISTS "bakerySubmissionPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "bakeryOeeBelowTargetPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "incidentMobilePushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "incidentCreatedPushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "incidentTeamInvitePushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "capaMobilePushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "capaBoardCreatedPushEnabled" BOOLEAN NOT NULL DEFAULT true;
