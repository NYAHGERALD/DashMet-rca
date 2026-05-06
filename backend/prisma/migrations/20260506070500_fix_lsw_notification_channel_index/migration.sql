-- The first channel-specific migration used the non-truncated Prisma
-- constraint name. Some Postgres databases have the older unique index under
-- Prisma's truncated name, so the old one-row-per-item uniqueness remained in
-- place and email/browser/mobile delivery could block each other.

ALTER TABLE "lsw_notification_logs"
  DROP CONSTRAINT IF EXISTS "lsw_notification_logs_userId_entityType_entityId_notificationType_key";

ALTER TABLE "lsw_notification_logs"
  DROP CONSTRAINT IF EXISTS "lsw_notification_logs_userId_entityType_entityId_notificati_key";

DROP INDEX IF EXISTS "lsw_notification_logs_userId_entityType_entityId_notificationType_key";
DROP INDEX IF EXISTS "lsw_notification_logs_userId_entityType_entityId_notificati_key";

CREATE UNIQUE INDEX IF NOT EXISTS "lsw_notification_logs_user_channel_notification_key"
  ON "lsw_notification_logs"("userId", "entityType", "entityId", "notificationType", "channel");

-- Preserve legacy combined-channel log rows for duplicate prevention after the
-- index change, then remove the combined rows so future reporting is clean.
INSERT INTO "lsw_notification_logs" (
  "id",
  "userId",
  "entityType",
  "entityId",
  "notificationType",
  "channel",
  "sentAt"
)
SELECT
  md5("legacy"."id" || ':' || "split"."channel"),
  "legacy"."userId",
  "legacy"."entityType",
  "legacy"."entityId",
  "legacy"."notificationType",
  "split"."channel",
  "legacy"."sentAt"
FROM "lsw_notification_logs" AS "legacy"
CROSS JOIN LATERAL regexp_split_to_table("legacy"."channel", '[+]') AS "split"("channel")
WHERE "legacy"."channel" LIKE '%+%'
  AND "split"."channel" IN ('email', 'browser', 'mobile_push')
ON CONFLICT ("userId", "entityType", "entityId", "notificationType", "channel") DO NOTHING;

DELETE FROM "lsw_notification_logs"
WHERE "channel" LIKE '%+%';
