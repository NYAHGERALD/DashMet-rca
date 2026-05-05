-- Add Expo/mobile push support while preserving existing FCM token behavior.
DO $$ BEGIN
  CREATE TYPE "PushTokenProvider" AS ENUM ('EXPO', 'FCM', 'APNS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "DeviceToken"
  ADD COLUMN IF NOT EXISTS "provider" "PushTokenProvider" NOT NULL DEFAULT 'EXPO',
  ADD COLUMN IF NOT EXISTS "lastFailureAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastFailureReason" TEXT;

ALTER TABLE "lsw_notification_preferences"
  ADD COLUMN IF NOT EXISTS "mobilePushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "bakeryMobilePushEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "mobileSoundEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "MobilePushTicket" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "token" TEXT NOT NULL,
  "ticketId" TEXT,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "details" JSONB,
  "checkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobilePushTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MobilePushTicket_ticketId_idx" ON "MobilePushTicket"("ticketId");
CREATE INDEX IF NOT EXISTS "MobilePushTicket_checkedAt_idx" ON "MobilePushTicket"("checkedAt");
CREATE INDEX IF NOT EXISTS "MobilePushTicket_userId_idx" ON "MobilePushTicket"("userId");
CREATE INDEX IF NOT EXISTS "MobilePushTicket_token_idx" ON "MobilePushTicket"("token");
