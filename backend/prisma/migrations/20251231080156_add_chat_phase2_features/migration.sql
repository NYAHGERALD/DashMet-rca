-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ChatMessageType" ADD VALUE 'EVIDENCE_LINK';
ALTER TYPE "ChatMessageType" ADD VALUE 'RCA_LINK';
ALTER TYPE "ChatMessageType" ADD VALUE 'ACTION_ITEM';
ALTER TYPE "ChatMessageType" ADD VALUE 'STATUS_UPDATE';
ALTER TYPE "ChatMessageType" ADD VALUE 'HANDOFF';
ALTER TYPE "ChatMessageType" ADD VALUE 'DECISION';

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "actionItemId" TEXT,
ADD COLUMN     "evidenceId" TEXT,
ADD COLUMN     "handoffData" JSONB,
ADD COLUMN     "rcaAnalysisId" TEXT,
ADD COLUMN     "rcaItemId" TEXT,
ADD COLUMN     "rcaItemType" TEXT,
ADD COLUMN     "statusChange" JSONB;

-- CreateIndex
CREATE INDEX "ChatMessage_evidenceId_idx" ON "ChatMessage"("evidenceId");

-- CreateIndex
CREATE INDEX "ChatMessage_rcaAnalysisId_idx" ON "ChatMessage"("rcaAnalysisId");

-- CreateIndex
CREATE INDEX "ChatMessage_actionItemId_idx" ON "ChatMessage"("actionItemId");
