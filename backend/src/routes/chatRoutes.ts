import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { websocketService } from '../services/websocketService';
import { upload, handleMulterError } from '../middleware/upload';
import { adminStorage } from '../config/firebase-admin';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/chat/:incidentId/messages - Get chat messages for an incident
router.get('/:incidentId/messages', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { limit = '50', before, after } = req.query;
  const user = (req as any).user;

  console.log(`[Chat] GET messages for incident ${incidentId} by user ${user.id} (${user.email})`);

  // Verify user is a participant
  const participant = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: { incidentId, userId: user.id },
    },
    include: {
      Incident: {
        select: { organizationId: true, createdById: true },
      },
    },
  });

  // Fetch incident details for access check and message filtering
  const incidentDetails = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { createdById: true, organizationId: true, createdAt: true },
  });

  if (!incidentDetails) {
    throw new ValidationError('Incident not found');
  }

  // Allow access if user is participant, incident creator, or admin
  const isCreator = incidentDetails.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER', 'SAFETY_SECURITY_MANAGER'].includes(user.role);
  const isParticipant = participant?.isActive;
  const isSameOrg = incidentDetails.organizationId === user.organizationId;

  console.log(`[Chat] Access check - isCreator: ${isCreator}, isAdmin: ${isAdmin}, isParticipant: ${isParticipant}, isSameOrg: ${isSameOrg}`);

  if (!isParticipant && !isCreator && !isAdmin && !isSameOrg) {
    console.log(`[Chat] Access denied for user ${user.id}`);
    throw new ValidationError('You do not have access to this chat');
  }

  // Build query filters
  const whereClause: any = {
    incidentId,
    isDeleted: false,
  };

  // Note: We no longer filter messages by joinedAt for participants.
  // All team members (original or added later) can see the full chat history.
  // This ensures chat continuity across incident and RCA views.

  if (before) {
    whereClause.createdAt = { 
      ...(whereClause.createdAt || {}),
      lt: new Date(String(before)) 
    };
  } else if (after) {
    whereClause.createdAt = { 
      ...(whereClause.createdAt || {}),
      gt: new Date(String(after)) 
    };
  }

  const messages = await prisma.chatMessage.findMany({
    where: whereClause,
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
          profilePicture: true,
        },
      },
      ChatMessage: {
        select: {
          id: true,
          content: true,
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      ChatMessageReaction: {
        include: {
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: after ? 'asc' : 'desc' },
    take: parseInt(String(limit), 10),
  });

  // Fetch evidence data for EVIDENCE_LINK messages
  const evidenceIds = messages
    .filter(m => m.messageType === 'EVIDENCE_LINK' && m.evidenceId)
    .map(m => m.evidenceId as string);
  
  console.log(`[Chat] Evidence IDs found:`, evidenceIds);
  
  const evidenceMap = new Map();
  if (evidenceIds.length > 0) {
    const evidenceList = await prisma.evidence.findMany({
      where: { id: { in: evidenceIds } },
      select: {
        id: true,
        type: true,
        fileName: true,
        filePath: true,
        mimeType: true,
        fileSize: true,
        transcription: true,
      },
    });
    console.log(`[Chat] Evidence fetched:`, evidenceList);
    evidenceList.forEach(e => evidenceMap.set(e.id, e));
  }

  // Attach evidence data to messages
  const messagesWithEvidence = messages.map(m => ({
    ...m,
    Evidence: m.evidenceId ? evidenceMap.get(m.evidenceId) : undefined,
  }));

  // Enrich questionData with resolver/reopener user info for QUESTION messages
  const questionUserIds = new Set<string>();
  messagesWithEvidence.forEach(m => {
    if (m.messageType === 'QUESTION' && m.questionData) {
      const qd = m.questionData as any;
      console.log(`[Chat] Question message ${m.id} questionData:`, JSON.stringify(qd));
      if (qd.resolvedBy) questionUserIds.add(qd.resolvedBy);
      if (qd.reopenedBy) questionUserIds.add(qd.reopenedBy);
    }
  });
  console.log(`[Chat] Question user IDs to lookup:`, Array.from(questionUserIds));

  const questionUsersMap = new Map();
  if (questionUserIds.size > 0) {
    const questionUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(questionUserIds) } },
      select: { id: true, firstName: true, lastName: true },
    });
    console.log(`[Chat] Found question User:`, questionUsers);
    questionUsers.forEach(u => questionUsersMap.set(u.id, u));
  }

  // Attach resolver/reopener user info to questionData
  const enrichedMessages = messagesWithEvidence.map(m => {
    if (m.messageType === 'QUESTION' && m.questionData) {
      const qd = m.questionData as any;
      const enrichedQd = {
        ...qd,
        resolvedByUser: qd.resolvedBy ? questionUsersMap.get(qd.resolvedBy) : undefined,
        reopenedByUser: qd.reopenedBy ? questionUsersMap.get(qd.reopenedBy) : undefined,
      };
      console.log(`[Chat] Enriched questionData for message ${m.id}:`, JSON.stringify(enrichedQd));
      return {
        ...m,
        questionData: enrichedQd,
      };
    }
    return m;
  });

  console.log(`[Chat] Found ${messages.length} messages for incident ${incidentId}`);

  // Reverse if we got messages in desc order (for "before" pagination)
  const orderedMessages = after ? enrichedMessages : enrichedMessages.reverse();

  // Update last viewed timestamp for the participant
  if (isParticipant || isCreator) {
    await prisma.incidentParticipant.updateMany({
      where: { incidentId, userId: user.id },
      data: { lastViewedAt: new Date() },
    });
  }

  res.json({
    success: true,
    data: orderedMessages,
    pagination: {
      hasMore: messages.length === parseInt(String(limit), 10),
      oldestTimestamp: orderedMessages[0]?.createdAt || null,
      newestTimestamp: orderedMessages[orderedMessages.length - 1]?.createdAt || null,
    },
  });
}));

// POST /api/chat/:incidentId/messages - Send a chat message
router.post('/:incidentId/messages', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { content, replyToId, messageType = 'TEXT', attachments } = req.body;
  const user = (req as any).user;

  if (!content || content.trim().length === 0) {
    throw new ValidationError('Message content is required');
  }

  if (content.length > 5000) {
    throw new ValidationError('Message is too long (max 5000 characters)');
  }

  // Verify user has access to this incident
  const participant = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: { incidentId, userId: user.id },
    },
    include: {
      Incident: {
        select: { organizationId: true, createdById: true, incidentNumber: true },
      },
    },
  });

  // Fetch incident details if not available from participant
  const incidentDetails = participant?.Incident || await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { organizationId: true, createdById: true, incidentNumber: true },
  });

  if (!incidentDetails) {
    throw new ValidationError('Incident not found');
  }

  const isCreator = incidentDetails.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER', 'SAFETY_SECURITY_MANAGER'].includes(user.role);
  const isSameOrg = incidentDetails.organizationId === user.organizationId;
  
  if (!participant?.isActive && !isCreator && !isAdmin && !isSameOrg) {
    throw new ValidationError('You are not a participant in this incident');
  }

  if (participant && !participant.canChat && !isCreator) {
    throw new ValidationError('You do not have permission to chat in this incident');
  }

  // Verify reply target exists if provided
  if (replyToId) {
    const replyTarget = await prisma.chatMessage.findUnique({
      where: { id: replyToId },
    });
    if (!replyTarget || replyTarget.incidentId !== incidentId) {
      throw new ValidationError('Invalid reply target');
    }
  }

  // Extract mentions from content (format: @[userId])
  const mentionRegex = /@\[([a-f0-9-]+)\]/gi;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    if (!mentions.includes(match[1])) {
      mentions.push(match[1]);
    }
  }

  const message = await prisma.chatMessage.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      userId: user.id,
      content: content.trim(),
      messageType,
      replyToId,
      attachments,
      mentions,
      readBy: [user.id],
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
          profilePicture: true,
        },
      },
      ChatMessage: {
        select: {
          id: true,
          content: true,
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      ChatMessageReaction: {
        include: {
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  // Get other active participants for notifications
  const otherParticipants = await prisma.incidentParticipant.findMany({
    where: {
      incidentId,
      userId: { not: user.id },
      isActive: true,
    },
    select: { userId: true },
  });

  // Create in-app notifications for offline participants
  const offlineUsers = await prisma.user.findMany({
    where: {
      id: { in: otherParticipants.map(p => p.userId) },
      isOnline: false,
    },
    select: { id: true },
  });

  if (offlineUsers.length > 0) {
    await prisma.notification.createMany({
      data: offlineUsers.map(u => ({
        id: uuidv4(),
        type: 'COMMENT_ADDED' as const,
        title: 'New Team Message',
        message: `${user.firstName} ${user.lastName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
        userId: u.id,
        incidentId,
      })),
    });
  }

  // Create mention notifications for mentioned users
  if (mentions.length > 0) {
    const mentionedUserIds = mentions.filter(id => id !== user.id);
    if (mentionedUserIds.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          id: { in: mentionedUserIds },
        },
        select: { id: true },
      });

      if (mentionedUsers.length > 0) {
        await prisma.notification.createMany({
          data: mentionedUsers.map(u => ({
            id: uuidv4(),
            type: 'COMMENT_ADDED' as const,
            title: 'You were mentioned',
            message: `${user.firstName} ${user.lastName} mentioned you: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
            userId: u.id,
            incidentId,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  // Broadcast message to all users in the incident room via WebSocket
  console.log(`[Chat] Message User object:`, JSON.stringify(message.User, null, 2));
  websocketService.emitToIncident(incidentId, 'chat:message', message);
  console.log(`[Chat] Broadcasted message ${message.id} to incident ${incidentId}`);

  // Also emit directly to each participant's user socket for notifications
  // This ensures they receive the message even if they're not on the incident page
  console.log(`[Chat] Other participants to notify:`, otherParticipants.map(p => p.userId));
  for (const participant of otherParticipants) {
    console.log(`[Chat] Emitting chat:notification to user ${participant.userId}`);
    websocketService.emitToUser(participant.userId, 'chat:notification', {
      ...message,
      incidentId,
      incidentNumber: (message as any).Incident?.incidentNumber,
    });
  }
  console.log(`[Chat] Sent chat:notification to ${otherParticipants.length} participants`);

  res.status(201).json({
    success: true,
    data: message,
  });
}));

// PATCH /api/chat/:incidentId/messages/:messageId - Edit a message
router.patch('/:incidentId/messages/:messageId', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;
  const { content } = req.body;
  const user = (req as any).user;

  if (!content || content.trim().length === 0) {
    throw new ValidationError('Message content is required');
  }

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  if (message.userId !== user.id) {
    throw new ValidationError('You can only edit your own messages');
  }

  if (message.messageType === 'SYSTEM') {
    throw new ValidationError('System messages cannot be edited');
  }

  // Only allow editing within 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (message.createdAt < fifteenMinutesAgo) {
    throw new ValidationError('Messages can only be edited within 15 minutes of sending');
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      content: content.trim(),
      isEdited: true,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          profilePicture: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: updated,
  });
}));

// DELETE /api/chat/:incidentId/messages/:messageId - Delete a message
router.delete('/:incidentId/messages/:messageId', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;
  const user = (req as any).user;

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: {
      Incident: {
        select: { createdById: true },
      },
    },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  // Can delete own messages or admins can delete any
  const isOwner = message.userId === user.id;
  const isIncidentOwner = message.Incident.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN'].includes(user.role);

  if (!isOwner && !isIncidentOwner && !isAdmin) {
    throw new ValidationError('You do not have permission to delete this message');
  }

  if (message.messageType === 'SYSTEM') {
    throw new ValidationError('System messages cannot be deleted');
  }

  // Soft delete
  const deletedMessage = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { isDeleted: true },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
          profilePicture: true,
        },
      },
    },
  });

  // Broadcast deletion to all users in the incident room
  websocketService.emitToIncident(incidentId, 'chat:message:deleted', {
    id: messageId,
    incidentId,
    isDeleted: true,
  });

  res.json({
    success: true,
    message: 'Message deleted',
  });
}));

// POST /api/chat/:incidentId/messages/:messageId/read - Mark message as read
router.post('/:incidentId/messages/:messageId/read', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;
  const user = (req as any).user;

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  // Add user to readBy array if not already there
  if (!message.readBy.includes(user.id)) {
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        readBy: { push: user.id },
      },
    });
  }

  res.json({
    success: true,
    message: 'Message marked as read',
  });
}));

// POST /api/chat/:incidentId/read-all - Mark all messages as read
router.post('/:incidentId/read-all', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  // Get all unread messages
  const unreadMessages = await prisma.chatMessage.findMany({
    where: {
      incidentId,
      NOT: {
        readBy: { has: user.id },
      },
    },
    select: { id: true },
  });

  // Mark all as read
  if (unreadMessages.length > 0) {
    await prisma.$transaction(
      unreadMessages.map(msg =>
        prisma.chatMessage.update({
          where: { id: msg.id },
          data: {
            readBy: { push: user.id },
          },
        })
      )
    );
  }

  res.json({
    success: true,
    message: `Marked ${unreadMessages.length} messages as read`,
  });
}));

// GET /api/chat/:incidentId/unread-count - Get unread message count
router.get('/:incidentId/unread-count', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  const unreadCount = await prisma.chatMessage.count({
    where: {
      incidentId,
      isDeleted: false,
      NOT: {
        readBy: { has: user.id },
      },
    },
  });

  res.json({
    success: true,
    data: { unreadCount },
  });
}));

// POST /api/chat/:incidentId/mark-read - Mark all messages in incident as read
router.post('/:incidentId/mark-read', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  // Find all unread messages for this user in this incident
  const unreadMessages = await prisma.chatMessage.findMany({
    where: {
      incidentId,
      isDeleted: false,
      NOT: {
        readBy: { has: user.id },
      },
    },
    select: { id: true, readBy: true },
  });

  // Update each message to add user to readBy array
  if (unreadMessages.length > 0) {
    await Promise.all(
      unreadMessages.map(message =>
        prisma.chatMessage.update({
          where: { id: message.id },
          data: {
            readBy: {
              push: user.id,
            },
          },
        })
      )
    );
  }

  res.json({
    success: true,
    data: { 
      markedAsRead: unreadMessages.length,
      message: `${unreadMessages.length} messages marked as read`,
    },
  });
}));

// POST /api/chat/:incidentId/messages/:messageId/reactions - Add a reaction
router.post('/:incidentId/messages/:messageId/reactions', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;
  const { emoji } = req.body;
  const user = (req as any).user;

  if (!emoji || typeof emoji !== 'string') {
    throw new ValidationError('Emoji is required');
  }

  // Common emoji validation
  const allowedEmojis = ['👍', '👎', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀', '🙏', '💯', '✅'];
  if (!allowedEmojis.includes(emoji)) {
    throw new ValidationError('Invalid emoji');
  }

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  if (message.isDeleted) {
    throw new ValidationError('Cannot react to deleted messages');
  }

  // Check if reaction already exists
  const existingReaction = await prisma.chatMessageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId: user.id,
        emoji,
      },
    },
  });

  if (existingReaction) {
    // Remove existing reaction (toggle off)
    await prisma.chatMessageReaction.delete({
      where: { id: existingReaction.id },
    });

    // Emit WebSocket event for real-time reaction update
    websocketService.emitToIncident(incidentId, 'chat:reaction', {
      messageId,
      incidentId,
      action: 'removed',
      emoji,
      userId: user.id,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

    res.json({
      success: true,
      action: 'removed',
      data: { messageId, emoji },
    });
    return;
  }

  // Add new reaction
  const reaction = await prisma.chatMessageReaction.create({
    data: {
      id: uuidv4(),
      messageId,
      userId: user.id,
      emoji,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Emit WebSocket event for real-time reaction update
  websocketService.emitToIncident(incidentId, 'chat:reaction', {
    messageId,
    incidentId,
    action: 'added',
    emoji,
    userId: user.id,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });

  res.status(201).json({
    success: true,
    action: 'added',
    data: reaction,
  });
}));

// GET /api/chat/:incidentId/messages/:messageId/reactions - Get reactions for a message
router.get('/:incidentId/messages/:messageId/reactions', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  const reactions = await prisma.chatMessageReaction.findMany({
    where: { messageId },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Group reactions by emoji
  const grouped = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        User: [],
      };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].User.push({
      id: reaction.User.id,
      firstName: reaction.User.firstName,
      lastName: reaction.User.lastName,
    });
    return acc;
  }, {} as Record<string, { emoji: string; count: number; User: { id: string; firstName: string; lastName: string }[] }>);

  res.json({
    success: true,
    data: Object.values(grouped),
  });
}));

// POST /api/chat/:incidentId/messages/:messageId/pin - Pin a message
router.post('/:incidentId/messages/:messageId/pin', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;
  const user = (req as any).user;

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: {
      Incident: {
        select: { createdById: true, organizationId: true },
      },
    },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  if (message.isDeleted) {
    throw new ValidationError('Cannot pin deleted messages');
  }

  // Check if message is already pinned
  if (message.isPinned) {
    throw new ValidationError('Message is already pinned');
  }

  // Check if user has permission to pin (participant, creator, admin, or same org)
  const isIncidentOwner = message.Incident.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'].includes(user.role);
  const isSameOrg = user.organizationId && message.Incident.organizationId === user.organizationId;
  
  // Check if user is a participant
  const participant = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: {
        incidentId,
        userId: user.id,
      },
    },
  });
  const isParticipant = participant?.isActive;

  if (!isParticipant && !isIncidentOwner && !isAdmin && !isSameOrg) {
    throw new ValidationError('You do not have permission to pin this message');
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      isPinned: true,
      pinnedAt: new Date(),
      pinnedById: user.id,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
    },
  });

  // Emit real-time pin event to all participants
  websocketService.emitToIncident(incidentId, 'chat:message-pinned', {
    messageId: updated.id,
    message: updated,
    pinnedBy: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });

  res.json({
    success: true,
    data: updated,
  });
}));

// DELETE /api/chat/:incidentId/messages/:messageId/pin - Unpin a message
router.delete('/:incidentId/messages/:messageId/pin', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;
  const user = (req as any).user;

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: {
      Incident: {
        select: { createdById: true, organizationId: true },
      },
    },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  if (!message.isPinned) {
    throw new ValidationError('Message is not pinned');
  }

  // Check permission (participant, pinner, creator, admin, or same org can unpin)
  const isPinner = message.pinnedById === user.id;
  const isIncidentOwner = message.Incident.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'].includes(user.role);
  const isSameOrg = user.organizationId && message.Incident.organizationId === user.organizationId;
  
  // Check if user is a participant
  const participant = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: {
        incidentId,
        userId: user.id,
      },
    },
  });
  const isParticipant = participant?.isActive;

  if (!isPinner && !isParticipant && !isIncidentOwner && !isAdmin && !isSameOrg) {
    throw new ValidationError('You do not have permission to unpin this message');
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      isPinned: false,
      pinnedAt: null,
      pinnedById: null,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
    },
  });

  // Emit real-time unpin event to all participants
  websocketService.emitToIncident(incidentId, 'chat:message-unpinned', {
    messageId: updated.id,
    message: updated,
    unpinnedBy: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });

  res.json({
    success: true,
    data: updated,
  });
}));

// GET /api/chat/:incidentId/pinned - Get pinned messages
router.get('/:incidentId/pinned', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;

  const pinnedMessages = await prisma.chatMessage.findMany({
    where: {
      incidentId,
      isPinned: true,
      isDeleted: false,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      ChatMessageReaction: {
        include: {
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { pinnedAt: 'desc' },
  });

  res.json({
    success: true,
    data: pinnedMessages,
  });
}));

// ========================================
// PHASE 2: INCIDENT-SPECIFIC ACTIONS
// ========================================

// GET /api/chat/:incidentId/evidence - Get evidence for linking in chat
router.get('/:incidentId/evidence', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  // Verify access
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { organizationId: true, createdById: true },
  });

  if (!incident || incident.organizationId !== user.organizationId) {
    throw new ValidationError('You do not have access to this incident');
  }

  const evidence = await prisma.evidence.findMany({
    where: { incidentId },
    orderBy: { uploadedAt: 'desc' },
  });

  res.json({
    success: true,
    data: evidence,
  });
}));

// POST /api/chat/:incidentId/messages/evidence - Share evidence in chat
router.post('/:incidentId/messages/evidence', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { evidenceId, comment } = req.body;
  const user = (req as any).user;

  if (!evidenceId) {
    throw new ValidationError('Evidence ID is required');
  }

  // Verify evidence exists and belongs to this incident
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
  });

  if (!evidence || evidence.incidentId !== incidentId) {
    throw new NotFoundError('Evidence not found');
  }

  // Build content with evidence details
  const evidenceTypeIcons: Record<string, string> = {
    'PHOTO': '📷',
    'VIDEO': '🎥',
    'DOCUMENT': '📄',
    'AUDIO': '🎙️',
  };
  const evidenceTypeIcon = evidenceTypeIcons[evidence.type] || '📎';
  
  let content = `${evidenceTypeIcon} Evidence Shared\n📁 ${evidence.fileName}`;
  if (evidence.transcription) {
    content += `\n📝 ${evidence.transcription.substring(0, 200)}${evidence.transcription.length > 200 ? '...' : ''}`;
  }
  if (comment && comment.trim()) {
    content += `\n\n💬 Comment: ${comment.trim()}`;
  }

  // Create message with evidence link
  const message = await prisma.chatMessage.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      userId: user.id,
      content,
      messageType: 'EVIDENCE_LINK',
      evidenceId,
      readBy: [user.id],
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
      ChatMessageReaction: true,
    },
  });

  // Include the evidence data in response
  const messageWithEvidence = {
    ...message,
    Evidence: {
      id: evidence.id,
      type: evidence.type,
      fileName: evidence.fileName,
      filePath: evidence.filePath,
      mimeType: evidence.mimeType,
      fileSize: evidence.fileSize,
      transcription: evidence.transcription,
    },
  };
  
  // Broadcast evidence message to all users in the incident room via WebSocket
  websocketService.emitToIncident(incidentId, 'chat:message', messageWithEvidence);
  console.log(`[Chat] Broadcasted evidence message ${message.id} to incident ${incidentId}`);

  res.json({
    success: true,
    data: messageWithEvidence,
  });
}));

// GET /api/chat/:incidentId/rca - Get RCA data for linking in chat
router.get('/:incidentId/rca', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  // Verify access
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { organizationId: true },
  });

  if (!incident || incident.organizationId !== user.organizationId) {
    throw new ValidationError('You do not have access to this incident');
  }

  const rcaAnalyses = await prisma.rCAAnalysis.findMany({
    where: { incidentId },
    select: {
      id: true,
      method: true,
      status: true,
      rootCauseStatement: true,
      fiveWhysData: true,
      fishboneData: true,
      createdAt: true,
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: rcaAnalyses,
  });
}));

// POST /api/chat/:incidentId/messages/rca - Share RCA finding in chat
router.post('/:incidentId/messages/rca', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { rcaAnalysisId, rcaItemType, rcaItemId, comment } = req.body;
  const user = (req as any).user;

  if (!rcaAnalysisId) {
    throw new ValidationError('RCA Analysis ID is required');
  }

  // Verify RCA exists and belongs to this incident
  const rcaAnalysis = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaAnalysisId },
    select: {
      id: true,
      incidentId: true,
      method: true,
      rootCauseStatement: true,
      fiveWhysData: true,
      fishboneData: true,
    },
  });

  if (!rcaAnalysis || rcaAnalysis.incidentId !== incidentId) {
    throw new NotFoundError('RCA Analysis not found');
  }

  // Generate content based on what's being shared - include actual RCA content
  let sharedContent = '';
  let contentTitle = '';
  
  if (rcaItemType === 'root_cause' && rcaAnalysis.rootCauseStatement) {
    contentTitle = '🎯 Root Cause';
    sharedContent = rcaAnalysis.rootCauseStatement;
  } else if (rcaItemType === '5why_step' && rcaItemId && rcaAnalysis.fiveWhysData) {
    const fiveWhysData = rcaAnalysis.fiveWhysData as any;
    const stepIndex = parseInt(rcaItemId.replace('step_', ''));
    const step = fiveWhysData?.steps?.[stepIndex];
    if (step) {
      contentTitle = `❓ Why ${stepIndex + 1}`;
      sharedContent = `Q: ${step.question || 'Why?'}\nA: ${step.answer}`;
    } else {
      contentTitle = '❓ 5-Why Finding';
      sharedContent = 'Shared from 5-Whys analysis';
    }
  } else if (rcaItemType === 'fishbone_problem' && rcaAnalysis.fishboneData) {
    const fishboneData = rcaAnalysis.fishboneData as any;
    if (fishboneData?.problem) {
      contentTitle = '🐟 Fishbone Problem Statement';
      sharedContent = fishboneData.problem;
    } else {
      contentTitle = '🐟 Fishbone Analysis';
      sharedContent = 'Problem statement shared';
    }
  } else if (rcaItemType === 'fishbone_cause' && rcaItemId && rcaAnalysis.fishboneData) {
    const fishboneData = rcaAnalysis.fishboneData as any;
    // Search through categories to find the cause
    let foundCause = null;
    let foundCategory = '';
    if (fishboneData?.categories) {
      for (const category of fishboneData.categories) {
        const cause = category.causes?.find((c: any) => c.id === rcaItemId);
        if (cause) {
          foundCause = cause;
          foundCategory = category.name;
          break;
        }
      }
    }
    if (foundCause) {
      contentTitle = `🐟 Fishbone: ${foundCategory}`;
      sharedContent = foundCause.text;
      if (foundCause.isValidRootCause) {
        sharedContent += `\n✓ Identified as Root Cause (${Math.round((foundCause.confidence || 0) * 100)}% confidence)`;
      }
    } else {
      contentTitle = '🐟 Fishbone Cause';
      sharedContent = 'Shared from Fishbone analysis';
    }
  } else if (rcaItemType === 'fishbone_cause_5why' && rcaItemId && rcaAnalysis.fishboneData) {
    // Handle fishbone cause 5-why step: format is causeId_step_stepIndex
    const fishboneData = rcaAnalysis.fishboneData as any;
    const parts = rcaItemId.split('_step_');
    const causeId = parts[0];
    const stepIndex = parseInt(parts[1]);
    
    let foundStep = null;
    let foundCause = null;
    let foundCategory = '';
    
    if (fishboneData?.categories) {
      for (const category of fishboneData.categories) {
        const cause = category.causes?.find((c: any) => c.id === causeId);
        if (cause?.fiveWhysAnalysis?.steps?.[stepIndex]) {
          foundStep = cause.fiveWhysAnalysis.steps[stepIndex];
          foundCause = cause;
          foundCategory = category.name;
          break;
        }
      }
    }
    
    if (foundStep && foundCause) {
      contentTitle = `❓ Fishbone 5-Why (${foundCategory})`;
      sharedContent = `Cause: ${foundCause.text}\nWhy ${foundStep.stepNumber}: ${foundStep.answer}`;
    } else {
      contentTitle = '❓ Fishbone 5-Why';
      sharedContent = 'Shared from Fishbone 5-Whys analysis';
    }
  } else if (rcaItemType === 'fishbone_cause_root' && rcaItemId && rcaAnalysis.fishboneData) {
    // Handle fishbone cause root cause
    const fishboneData = rcaAnalysis.fishboneData as any;
    
    let foundCause = null;
    let foundCategory = '';
    
    if (fishboneData?.categories) {
      for (const category of fishboneData.categories) {
        const cause = category.causes?.find((c: any) => c.id === rcaItemId);
        if (cause?.fiveWhysAnalysis?.rootCause) {
          foundCause = cause;
          foundCategory = category.name;
          break;
        }
      }
    }
    
    if (foundCause && foundCause.fiveWhysAnalysis) {
      contentTitle = `🎯 Fishbone Root Cause (${foundCategory})`;
      sharedContent = `Cause: ${foundCause.text}\nRoot Cause: ${foundCause.fiveWhysAnalysis.rootCause}\nConfidence: ${Math.round(foundCause.fiveWhysAnalysis.confidence * 100)}%`;
    } else {
      contentTitle = '🎯 Fishbone Root Cause';
      sharedContent = 'Shared from Fishbone analysis';
    }
  } else {
    contentTitle = `📊 RCA Analysis (${rcaAnalysis.method})`;
    sharedContent = rcaAnalysis.rootCauseStatement || 'Analysis shared';
  }

  // Build final content with both the RCA content and the optional comment
  let content = `${contentTitle}\n${sharedContent}`;
  if (comment && comment.trim()) {
    content += `\n\n💬 Comment: ${comment.trim()}`;
  }

  const message = await prisma.chatMessage.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      userId: user.id,
      content,
      messageType: 'RCA_LINK',
      rcaAnalysisId,
      rcaItemType,
      rcaItemId,
      readBy: [user.id],
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
      ChatMessageReaction: true,
    },
  });

  // Include RCA data in response
  const messageWithRCA = {
    ...message,
    RCAAnalysis: {
      id: rcaAnalysis.id,
      method: rcaAnalysis.method,
      rootCauseStatement: rcaAnalysis.rootCauseStatement,
    },
  };

  // Broadcast RCA message to all users in the incident room via WebSocket
  websocketService.emitToIncident(incidentId, 'chat:message', messageWithRCA);
  console.log(`[Chat] Broadcasted RCA message ${message.id} to incident ${incidentId}`);

  res.json({
    success: true,
    data: messageWithRCA,
  });
}));

// POST /api/chat/:incidentId/messages/:messageId/create-action - Create CAPA from chat message
router.post('/:incidentId/messages/:messageId/create-action', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;
  const { title, description, actionType, priority, dueDate, ownerId } = req.body;
  const user = (req as any).user;

  // Verify message exists
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: {
      Incident: {
        select: { organizationId: true },
      },
    },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  if (message.actionItemId) {
    throw new ValidationError('This message already has an action item');
  }

  // Verify owner exists and is in the organization
  const owner = await prisma.user.findUnique({
    where: { id: ownerId || user.id },
    select: { id: true, organizationId: true },
  });

  if (!owner || owner.organizationId !== message.Incident.organizationId) {
    throw new ValidationError('Invalid owner');
  }

  // Get RCA analysis for this incident (if exists)
  const rcaAnalysis = await prisma.rCAAnalysis.findFirst({
    where: { incidentId },
    orderBy: { createdAt: 'desc' },
  });

  // Create CAPA action
  const capaAction = await prisma.cAPAction.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      title: title || message.content.substring(0, 100),
      description: description || message.content,
      actionType: actionType || 'CORRECTIVE',
      priority: priority || 'MEDIUM',
      status: 'PLANNED',
      ownerId: ownerId || user.id,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
      rcaAnalysisId: rcaAnalysis?.id,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Update message with action item reference
  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { actionItemId: capaAction.id },
  });

  // Create notification message in chat
  await prisma.chatMessage.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      userId: user.id,
      content: `Created action item: "${capaAction.title}" assigned to ${capaAction.User.firstName} ${capaAction.User.lastName}`,
      messageType: 'ACTION_ITEM',
      actionItemId: capaAction.id,
      readBy: [user.id],
    },
  });

  res.json({
    success: true,
    data: capaAction,
  });
}));

// POST /api/chat/:incidentId/messages/handoff - Create shift handoff message
router.post('/:incidentId/messages/handoff', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { shiftFrom, shiftTo, checklist, notes, assignToUserId } = req.body;
  const user = (req as any).user;

  if (!shiftFrom || !shiftTo) {
    throw new ValidationError('Shift information is required');
  }

  // Verify user has access to this incident
  const participant = await prisma.incidentParticipant.findFirst({
    where: {
      incidentId,
      userId: user.id,
      isActive: true,
    },
  });

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { createdById: true, organizationId: true },
  });

  const isCreator = incident?.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER', 'SAFETY_SECURITY_MANAGER'].includes(user.role);
  const isSameOrg = incident?.organizationId === user.organizationId;

  if (!participant && !isCreator && !isAdmin && !isSameOrg) {
    throw new ValidationError('You are not a participant in this incident');
  }

  // Build handoff content with checklist
  let handoffContent = `🔄 SHIFT HANDOFF\n\n📤 From: ${shiftFrom}\n📥 To: ${shiftTo}`;
  
  // Add checklist summary if provided (now with status indicators)
  if (checklist && checklist.length > 0) {
    const acknowledgedItems = checklist.filter((item: any) => item.completed).length;
    handoffContent += `\n\n📋 Progress Review: ${acknowledgedItems}/${checklist.length} items briefed`;
    
    checklist.forEach((item: any) => {
      // Status icon based on actual progress status
      let statusIcon = '○'; // pending
      if (item.status === 'complete') statusIcon = '✅';
      else if (item.status === 'in-progress') statusIcon = '🔄';
      
      // Briefed indicator
      const briefedIcon = item.completed ? '☑️' : '⬜';
      
      handoffContent += `\n  ${briefedIcon} ${statusIcon} ${item.text}`;
      if (item.details) {
        handoffContent += `\n      └─ ${item.details}`;
      }
    });
  }
  
  if (notes && notes.trim()) {
    handoffContent += `\n\n📝 Notes:\n${notes.trim()}`;
  }

  const handoffData = {
    shiftFrom,
    shiftTo,
    checklist: checklist || [],
    notes,
    handoffBy: user.id,
    handoffAt: new Date().toISOString(),
  };

  const message = await prisma.chatMessage.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      userId: user.id,
      content: handoffContent,
      messageType: 'HANDOFF',
      handoffData,
      readBy: [user.id],
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
      ChatMessageReaction: true,
    },
  });

  // Create notification for the receiving user if specified
  if (assignToUserId) {
    await prisma.notification.create({
      data: {
        id: uuidv4(),
        type: 'INCIDENT_UPDATED',
        title: 'Shift Handoff',
        message: `${user.firstName} ${user.lastName} handed off incident to ${shiftTo} shift`,
        userId: assignToUserId,
        incidentId,
      },
    });
  }

  // Broadcast handoff message to all users in the incident room via WebSocket
  websocketService.emitToIncident(incidentId, 'chat:message', message);
  console.log(`[Chat] Broadcasted handoff message ${message.id} to incident ${incidentId}`);

  res.json({
    success: true,
    data: message,
  });
}));

// POST /api/chat/:incidentId/messages/decision - Mark message as decision
router.post('/:incidentId/messages/:messageId/decision', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;
  const user = (req as any).user;

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: {
      Incident: {
        select: { createdById: true },
      },
    },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  // Check permission - only message owner, incident owner, or admin can mark as decision
  const isOwner = message.userId === user.id;
  const isIncidentOwner = message.Incident.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'].includes(user.role);

  if (!isOwner && !isIncidentOwner && !isAdmin) {
    throw new ValidationError('You do not have permission to mark this as a decision');
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      messageType: 'DECISION',
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
      ChatMessageReaction: true,
    },
  });

  res.json({
    success: true,
    data: updated,
  });
}));

// POST /api/chat/:incidentId/messages/question - Create a question message
router.post('/:incidentId/messages/question', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { content } = req.body;
  const user = (req as any).user;

  if (!content || content.trim().length === 0) {
    throw new ValidationError('Question content is required');
  }

  // Verify user has access to this incident
  const participant = await prisma.incidentParticipant.findFirst({
    where: {
      incidentId,
      userId: user.id,
      isActive: true,
    },
  });

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { createdById: true, organizationId: true },
  });

  const isCreator = incident?.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER', 'SAFETY_SECURITY_MANAGER'].includes(user.role);
  const isSameOrg = incident?.organizationId === user.organizationId;

  if (!participant && !isCreator && !isAdmin && !isSameOrg) {
    throw new ValidationError('You are not a participant in this incident');
  }

  const message = await prisma.chatMessage.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      userId: user.id,
      content: content.trim(),
      messageType: 'QUESTION',
      questionData: {
        isResolved: false,
        askedBy: user.id,
        askedAt: new Date().toISOString(),
      },
      readBy: [user.id],
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
      ChatMessageReaction: true,
    },
  });

  // Broadcast question message to all users in the incident room via WebSocket
  websocketService.emitToIncident(incidentId, 'chat:message', message);
  console.log(`[Chat] Broadcasted question message ${message.id} to incident ${incidentId}`);

  res.status(201).json({
    success: true,
    data: message,
  });
}));

// POST /api/chat/:incidentId/messages/:messageId/resolve-question - Resolve a question
router.post('/:incidentId/messages/:messageId/resolve-question', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;
  const { answer } = req.body;
  const user = (req as any).user;

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  if (message.messageType !== 'QUESTION') {
    throw new ValidationError('This message is not a question');
  }

  const questionData = message.questionData as any || {};
  if (questionData.isResolved) {
    throw new ValidationError('This question has already been resolved');
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      questionData: {
        ...questionData,
        isResolved: true,
        resolvedBy: user.id,
        resolvedAt: new Date().toISOString(),
        answer: answer?.trim() || null,
      },
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
      ChatMessageReaction: true,
    },
  });

  // Enrich with resolver user info and broadcast update
  const enrichedUpdate = {
    ...updated,
    questionData: {
      ...(updated.questionData as any),
      resolvedByUser: { id: user.id, firstName: user.firstName, lastName: user.lastName },
    },
  };
  websocketService.emitToIncident(incidentId, 'chat:message:updated', enrichedUpdate);
  console.log(`[Chat] Broadcasted question resolved ${messageId} to incident ${incidentId}`);

  res.json({
    success: true,
    data: enrichedUpdate,
  });
}));

// POST /api/chat/:incidentId/messages/:messageId/reopen-question - Reopen a resolved question
router.post('/:incidentId/messages/:messageId/reopen-question', asyncHandler(async (req, res) => {
  const { incidentId, messageId } = req.params;
  const user = (req as any).user;

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });

  if (!message || message.incidentId !== incidentId) {
    throw new NotFoundError('Message not found');
  }

  if (message.messageType !== 'QUESTION') {
    throw new ValidationError('This message is not a question');
  }

  const questionData = message.questionData as any || {};
  if (!questionData.isResolved) {
    throw new ValidationError('This question is not resolved');
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      questionData: {
        ...questionData,
        isResolved: false,
        resolvedBy: null,
        resolvedAt: null,
        reopenedBy: user.id,
        reopenedAt: new Date().toISOString(),
      },
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
      ChatMessageReaction: true,
    },
  });

  // Enrich with reopener user info and broadcast update
  const enrichedUpdate = {
    ...updated,
    questionData: {
      ...(updated.questionData as any),
      reopenedByUser: { id: user.id, firstName: user.firstName, lastName: user.lastName },
    },
  };
  websocketService.emitToIncident(incidentId, 'chat:message:updated', enrichedUpdate);
  console.log(`[Chat] Broadcasted question reopened ${messageId} to incident ${incidentId}`);

  res.json({
    success: true,
    data: enrichedUpdate,
  });
}));

// POST /api/chat/:incidentId/messages/update - Create an update message
router.post('/:incidentId/messages/update', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { content, category = 'progress', priority = 'normal' } = req.body;
  const user = (req as any).user;

  if (!content || content.trim().length === 0) {
    throw new ValidationError('Update content is required');
  }

  const validCategories = ['progress', 'blocker', 'milestone', 'general'];
  if (!validCategories.includes(category)) {
    throw new ValidationError('Invalid update category');
  }

  const validPriorities = ['low', 'normal', 'high'];
  if (!validPriorities.includes(priority)) {
    throw new ValidationError('Invalid priority');
  }

  // Verify user has access to this incident
  const participant = await prisma.incidentParticipant.findFirst({
    where: {
      incidentId,
      userId: user.id,
      isActive: true,
    },
  });

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { createdById: true, organizationId: true },
  });

  const isCreator = incident?.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER', 'SAFETY_SECURITY_MANAGER'].includes(user.role);
  const isSameOrg = incident?.organizationId === user.organizationId;

  if (!participant && !isCreator && !isAdmin && !isSameOrg) {
    throw new ValidationError('You are not a participant in this incident');
  }

  const message = await prisma.chatMessage.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      userId: user.id,
      content: content.trim(),
      messageType: 'UPDATE',
      updateData: {
        category,
        priority,
        postedBy: user.id,
        postedAt: new Date().toISOString(),
      },
      readBy: [user.id],
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
      ChatMessageReaction: true,
    },
  });

  // Broadcast update message to all users in the incident room via WebSocket
  websocketService.emitToIncident(incidentId, 'chat:message', message);
  console.log(`[Chat] Broadcasted update message ${message.id} to incident ${incidentId}`);

  res.status(201).json({
    success: true,
    data: message,
  });
}));

// POST /api/chat/:incidentId/messages/announcement - Create an announcement
router.post('/:incidentId/messages/announcement', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { content, priority = 'normal', expiresAt } = req.body;
  const user = (req as any).user;

  if (!content || content.trim().length === 0) {
    throw new ValidationError('Announcement content is required');
  }

  const validPriorities = ['normal', 'important', 'urgent'];
  if (!validPriorities.includes(priority)) {
    throw new ValidationError('Invalid priority');
  }

  // Verify user is a participant with sufficient role (Lead or above)
  const participant = await prisma.incidentParticipant.findFirst({
    where: {
      incidentId,
      userId: user.id,
      isActive: true,
    },
  });

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { createdById: true },
  });

  const isCreator = incident?.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'].includes(user.role);
  const isLead = participant?.role === 'LEAD' || participant?.role === 'OWNER';

  if (!isCreator && !isAdmin && !isLead) {
    throw new ValidationError('Only team leads, owners, or admins can post announcements');
  }

  const message = await prisma.chatMessage.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      userId: user.id,
      content: content.trim(),
      messageType: 'ANNOUNCEMENT',
      announcementData: {
        priority,
        postedBy: user.id,
        postedAt: new Date().toISOString(),
        expiresAt: expiresAt || null,
      },
      readBy: [user.id],
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
        },
      },
      ChatMessageReaction: true,
    },
  });

  // Notify all participants about the announcement
  const participants = await prisma.incidentParticipant.findMany({
    where: {
      incidentId,
      userId: { not: user.id },
      isActive: true,
    },
    select: { userId: true },
  });

  if (participants.length > 0) {
    const priorityText = priority === 'urgent' ? '🚨 URGENT: ' : priority === 'important' ? '⚠️ ' : '';
    await prisma.notification.createMany({
      data: participants.map(p => ({
        id: uuidv4(),
        type: 'COMMENT_ADDED' as const,
        title: `${priorityText}Team Announcement`,
        message: `${user.firstName} ${user.lastName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
        userId: p.userId,
        incidentId,
      })),
    });
  }

  // Broadcast announcement message to all users in the incident room via WebSocket
  websocketService.emitToIncident(incidentId, 'chat:message', message);
  console.log(`[Chat] Broadcasted announcement message ${message.id} to incident ${incidentId}`);

  res.status(201).json({
    success: true,
    data: message,
  });
}));

// GET /api/chat/:incidentId/questions - Get all questions (open and resolved)
router.get('/:incidentId/questions', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { status } = req.query; // 'open', 'resolved', or undefined for all
  const user = (req as any).user;

  // Verify access
  const participant = await prisma.incidentParticipant.findFirst({
    where: {
      incidentId,
      userId: user.id,
      isActive: true,
    },
  });

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { createdById: true },
  });

  if (!participant && incident?.createdById !== user.id) {
    throw new ValidationError('You do not have access to this incident');
  }

  const questions = await prisma.chatMessage.findMany({
    where: {
      incidentId,
      messageType: 'QUESTION',
      isDeleted: false,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      ChatMessageReaction: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter by status if specified
  let filteredQuestions = questions;
  if (status === 'open') {
    filteredQuestions = questions.filter(q => {
      const data = q.questionData as any;
      return !data?.isResolved;
    });
  } else if (status === 'resolved') {
    filteredQuestions = questions.filter(q => {
      const data = q.questionData as any;
      return data?.isResolved;
    });
  }

  res.json({
    success: true,
    data: filteredQuestions,
    summary: {
      total: questions.length,
      open: questions.filter(q => !(q.questionData as any)?.isResolved).length,
      resolved: questions.filter(q => (q.questionData as any)?.isResolved).length,
    },
  });
}));

// GET /api/chat/:incidentId/decisions - Get all decision messages
router.get('/:incidentId/decisions', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  // Verify access
  const participant = await prisma.incidentParticipant.findFirst({
    where: {
      incidentId,
      userId: user.id,
      isActive: true,
    },
  });

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { createdById: true },
  });

  if (!participant && incident?.createdById !== user.id) {
    throw new ValidationError('You do not have access to this incident');
  }

  const decisions = await prisma.chatMessage.findMany({
    where: {
      incidentId,
      messageType: 'DECISION',
      isDeleted: false,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      ChatMessageReaction: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: decisions,
  });
}));

// GET /api/chat/:incidentId/announcements - Get active announcements
router.get('/:incidentId/announcements', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { includeExpired } = req.query;
  const user = (req as any).user;

  // Verify access
  const participant = await prisma.incidentParticipant.findFirst({
    where: {
      incidentId,
      userId: user.id,
      isActive: true,
    },
  });

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { createdById: true },
  });

  if (!participant && incident?.createdById !== user.id) {
    throw new ValidationError('You do not have access to this incident');
  }

  const announcements = await prisma.chatMessage.findMany({
    where: {
      incidentId,
      messageType: 'ANNOUNCEMENT',
      isDeleted: false,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      ChatMessageReaction: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter out expired announcements unless includeExpired is true
  let filteredAnnouncements = announcements;
  if (!includeExpired) {
    const now = new Date();
    filteredAnnouncements = announcements.filter(a => {
      const data = a.announcementData as any;
      if (!data?.expiresAt) return true;
      return new Date(data.expiresAt) > now;
    });
  }

  res.json({
    success: true,
    data: filteredAnnouncements,
  });
}));

// Helper function to create status update message (exported for use in incident routes)
export async function createStatusUpdateMessage(
  incidentId: string,
  userId: string,
  fromStatus: string,
  toStatus: string
) {
  const statusChange = {
    from: fromStatus,
    to: toStatus,
    changedBy: userId,
    changedAt: new Date().toISOString(),
  };

  return prisma.chatMessage.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      userId,
      content: `Status changed from ${fromStatus} to ${toStatus}`,
      messageType: 'STATUS_UPDATE',
      statusChange,
      readBy: [userId],
    },
  });
}

// GET /api/chat/:incidentId/handoff-progress - Get incident progress for handoff checklist
router.get('/:incidentId/handoff-progress', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  // Verify user has access to this incident
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      Category: { select: { name: true } },
      Facility: { select: { name: true } },
      Department: { select: { name: true } },
      Area: { select: { name: true } },
      Line: { select: { name: true } },
      Shift: { select: { name: true } },
      User_Incident_assignedToIdToUser: { select: { firstName: true, lastName: true } },
      IncidentParticipant: {
        where: { isActive: true },
        include: {
          User_IncidentParticipant_userIdToUser: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      Evidence: {
        select: { id: true, type: true, fileName: true },
      },
      RCAAnalysis: {
        include: {
          Evidence: { select: { id: true, type: true, fileName: true } },
          CAPAction: {
            select: { id: true, status: true, title: true },
          },
        },
      },
    },
  });

  if (!incident) {
    throw new NotFoundError('Incident not found');
  }

  // Check access
  const isCreator = incident.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER', 'SAFETY_SECURITY_MANAGER'].includes(user.role);
  const isParticipant = incident.IncidentParticipant?.some((p: any) => p.userId === user.id);
  const isSameOrg = incident.organizationId === user.organizationId;

  if (!isCreator && !isAdmin && !isParticipant && !isSameOrg) {
    throw new ValidationError('You do not have access to this incident');
  }

  // Calculate progress for each category
  const progressItems = [];

  // 1. Incident Details - Check if key fields are filled
  const incidentDetailsComplete = !!(
    incident.description &&
    incident.categoryId &&
    incident.facilityId &&
    incident.severity
  );
  progressItems.push({
    id: 'incident-details',
    category: 'Incident Details',
    text: 'Incident details complete',
    status: incidentDetailsComplete ? 'complete' : 'incomplete',
    details: incidentDetailsComplete 
      ? `${incident.Category?.name || 'Unknown'} at ${incident.Facility?.name || 'Unknown'}`
      : 'Missing required fields',
  });

  // 2. Evidence Collection
  const allEvidence = [
    ...(incident.Evidence || []),
    ...(incident.RCAAnalysis || []).flatMap((rca: any) => rca.Evidence || []),
  ];
  const evidenceCount = allEvidence.length;
  progressItems.push({
    id: 'evidence',
    category: 'Evidence',
    text: `Evidence collected`,
    status: evidenceCount > 0 ? 'complete' : 'incomplete',
    details: evidenceCount > 0 
      ? `${evidenceCount} file(s) uploaded`
      : 'No evidence uploaded yet',
    count: evidenceCount,
  });

  // 3. RCA Analysis Progress
  const rcaAnalysis = incident.RCAAnalysis[0]; // Primary RCA
  if (rcaAnalysis) {
    // 5-Why Analysis
    const fiveWhysData = rcaAnalysis.fiveWhysData as any;
    let whysCompleted = 0;
    let totalWhys = 5;
    if (fiveWhysData?.whys && Array.isArray(fiveWhysData.whys)) {
      whysCompleted = fiveWhysData.whys.filter((w: any) => w.question && w.answer).length;
    }
    progressItems.push({
      id: '5-why-analysis',
      category: '5-Why Analysis',
      text: '5-Why analysis progress',
      status: whysCompleted >= 3 ? 'complete' : whysCompleted > 0 ? 'in-progress' : 'incomplete',
      details: `${whysCompleted}/${totalWhys} completed`,
      count: whysCompleted,
      total: totalWhys,
    });

    // Fishbone Analysis
    const fishboneData = rcaAnalysis.fishboneData as any;
    let fishboneCategoriesFilled = 0;
    const fishboneCategories = ['equipment', 'process', 'people', 'materials', 'environment', 'management'];
    if (fishboneData) {
      fishboneCategoriesFilled = fishboneCategories.filter(cat => {
        const items = fishboneData[cat];
        return items && Array.isArray(items) && items.length > 0;
      }).length;
    }
    progressItems.push({
      id: 'fishbone-analysis',
      category: 'Fishbone Analysis',
      text: 'Fishbone diagram progress',
      status: fishboneCategoriesFilled >= 3 ? 'complete' : fishboneCategoriesFilled > 0 ? 'in-progress' : 'incomplete',
      details: `${fishboneCategoriesFilled}/${fishboneCategories.length} categories filled`,
      count: fishboneCategoriesFilled,
      total: fishboneCategories.length,
    });

    // Root Cause Identified
    progressItems.push({
      id: 'root-cause',
      category: 'Root Cause',
      text: 'Root cause identified',
      status: rcaAnalysis.rootCauseStatement ? 'complete' : 'incomplete',
      details: rcaAnalysis.rootCauseStatement 
        ? rcaAnalysis.rootCauseStatement.substring(0, 100) + (rcaAnalysis.rootCauseStatement.length > 100 ? '...' : '')
        : 'Not yet identified',
    });

    // Corrective Actions
    const capActions = rcaAnalysis.CAPAction || [];
    const completedActions = capActions.filter(a => a.status === 'COMPLETED' || a.status === 'VERIFIED').length;
    const totalActions = capActions.length;
    progressItems.push({
      id: 'corrective-actions',
      category: 'Corrective Actions',
      text: 'Corrective actions',
      status: totalActions === 0 ? 'incomplete' : completedActions === totalActions ? 'complete' : 'in-progress',
      details: totalActions > 0 
        ? `${completedActions}/${totalActions} completed`
        : 'No actions defined yet',
      count: completedActions,
      total: totalActions,
    });

    // RCA Validated
    progressItems.push({
      id: 'rca-validated',
      category: 'RCA Validation',
      text: 'RCA validated',
      status: rcaAnalysis.isValidated ? 'complete' : 'incomplete',
      details: rcaAnalysis.isValidated 
        ? `Validated on ${new Date(rcaAnalysis.validatedAt!).toLocaleDateString()}`
        : 'Pending validation',
    });
  } else {
    // No RCA started
    progressItems.push({
      id: 'rca-started',
      category: 'RCA Analysis',
      text: 'RCA analysis started',
      status: 'incomplete',
      details: 'RCA analysis not yet initiated',
    });
  }

  // 4. Team Communication
  const participantCount = incident.IncidentParticipant?.length || 0;
  progressItems.push({
    id: 'team-involvement',
    category: 'Team',
    text: 'Team members involved',
    status: participantCount > 1 ? 'complete' : 'incomplete',
    details: `${participantCount} participant(s) active`,
    count: participantCount,
  });

  // 5. Incident Status
  const assignedTo = (incident as any).User_Incident_assignedToIdToUser;
  progressItems.push({
    id: 'incident-status',
    category: 'Status',
    text: `Incident status: ${incident.status}`,
    status: ['CLOSED', 'RESOLVED', 'IN_REVIEW'].includes(incident.status) ? 'complete' : 'in-progress',
    details: assignedTo 
      ? `Assigned to ${assignedTo.firstName} ${assignedTo.lastName}`
      : 'Not assigned',
  });

  res.json({
    success: true,
    data: {
      incidentId,
      incidentNumber: incident.incidentNumber,
      incidentStatus: incident.status,
      progressItems,
      summary: {
        complete: progressItems.filter(p => p.status === 'complete').length,
        inProgress: progressItems.filter(p => p.status === 'in-progress').length,
        incomplete: progressItems.filter(p => p.status === 'incomplete').length,
        total: progressItems.length,
      },
    },
  });
}));

// =============================================================================
// PHASE 4: RICH CONTENT
// =============================================================================

// POST /api/chat/:incidentId/upload - Upload file/image/voice to chat
router.post('/:incidentId/upload', upload.single('file'), handleMulterError, asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { caption, messageType } = req.body;
  const user = (req as any).user;
  const file = req.file;

  if (!file) {
    throw new ValidationError('No file uploaded');
  }

  // Verify user is a participant
  const participant = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: { incidentId, userId: user.id },
    },
  });

  if (!participant?.isActive) {
    throw new ValidationError('You are not a participant in this incident');
  }

  // Upload file to Firebase Storage (like evidence uploads)
  const bucket = adminStorage.bucket();
  const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
  const uniqueFileName = `chat/${incidentId}/${uuidv4()}${fileExtension}`;
  const firebaseFile = bucket.file(uniqueFileName);

  // Upload the file from memory buffer (cloud-compatible)
  await firebaseFile.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
    },
  });

  // Make the file publicly accessible
  await firebaseFile.makePublic();

  // Get the public URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;

  // Determine message type based on file mime type
  let determinedMessageType: 'FILE' | 'IMAGE' | 'VOICE' = 'FILE';
  if (file.mimetype.startsWith('image/')) {
    determinedMessageType = 'IMAGE';
  } else if (file.mimetype.startsWith('audio/')) {
    determinedMessageType = 'VOICE' as any; // Voice messages
  }

  // Use provided messageType if valid, otherwise use determined type
  const finalMessageType = messageType === 'VOICE' ? 'FILE' : (messageType || determinedMessageType);
  const isVoiceMessage = messageType === 'VOICE' || file.mimetype.startsWith('audio/');

  // Create attachment data with Firebase URL
  const attachmentData = {
    fileName: file.originalname,
    filePath: publicUrl,
    fileUrl: publicUrl,
    mimeType: file.mimetype,
    fileSize: file.size,
    isVoiceMessage,
    firebasePath: uniqueFileName,
  };

  // Also create Evidence record for images/files to tie to incident
  if (determinedMessageType === 'IMAGE' || determinedMessageType === 'FILE') {
    // Determine evidence type based on mime type
    let evidenceType: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'VOICE_RECORDING' = 'DOCUMENT';
    if (file.mimetype.startsWith('image/')) {
      evidenceType = 'PHOTO';
    } else if (file.mimetype.startsWith('video/')) {
      evidenceType = 'VIDEO';
    } else if (file.mimetype.startsWith('audio/')) {
      evidenceType = 'VOICE_RECORDING';
    }

    await prisma.evidence.create({
      data: {
        id: uuidv4(),
        incidentId,
        type: evidenceType,
        fileName: file.originalname,
        filePath: publicUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: user.id,
      },
    });
  }

  // Create the message
  const message = await prisma.chatMessage.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      userId: user.id,
      content: caption || (isVoiceMessage ? '🎤 Voice message' : file.originalname),
      messageType: finalMessageType as any,
      attachments: attachmentData,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
          profilePicture: true,
        },
      },
      ChatMessageReaction: {
        include: {
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  // Broadcast via WebSocket - use 'chat:message' to match frontend listener
  websocketService.emitToIncident(incidentId, 'chat:message', message);

  res.status(201).json({
    success: true,
    data: message,
  });
}));

// POST /api/chat/:incidentId/upload-multiple - Upload multiple files at once
router.post('/:incidentId/upload-multiple', upload.array('files', 10), handleMulterError, asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { caption } = req.body;
  const user = (req as any).user;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    throw new ValidationError('No files uploaded');
  }

  // Verify user is a participant
  const participant = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: { incidentId, userId: user.id },
    },
  });

  if (!participant?.isActive) {
    throw new ValidationError('You are not a participant in this incident');
  }

  const messages = [];
  const bucket = adminStorage.bucket();

  for (const file of files) {
    // Upload file to Firebase Storage
    const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
    const uniqueFileName = `chat/${incidentId}/${uuidv4()}${fileExtension}`;
    const firebaseFile = bucket.file(uniqueFileName);

    // Upload the file from memory buffer (cloud-compatible)
    await firebaseFile.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    // Make the file publicly accessible
    await firebaseFile.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;

    // Determine message type based on file mime type
    let messageType: 'FILE' | 'IMAGE' = 'FILE';
    if (file.mimetype.startsWith('image/')) {
      messageType = 'IMAGE';
    }

    // Create attachment data with Firebase URL
    const attachmentData = {
      fileName: file.originalname,
      filePath: publicUrl,
      fileUrl: publicUrl,
      mimeType: file.mimetype,
      fileSize: file.size,
      firebasePath: uniqueFileName,
    };

    // Also create Evidence record for images/files
    // Determine evidence type based on mime type
    let evidenceType: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'VOICE_RECORDING' = 'DOCUMENT';
    if (file.mimetype.startsWith('image/')) {
      evidenceType = 'PHOTO';
    } else if (file.mimetype.startsWith('video/')) {
      evidenceType = 'VIDEO';
    } else if (file.mimetype.startsWith('audio/')) {
      evidenceType = 'VOICE_RECORDING';
    }

    await prisma.evidence.create({
      data: {
        id: uuidv4(),
        incidentId,
        type: evidenceType,
        fileName: file.originalname,
        filePath: publicUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: user.id,
      },
    });

    // Create the message
    const message = await prisma.chatMessage.create({
      data: {
        id: uuidv4(),
        updatedAt: new Date(),
        incidentId,
        userId: user.id,
        content: caption || file.originalname,
        messageType,
        attachments: attachmentData,
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isOnline: true,
            profilePicture: true,
          },
        },
        ChatMessageReaction: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    messages.push(message);

    // Broadcast via WebSocket - use 'chat:message' to match frontend listener
    websocketService.emitToIncident(incidentId, 'chat:message', message);
  }

  res.status(201).json({
    success: true,
    data: messages,
  });
}));

// GET /api/chat/templates - Get message templates
router.get('/templates', asyncHandler(async (req, res) => {
  const user = (req as any).user;

  // Get user-specific templates
  const userTemplates = await prisma.chatMessageTemplate.findMany({
    where: {
      OR: [
        { userId: user.id },
        { isGlobal: true },
      ],
    },
    orderBy: [
      { isGlobal: 'desc' },
      { usageCount: 'desc' },
      { name: 'asc' },
    ],
  });

  // If no templates exist, return default templates
  if (userTemplates.length === 0) {
    const defaultTemplates = [
      { id: 'default-1', name: 'Status Update', category: 'updates', content: 'Current status: [status]. Next steps: [next steps].', isGlobal: true, usageCount: 0 },
      { id: 'default-2', name: 'Investigation Finding', category: 'investigation', content: 'Investigation finding: [description]. Impact: [impact level].', isGlobal: true, usageCount: 0 },
      { id: 'default-3', name: 'Action Required', category: 'actions', content: 'Action required: [action]. Deadline: [deadline]. Assigned to: [assignee].', isGlobal: true, usageCount: 0 },
      { id: 'default-4', name: 'Root Cause Identified', category: 'investigation', content: 'Root cause identified: [cause]. Contributing factors: [factors].', isGlobal: true, usageCount: 0 },
      { id: 'default-5', name: 'Escalation Notice', category: 'escalation', content: 'Escalating to [person/team]. Reason: [reason]. Priority: [priority].', isGlobal: true, usageCount: 0 },
      { id: 'default-6', name: 'Shift Handoff', category: 'handoff', content: 'Shift handoff: Current status: [status]. Pending items: [items]. Notes: [notes].', isGlobal: true, usageCount: 0 },
      { id: 'default-7', name: 'Evidence Added', category: 'evidence', content: 'New evidence added: [type]. Description: [description]. Location: [location].', isGlobal: true, usageCount: 0 },
      { id: 'default-8', name: 'Meeting Summary', category: 'meetings', content: 'Meeting summary - Attendees: [attendees]. Key decisions: [decisions]. Action items: [items].', isGlobal: true, usageCount: 0 },
    ];
    res.json({ success: true, data: defaultTemplates });
    return;
  }

  res.json({
    success: true,
    data: userTemplates,
  });
}));

// POST /api/chat/templates - Create a new template
router.post('/templates', asyncHandler(async (req, res) => {
  const { name, category, content, isGlobal = false } = req.body;
  const user = (req as any).user;

  if (!name || !content) {
    throw new ValidationError('Name and content are required');
  }

  // Only admins can create global templates
  const canCreateGlobal = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'].includes(user.role);
  const finalIsGlobal = isGlobal && canCreateGlobal;

  const template = await prisma.chatMessageTemplate.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      userId: user.id,
      name,
      category: category || 'general',
      content,
      isGlobal: finalIsGlobal,
    },
  });

  res.status(201).json({
    success: true,
    data: template,
  });
}));

// PUT /api/chat/templates/:templateId - Update a template
router.put('/templates/:templateId', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { name, category, content } = req.body;
  const user = (req as any).user;

  const template = await prisma.chatMessageTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new NotFoundError('Template not found');
  }

  // Only owner or admin can edit
  const isOwner = template.userId === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN'].includes(user.role);

  if (!isOwner && !isAdmin) {
    throw new ValidationError('You do not have permission to edit this template');
  }

  const updated = await prisma.chatMessageTemplate.update({
    where: { id: templateId },
    data: {
      ...(name && { name }),
      ...(category && { category }),
      ...(content && { content }),
    },
  });

  res.json({
    success: true,
    data: updated,
  });
}));

// DELETE /api/chat/templates/:templateId - Delete a template
router.delete('/templates/:templateId', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const user = (req as any).user;

  const template = await prisma.chatMessageTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new NotFoundError('Template not found');
  }

  // Only owner or admin can delete
  const isOwner = template.userId === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN'].includes(user.role);

  if (!isOwner && !isAdmin) {
    throw new ValidationError('You do not have permission to delete this template');
  }

  await prisma.chatMessageTemplate.delete({
    where: { id: templateId },
  });

  res.json({
    success: true,
    message: 'Template deleted successfully',
  });
}));

// POST /api/chat/templates/:templateId/use - Increment usage count
router.post('/templates/:templateId/use', asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  // Skip for default templates (those starting with 'default-')
  if (templateId.startsWith('default-')) {
    res.json({ success: true });
    return;
  }

  await prisma.chatMessageTemplate.update({
    where: { id: templateId },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  res.json({ success: true });
}));

// =====================
// ARCHIVED CHAT ROUTES
// =====================

// GET /api/chat/:incidentId/archived - Get archived chat messages for an incident
router.get('/:incidentId/archived', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  console.log(`[Chat] GET archived messages for incident ${incidentId} by user ${user.id}`);

  // Verify incident exists and user has access
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { 
      id: true, 
      organizationId: true, 
      createdById: true,
    },
  });

  if (!incident) {
    throw new NotFoundError('Incident not found');
  }

  // Check access: must be incident creator, participant, or admin
  const isCreator = incident.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER', 'SAFETY_SECURITY_MANAGER'].includes(user.role);
  const isSameOrg = incident.organizationId === user.organizationId;

  const participant = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: { incidentId, userId: user.id },
    },
  });

  if (!isCreator && !isAdmin && !participant && !isSameOrg) {
    throw new ValidationError('You do not have access to this incident\'s archived chat');
  }

  // Fetch archived messages grouped by batch
  const archivedMessages = await prisma.archivedChatMessage.findMany({
    where: { incidentId },
    orderBy: [
      { archiveBatchId: 'asc' },
      { originalCreatedAt: 'asc' },
    ],
  });

  // Group by archive batch
  const batches: Map<string, {
    archiveBatchId: string;
    archivedAt: Date;
    archiveReason: string;
    messages: typeof archivedMessages;
  }> = new Map();

  for (const msg of archivedMessages) {
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

  const result = Array.from(batches.values()).sort((a, b) => 
    a.archivedAt.getTime() - b.archivedAt.getTime()
  );

  console.log(`[Chat] Found ${archivedMessages.length} archived messages in ${result.length} batches`);

  res.json({
    success: true,
    data: {
      totalMessages: archivedMessages.length,
      batches: result,
    },
  });
}));

// GET /api/chat/:incidentId/archived/metadata - Get archive metadata (batch info without messages)
router.get('/:incidentId/archived/metadata', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  // Verify incident exists and user has access
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { organizationId: true, createdById: true },
  });

  if (!incident) {
    throw new NotFoundError('Incident not found');
  }

  const isCreator = incident.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'].includes(user.role);
  const isSameOrg = incident.organizationId === user.organizationId;

  if (!isCreator && !isAdmin && !isSameOrg) {
    throw new ValidationError('You do not have access to this incident');
  }

  // Get archive batch info
  const archives = await prisma.archivedChatMessage.groupBy({
    by: ['archiveBatchId', 'archivedAt', 'archiveReason'],
    where: { incidentId },
    _count: { id: true },
    orderBy: { archivedAt: 'asc' },
  });

  res.json({
    success: true,
    data: {
      hasArchivedMessages: archives.length > 0,
      archives: archives.map((a) => ({
        batchId: a.archiveBatchId,
        archivedAt: a.archivedAt,
        reason: a.archiveReason,
        messageCount: a._count.id,
      })),
    },
  });
}));

export default router;