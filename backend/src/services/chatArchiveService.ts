import { prisma } from '../utils/prisma';
import { ChatArchiveReason, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

interface ArchiveResult {
  success: boolean;
  archivedCount: number;
  archiveBatchId: string;
  archivedAt: Date;
}

// Helper to handle JSON fields that might be null
function toJsonInput(value: Prisma.JsonValue | null): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

/**
 * Archives all active chat messages for an incident.
 * This is called when:
 * 1. Team incident transitions to Private (last member removed)
 * 2. Team incident transitions to Public
 * 
 * Messages are copied to ArchivedChatMessage table and then deleted from ChatMessage.
 * This preserves chat history while clearing the active chat.
 */
export async function archiveChatMessages(
  incidentId: string,
  archivedByUserId: string,
  reason: ChatArchiveReason
): Promise<ArchiveResult> {
  const archiveBatchId = uuidv4();
  const archivedAt = new Date();

  // Fetch all active chat messages for the incident (excluding SYSTEM messages created for participant changes)
  const messages = await prisma.chatMessage.findMany({
    where: {
      incidentId,
      isDeleted: false,
    },
    include: {
      User: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (messages.length === 0) {
    return {
      success: true,
      archivedCount: 0,
      archiveBatchId,
      archivedAt,
    };
  }

  // Use a transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    // Create archived messages
    await tx.archivedChatMessage.createMany({
      data: messages.map((msg) => ({
        id: uuidv4(),
        originalMessageId: msg.id,
        incidentId: msg.incidentId,
        userId: msg.userId,
        content: msg.content,
        messageType: msg.messageType,
        replyToId: msg.replyToId,
        isEdited: msg.isEdited,
        attachments: toJsonInput(msg.attachments),
        mentions: msg.mentions, // String[] - pass directly
        isPinned: msg.isPinned,
        pinnedAt: msg.pinnedAt,
        pinnedById: msg.pinnedById,
        actionItemId: msg.actionItemId,
        evidenceId: msg.evidenceId,
        handoffData: toJsonInput(msg.handoffData),
        rcaAnalysisId: msg.rcaAnalysisId,
        rcaItemId: msg.rcaItemId,
        rcaItemType: msg.rcaItemType,
        statusChange: toJsonInput(msg.statusChange),
        announcementData: toJsonInput(msg.announcementData),
        decisionData: toJsonInput(msg.decisionData),
        questionData: toJsonInput(msg.questionData),
        updateData: toJsonInput(msg.updateData),
        originalCreatedAt: msg.createdAt,
        archivedAt,
        archiveReason: reason,
        archivedByUserId,
        archiveBatchId,
        senderFirstName: msg.User?.firstName || 'Unknown',
        senderLastName: msg.User?.lastName || 'User',
        senderEmail: msg.User?.email || '',
      })),
    });

    // Delete reactions for the messages being archived
    await tx.chatMessageReaction.deleteMany({
      where: {
        messageId: { in: messages.map((m) => m.id) },
      },
    });

    // Delete the original messages
    await tx.chatMessage.deleteMany({
      where: {
        incidentId,
      },
    });
  });

  console.log(`[ChatArchive] Archived ${messages.length} messages for incident ${incidentId}, batch: ${archiveBatchId}, reason: ${reason}`);

  return {
    success: true,
    archivedCount: messages.length,
    archiveBatchId,
    archivedAt,
  };
}

/**
 * Gets all archived chat messages for an incident, grouped by archive batch.
 */
export async function getArchivedMessages(incidentId: string) {
  const messages = await prisma.archivedChatMessage.findMany({
    where: { incidentId },
    orderBy: [
      { archiveBatchId: 'asc' },
      { originalCreatedAt: 'asc' },
    ],
  });

  // Group by archive batch
  const batches = new Map<string, {
    archiveBatchId: string;
    archivedAt: Date;
    archiveReason: ChatArchiveReason;
    messages: typeof messages;
  }>();

  for (const msg of messages) {
    if (!batches.has(msg.archiveBatchId)) {
      batches.set(msg.archiveBatchId, {
        archiveBatchId: msg.archiveBatchId,
        archivedAt: msg.archivedAt,
        archiveReason: msg.archiveReason,
        messages: [],
      });
    }
    batches.get(msg.archiveBatchId)!.messages.push(msg);
  }

  return Array.from(batches.values()).sort((a, b) => 
    a.archivedAt.getTime() - b.archivedAt.getTime()
  );
}

/**
 * Checks if an incident has any archived chat messages.
 */
export async function hasArchivedMessages(incidentId: string): Promise<boolean> {
  const count = await prisma.archivedChatMessage.count({
    where: { incidentId },
  });
  return count > 0;
}

/**
 * Gets archive metadata for an incident (for displaying archive info in UI).
 */
export async function getArchiveMetadata(incidentId: string) {
  const archives = await prisma.archivedChatMessage.groupBy({
    by: ['archiveBatchId', 'archivedAt', 'archiveReason'],
    where: { incidentId },
    _count: { id: true },
    orderBy: { archivedAt: 'asc' },
  });

  return archives.map((a) => ({
    batchId: a.archiveBatchId,
    archivedAt: a.archivedAt,
    reason: a.archiveReason,
    messageCount: a._count.id,
  }));
}
