-- CreateEnum
CREATE TYPE "ChatArchiveReason" AS ENUM ('TEAM_TO_PRIVATE', 'TEAM_TO_PUBLIC', 'LAST_MEMBER_REMOVED');

-- CreateTable
CREATE TABLE "ArchivedChatMessage" (
    "id" TEXT NOT NULL,
    "originalMessageId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "replyToId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "pinnedById" TEXT,
    "actionItemId" TEXT,
    "evidenceId" TEXT,
    "handoffData" JSONB,
    "rcaAnalysisId" TEXT,
    "rcaItemId" TEXT,
    "rcaItemType" TEXT,
    "statusChange" JSONB,
    "announcementData" JSONB,
    "decisionData" JSONB,
    "questionData" JSONB,
    "updateData" JSONB,
    "originalCreatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archiveReason" "ChatArchiveReason" NOT NULL DEFAULT 'TEAM_TO_PRIVATE',
    "archivedByUserId" TEXT NOT NULL,
    "archiveBatchId" TEXT NOT NULL,
    "senderFirstName" TEXT NOT NULL,
    "senderLastName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,

    CONSTRAINT "ArchivedChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchivedChatMessage_incidentId_idx" ON "ArchivedChatMessage"("incidentId");

-- CreateIndex
CREATE INDEX "ArchivedChatMessage_archiveBatchId_idx" ON "ArchivedChatMessage"("archiveBatchId");

-- CreateIndex
CREATE INDEX "ArchivedChatMessage_archivedAt_idx" ON "ArchivedChatMessage"("archivedAt");

-- CreateIndex
CREATE INDEX "ArchivedChatMessage_originalCreatedAt_idx" ON "ArchivedChatMessage"("originalCreatedAt");

-- AddForeignKey
ALTER TABLE "ArchivedChatMessage" ADD CONSTRAINT "ArchivedChatMessage_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
