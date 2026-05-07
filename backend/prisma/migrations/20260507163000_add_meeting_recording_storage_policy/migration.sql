ALTER TABLE "Meeting"
  ADD COLUMN IF NOT EXISTS "recordingStorageBucket" TEXT,
  ADD COLUMN IF NOT EXISTS "recordingStoragePath" TEXT,
  ADD COLUMN IF NOT EXISTS "recordingFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "recordingMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "recordingFileSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "recordingUploadedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recordingRetentionExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recordingDeletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recordingDeletionReason" TEXT;

CREATE INDEX IF NOT EXISTS "Meeting_recordingRetentionExpiresAt_idx"
  ON "Meeting"("recordingRetentionExpiresAt");

CREATE TABLE IF NOT EXISTS "MeetingRecordingRetentionPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "audioRetentionMode" TEXT NOT NULL DEFAULT 'RETAIN_FOR_DAYS',
  "audioRetentionDays" INTEGER NOT NULL DEFAULT 30,
  "transcriptRetentionDays" INTEGER NOT NULL DEFAULT 90,
  "summaryRetentionDays" INTEGER NOT NULL DEFAULT 90,
  "allowUsersToDeleteAudio" BOOLEAN NOT NULL DEFAULT true,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingRecordingRetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetingRecordingRetentionPolicy_organizationId_key"
  ON "MeetingRecordingRetentionPolicy"("organizationId");

CREATE INDEX IF NOT EXISTS "MeetingRecordingRetentionPolicy_organizationId_idx"
  ON "MeetingRecordingRetentionPolicy"("organizationId");

CREATE INDEX IF NOT EXISTS "MeetingRecordingRetentionPolicy_updatedByUserId_idx"
  ON "MeetingRecordingRetentionPolicy"("updatedByUserId");

ALTER TABLE "MeetingRecordingRetentionPolicy"
  ADD CONSTRAINT "MeetingRecordingRetentionPolicy_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
