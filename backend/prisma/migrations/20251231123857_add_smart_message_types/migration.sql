-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ChatMessageType" ADD VALUE 'QUESTION';
ALTER TYPE "ChatMessageType" ADD VALUE 'UPDATE';
ALTER TYPE "ChatMessageType" ADD VALUE 'ANNOUNCEMENT';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'INCIDENT_UPDATED';

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "announcementData" JSONB,
ADD COLUMN     "decisionData" JSONB,
ADD COLUMN     "questionData" JSONB,
ADD COLUMN     "updateData" JSONB;

-- CreateIndex
CREATE INDEX "ChatMessage_messageType_idx" ON "ChatMessage"("messageType");
