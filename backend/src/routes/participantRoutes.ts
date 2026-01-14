import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { ParticipantRole } from '@prisma/client';
import { websocketService } from '../services/websocketService';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/participants/:incidentId - Get all participants for an incident
router.get('/:incidentId', async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  // Verify incident exists and user has access
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { organizationId: true },
  });

  if (!incident) {
    throw new NotFoundError('Incident not found');
  }

  if (incident.organizationId !== user.organizationId) {
    throw new ValidationError('You do not have access to this incident');
  }

  const participants = await prisma.incidentParticipant.findMany({
    where: {
      incidentId,
      isActive: true,
    },
    include: {
      User_IncidentParticipant_userIdToUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isOnline: true,
          lastSeenAt: true,
          profilePicture: true,
        },
      },
      User_IncidentParticipant_addedByIdToUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [
      { role: 'asc' },
      { joinedAt: 'asc' },
    ],
  });

  res.json({
    success: true,
    data: participants,
  });
});

// POST /api/participants/:incidentId - Add participants to an incident
router.post('/:incidentId', async (req, res) => {
  const { incidentId } = req.params;
  const { userIds, role = 'MEMBER' } = req.body;
  const user = (req as any).user;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError('userIds array is required');
  }

  // Verify incident exists and user has access
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { 
      id: true, 
      organizationId: true,
      incidentNumber: true,
      customTitle: true,
      createdById: true,
    },
  });

  if (!incident) {
    throw new NotFoundError('Incident not found');
  }

  if (incident.organizationId !== user.organizationId) {
    throw new ValidationError('You do not have access to this incident');
  }

  // Verify all users exist and are in the same organization
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      organizationId: user.organizationId,
      isActive: true,
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (users.length !== userIds.length) {
    throw new ValidationError('One or more users not found or not in your organization');
  }

  // Check existing participants - separate into different categories
  const existingParticipants = await prisma.incidentParticipant.findMany({
    where: {
      incidentId,
      userId: { in: userIds },
    },
    select: { 
      userId: true, 
      invitationStatus: true,
      isActive: true,
    },
  });

  // Categorize existing participants
  const canReInviteUserIds: string[] = [];
  const activeOrPendingUserIds = new Set<string>();
  
  for (const p of existingParticipants) {
    if (p.invitationStatus === 'DECLINED' || p.isActive === false) {
      // Can be re-invited: either explicitly declined OR removed (isActive: false)
      canReInviteUserIds.push(p.userId);
    } else {
      // Active PENDING or ACCEPTED - cannot re-invite
      activeOrPendingUserIds.add(p.userId);
    }
  }

  // Filter out users who are already active/pending, but allow re-inviting declined/removed users
  const newUserIds = userIds.filter((id: string) => !activeOrPendingUserIds.has(id) && !canReInviteUserIds.includes(id));
  const reInviteUserIds = userIds.filter((id: string) => canReInviteUserIds.includes(id));
  
  console.log(`[Participants] Categorization for incident ${incidentId}:`);
  console.log(`[Participants]   - New users to add: ${newUserIds.length}`);
  console.log(`[Participants]   - Users to re-invite: ${reInviteUserIds.length}`);
  console.log(`[Participants]   - Users skipped (already active/pending): ${activeOrPendingUserIds.size}`);

  if (newUserIds.length === 0 && reInviteUserIds.length === 0) {
    return res.json({
      success: true,
      message: 'All users are already participants with pending or accepted invitations',
      data: { added: 0, reInvited: 0, skipped: userIds.length },
    });
  }

  // Re-invite previously declined users by updating their records
  let reInvitedParticipants: any[] = [];
  if (reInviteUserIds.length > 0) {
    // Update each declined participant to PENDING status
    reInvitedParticipants = await Promise.all(
      reInviteUserIds.map(async (userId: string) => {
        return prisma.incidentParticipant.update({
          where: {
            incidentId_userId: { incidentId, userId },
          },
          data: {
            invitationStatus: 'PENDING',
            isActive: true,
            invitedAt: new Date(),
            respondedAt: null,
            addedById: user.id,
            role: role as ParticipantRole,
          },
          include: {
            User_IncidentParticipant_userIdToUser: {
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
      })
    );
  }

  // Create new participants with PENDING invitation status
  let createdParticipants: any[] = [];
  if (newUserIds.length > 0) {
    createdParticipants = await prisma.$transaction(
      newUserIds.map((userId: string) =>
        prisma.incidentParticipant.create({
          data: {
            incidentId,
            userId,
            role: role as ParticipantRole,
            addedById: user.id,
            invitationStatus: 'PENDING',
            invitedAt: new Date(),
          },
          include: {
            User_IncidentParticipant_userIdToUser: {
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
        })
      )
    );
  }

  // Combine all invited participants (new + re-invited)
  const allInvitedParticipants = [...createdParticipants, ...reInvitedParticipants];
  const allInvitedUserIds = [...newUserIds, ...reInviteUserIds];
  
  console.log(`[Participants] Adding participants to incident ${incidentId}`);
  console.log(`[Participants] New: ${newUserIds.length}, Re-invited: ${reInviteUserIds.length}, Total invited: ${allInvitedParticipants.length}`);

  // Create system chat message for invited participants
  const addedNames = allInvitedParticipants.map(p => 
    `${p.User_IncidentParticipant_userIdToUser.firstName} ${p.User_IncidentParticipant_userIdToUser.lastName}`
  ).join(', ');

  if (allInvitedParticipants.length > 0) {
    const messagePrefix = reInviteUserIds.length > 0 && newUserIds.length === 0 
      ? 're-invited' 
      : 'invited';
    
    await prisma.chatMessage.create({
      data: {
        incidentId,
        userId: user.id,
        content: `${user.firstName} ${user.lastName} ${messagePrefix} ${addedNames} to the team (pending acceptance)`,
        messageType: 'SYSTEM',
      },
    });
  }

  // Create notifications for all invited participants
  if (allInvitedUserIds.length > 0) {
    await prisma.notification.createMany({
      data: allInvitedUserIds.map((userId: string) => ({
        type: 'INCIDENT_ASSIGNED' as const,
        title: 'Team Incident Invitation',
        message: `You have been invited to join the team for incident ${incident.incidentNumber}. Please accept or decline the invitation.`,
        userId,
        incidentId,
      })),
    });
  }

  // Broadcast real-time participant update to all users in the incident room
  if (allInvitedParticipants.length > 0) {
    websocketService.emitToIncident(incidentId, 'IncidentParticipant:updated', {
      incidentId,
      action: 'added',
      IncidentParticipant: allInvitedParticipants,
    });
  }

  // Send real-time invitation notification directly to each invited user
  // (They are not in the incident room yet, so we must notify them individually)
  console.log(`[Participants] Sending real-time invitations to ${allInvitedParticipants.length} users`);
  for (const participant of allInvitedParticipants) {
    console.log(`[Participants] Emitting invitation:received to user ${participant.userId}`);
    websocketService.emitToUser(participant.userId, 'invitation:received', {
      incidentId,
      incidentNumber: incident.incidentNumber,
      customTitle: incident.customTitle,
      invitedBy: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      role: participant.role,
      invitedAt: participant.invitedAt,
    });
  }

  // Also emit the system message via WebSocket for real-time chat update
  if (addedNames) {
    const systemMessage = await prisma.chatMessage.findFirst({
      where: {
        incidentId,
        messageType: 'SYSTEM',
        content: { contains: addedNames },
      },
      orderBy: { createdAt: 'desc' },
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

    if (systemMessage) {
      websocketService.emitToIncident(incidentId, 'chat:message', systemMessage);
    }
  }

  res.status(201).json({
    success: true,
    message: `Added ${newUserIds.length} new participant(s), re-invited ${reInviteUserIds.length} participant(s)`,
    data: {
      added: newUserIds.length,
      reInvited: reInviteUserIds.length,
      skipped: userIds.length - newUserIds.length - reInviteUserIds.length,
      IncidentParticipant: allInvitedParticipants,
    },
  });
});

// PATCH /api/participants/:incidentId/:userId - Update participant role/permissions
router.patch('/:incidentId/:userId', async (req, res) => {
  const { incidentId, userId } = req.params;
  const { role, canEdit, canChat } = req.body;
  const user = (req as any).user;

  // Verify participant exists
  const participant = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: { incidentId, userId },
    },
    include: {
      Incident: {
        select: { organizationId: true, createdById: true },
      },
    },
  });

  if (!participant) {
    throw new NotFoundError('Participant not found');
  }

  if (participant.Incident.organizationId !== user.organizationId) {
    throw new ValidationError('You do not have access to this incident');
  }

  // Only incident creator or admins can change roles
  const isOwner = participant.Incident.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'].includes(user.role);
  
  if (!isOwner && !isAdmin) {
    throw new ValidationError('Only incident owner or admins can modify participant roles');
  }

  const updated = await prisma.incidentParticipant.update({
    where: {
      incidentId_userId: { incidentId, userId },
    },
    data: {
      ...(role !== undefined && { role: role as ParticipantRole }),
      ...(canEdit !== undefined && { canEdit }),
      ...(canChat !== undefined && { canChat }),
    },
    include: {
      User_IncidentParticipant_userIdToUser: {
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

  // Emit WebSocket event for real-time role update
  websocketService.emitToIncident(incidentId, 'participant:role-updated', {
    incidentId,
    participantId: updated.id,
    userId,
    role: updated.role,
    canEdit: updated.canEdit,
    canChat: updated.canChat,
    updatedBy: user.id,
  });

  res.json({
    success: true,
    data: updated,
  });
});

// DELETE /api/participants/:incidentId/:userId - Remove participant from incident
// Enhanced to handle:
// - Last member removal warning and chat archiving
// - Automatic visibility change to PRIVATE when all members removed
router.delete('/:incidentId/:userId', async (req, res) => {
  const { incidentId, userId } = req.params;
  const { confirmLastMember } = req.body; // Client must confirm if removing last member
  const user = (req as any).user;

  // Verify participant exists
  const participant = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: { incidentId, userId },
    },
    include: {
      Incident: {
        select: { 
          organizationId: true, 
          createdById: true,
          visibility: true,
          isTeamIncident: true,
          incidentNumber: true,
        },
      },
      User_IncidentParticipant_userIdToUser: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!participant) {
    throw new NotFoundError('Participant not found');
  }

  if (participant.Incident.organizationId !== user.organizationId) {
    throw new ValidationError('You do not have access to this incident');
  }

  // Can't remove incident creator
  if (userId === participant.Incident.createdById) {
    throw new ValidationError('Cannot remove the incident creator from participants');
  }

  // Only incident creator (owner) or admins can remove participants
  // Team members cannot remove themselves - only the owner can remove them
  const isOwner = participant.Incident.createdById === user.id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'].includes(user.role);
  
  if (!isOwner && !isAdmin) {
    throw new ValidationError('Only the incident owner can remove team members');
  }

  // Check how many active participants remain (excluding the one being removed)
  const remainingParticipants = await prisma.incidentParticipant.count({
    where: {
      incidentId,
      isActive: true,
      userId: { not: userId },
      // Don't count the incident owner/creator as they're not a "team member"
      User_IncidentParticipant_userIdToUser: {
        id: { not: participant.Incident.createdById },
      },
    },
  });

  const isLastMember = remainingParticipants === 0;
  const isTeamIncident = participant.Incident.visibility === 'TEAM';

  // If this is the last member being removed from a TEAM incident, require confirmation
  if (isLastMember && isTeamIncident && !confirmLastMember) {
    return res.status(400).json({
      success: false,
      error: 'LAST_MEMBER_REMOVAL',
      message: 'You are removing the last team member. The incident will become Private and the chat history will be archived.',
      requiresConfirmation: true,
      data: {
        isLastMember: true,
        willArchiveChat: true,
        willBecomePrivate: true,
      },
    });
  }

  // Import the chat archive service
  const { archiveChatMessages } = await import('../services/chatArchiveService');

  // Soft delete - mark participant as inactive
  await prisma.incidentParticipant.update({
    where: {
      incidentId_userId: { incidentId, userId },
    },
    data: {
      isActive: false,
      leftAt: new Date(),
    },
  });

  // If this was the last member of a TEAM incident, archive chat and change visibility
  let chatArchived = false;
  let archiveResult: { archiveBatchId: string; archivedAt: Date; archivedCount: number } | null = null;

  if (isLastMember && isTeamIncident) {
    // Archive the chat messages first
    archiveResult = await archiveChatMessages(
      incidentId, 
      user.id, 
      'LAST_MEMBER_REMOVED'
    );
    chatArchived = true;

    // Change visibility to PRIVATE
    await prisma.incident.update({
      where: { id: incidentId },
      data: {
        visibility: 'PRIVATE',
        isTeamIncident: false,
      },
    });
  }

  // Create system chat message (only if chat wasn't archived, since we just cleared it)
  const removedName = `${participant.User_IncidentParticipant_userIdToUser.firstName} ${participant.User_IncidentParticipant_userIdToUser.lastName}`;
  const action = isSelf ? 'left' : 'was removed from';
  
  let systemMessage = null;
  if (!chatArchived) {
    systemMessage = await prisma.chatMessage.create({
      data: {
        incidentId,
        userId: user.id,
        content: `${removedName} ${action} the team`,
        messageType: 'SYSTEM',
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
  }

  // Broadcast real-time participant update to all users in the incident room
  websocketService.emitToIncident(incidentId, 'IncidentParticipant:updated', {
    incidentId,
    action: 'removed',
    userId,
    removedName,
    isLastMember,
    visibilityChanged: isLastMember && isTeamIncident,
    newVisibility: isLastMember && isTeamIncident ? 'PRIVATE' : undefined,
    chatArchived,
  });

  // Also emit the system message via WebSocket for real-time chat update (if not archived)
  if (systemMessage) {
    websocketService.emitToIncident(incidentId, 'chat:message', systemMessage);
  }

  // If chat was archived, emit a special event to notify clients to refresh/clear their chat
  if (chatArchived) {
    websocketService.emitToIncident(incidentId, 'chat:archived', {
      incidentId,
      archiveBatchId: archiveResult?.archiveBatchId,
      archivedAt: archiveResult?.archivedAt,
      archivedCount: archiveResult?.archivedCount,
      reason: 'LAST_MEMBER_REMOVED',
    });
  }

  res.json({
    success: true,
    message: chatArchived 
      ? 'Participant removed. Incident is now Private and chat has been archived.'
      : 'Participant removed',
    data: {
      removedUserId: userId,
      removedName,
      isLastMember,
      chatArchived,
      visibilityChanged: isLastMember && isTeamIncident,
      newVisibility: isLastMember && isTeamIncident ? 'PRIVATE' : participant.Incident.visibility,
      archiveInfo: archiveResult ? {
        archiveBatchId: archiveResult.archiveBatchId,
        archivedAt: archiveResult.archivedAt,
        archivedCount: archiveResult.archivedCount,
      } : null,
    },
  });
});

// GET /api/participants/users/available - Get available users in organization
router.get('/users/available', async (req, res) => {
  const user = (req as any).user;
  const { incidentId, search } = req.query;

  if (!user.organizationId) {
    throw new ValidationError('User must belong to an organization');
  }

  // Get all active users in organization
  const whereClause: any = {
    organizationId: user.organizationId,
    isActive: true,
  };

  // Add search filter if provided
  if (search) {
    whereClause.OR = [
      { firstName: { contains: String(search), mode: 'insensitive' } },
      { lastName: { contains: String(search), mode: 'insensitive' } },
      { email: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isOnline: true,
      lastSeenAt: true,
      profilePicture: true,
    },
    orderBy: [
      { firstName: 'asc' },
      { lastName: 'asc' },
    ],
  });

  // If incidentId provided, mark which users are already participants
  let existingParticipantIds: Set<string> = new Set();
  if (incidentId) {
    const participants = await prisma.incidentParticipant.findMany({
      where: {
        incidentId: String(incidentId),
        isActive: true,
      },
      select: { userId: true },
    });
    existingParticipantIds = new Set(participants.map(p => p.userId));
  }

  const usersWithStatus = users.map(u => ({
    ...u,
    isParticipant: existingParticipantIds.has(u.id),
  }));

  res.json({
    success: true,
    data: usersWithStatus,
  });
});

// GET /api/participants/invitations/pending - Get all pending invitations for current user
router.get('/invitations/pending', async (req, res) => {
  const user = (req as any).user;
  
  console.log(`[Invitations] Checking pending invitations for user ${user.id} (${user.email})`);

  // Also check ALL participant records for debugging
  const allParticipations = await prisma.incidentParticipant.findMany({
    where: {
      userId: user.id,
    },
    select: {
      incidentId: true,
      invitationStatus: true,
      isActive: true,
      Incident: {
        select: { incidentNumber: true },
      },
    },
  });
  console.log(`[Invitations] All participations for user:`, allParticipations.map(p => ({
    incident: p.Incident.incidentNumber,
    status: p.invitationStatus,
    isActive: p.isActive,
  })));

  const pendingInvitations = await prisma.incidentParticipant.findMany({
    where: {
      userId: user.id,
      invitationStatus: 'PENDING',
      isActive: true,
    },
    include: {
      Incident: {
        select: {
          id: true,
          incidentNumber: true,
          customTitle: true,
          status: true,
          visibility: true,
          createdAt: true,
          User_Incident_createdByIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              IncidentParticipant: {
                where: {
                  isActive: true,
                  invitationStatus: 'ACCEPTED',
                },
              },
            },
          },
        },
      },
      User_IncidentParticipant_addedByIdToUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: {
      invitedAt: 'desc',
    },
  });

  // Get accepted team members for each invitation
  const invitationsWithTeam = await Promise.all(
    pendingInvitations.map(async (invitation) => {
      const teamMembers = await prisma.incidentParticipant.findMany({
        where: {
          incidentId: invitation.incidentId,
          isActive: true,
          invitationStatus: 'ACCEPTED',
        },
        include: {
          User_IncidentParticipant_userIdToUser: {
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

      // Transform to use friendlier field names
      const transformedIncident = {
        id: invitation.Incident.id,
        incidentNumber: invitation.Incident.incidentNumber,
        customTitle: invitation.Incident.customTitle,
        status: invitation.Incident.status,
        visibility: invitation.Incident.visibility,
        createdAt: invitation.Incident.createdAt,
        createdBy: invitation.Incident.User_Incident_createdByIdToUser,
        _count: {
          participants: invitation.Incident._count.IncidentParticipant,
        },
      };

      return {
        id: invitation.id,
        incidentId: invitation.incidentId,
        userId: invitation.userId,
        role: invitation.role,
        invitationStatus: invitation.invitationStatus,
        invitedAt: invitation.invitedAt,
        incident: transformedIncident,
        addedBy: invitation.User_IncidentParticipant_addedByIdToUser,
        teamMembers: teamMembers.map(m => m.User_IncidentParticipant_userIdToUser),
      };
    })
  );
  
  console.log(`[Invitations] Found ${invitationsWithTeam.length} pending invitations for user ${user.id}`);

  // Add no-cache headers to ensure fresh data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.json({
    success: true,
    data: invitationsWithTeam,
    count: invitationsWithTeam.length,
  });
});

// POST /api/participants/invitations/:incidentId/accept - Accept an invitation
router.post('/invitations/:incidentId/accept', async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  // Find the pending invitation
  const invitation = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: { incidentId, userId: user.id },
    },
    include: {
      Incident: {
        select: {
          id: true,
          incidentNumber: true,
          customTitle: true,
          createdById: true,
          visibility: true,
        },
      },
      User_IncidentParticipant_addedByIdToUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  if (invitation.invitationStatus !== 'PENDING') {
    throw new ValidationError('Invitation has already been responded to');
  }

  // Update invitation status to ACCEPTED
  const updatedInvitation = await prisma.incidentParticipant.update({
    where: {
      incidentId_userId: { incidentId, userId: user.id },
    },
    data: {
      invitationStatus: 'ACCEPTED',
      respondedAt: new Date(),
      joinedAt: new Date(),
    },
    include: {
      User_IncidentParticipant_userIdToUser: {
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

  // Create system message for acceptance
  await prisma.chatMessage.create({
    data: {
      incidentId,
      userId: user.id,
      content: `${user.firstName} ${user.lastName} has joined the team`,
      messageType: 'SYSTEM',
    },
  });

  // Notify incident owner of acceptance
  if (invitation.Incident.createdById !== user.id) {
    await prisma.notification.create({
      data: {
        type: 'INCIDENT_ASSIGNED',
        title: 'Team Invitation Accepted',
        message: `${user.firstName} ${user.lastName} has accepted the invitation to join incident ${invitation.Incident.incidentNumber}`,
        userId: invitation.Incident.createdById,
        incidentId,
      },
    });
  }

  // Broadcast real-time update
  websocketService.emitToIncident(incidentId, 'IncidentParticipant:updated', {
    incidentId,
    action: 'accepted',
    participant: updatedInvitation,
  });

  res.json({
    success: true,
    message: 'Invitation accepted successfully',
    data: updatedInvitation,
  });
});

// POST /api/participants/invitations/:incidentId/decline - Decline an invitation
router.post('/invitations/:incidentId/decline', async (req, res) => {
  const { incidentId } = req.params;
  const user = (req as any).user;

  // Find the pending invitation
  const invitation = await prisma.incidentParticipant.findUnique({
    where: {
      incidentId_userId: { incidentId, userId: user.id },
    },
    include: {
      Incident: {
        select: {
          id: true,
          incidentNumber: true,
          customTitle: true,
          createdById: true,
          visibility: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  if (invitation.invitationStatus !== 'PENDING') {
    throw new ValidationError('Invitation has already been responded to');
  }

  // Update invitation status to DECLINED
  await prisma.incidentParticipant.update({
    where: {
      incidentId_userId: { incidentId, userId: user.id },
    },
    data: {
      invitationStatus: 'DECLINED',
      respondedAt: new Date(),
      isActive: false,
    },
  });

  // Create system message for decline
  await prisma.chatMessage.create({
    data: {
      incidentId,
      userId: user.id,
      content: `${user.firstName} ${user.lastName} declined the team invitation`,
      messageType: 'SYSTEM',
    },
  });

  // Notify incident owner of decline via database notification
  if (invitation.Incident.createdById !== user.id) {
    await prisma.notification.create({
      data: {
        type: 'INCIDENT_ASSIGNED',
        title: 'Team Invitation Declined',
        message: `${user.firstName} ${user.lastName} has declined the invitation to join incident ${invitation.Incident.incidentNumber}`,
        userId: invitation.Incident.createdById,
        incidentId,
      },
    });

    // Send real-time notification directly to the owner
    websocketService.emitToUser(invitation.Incident.createdById, 'invitation:declined', {
      incidentId,
      incidentNumber: invitation.Incident.incidentNumber,
      declinedBy: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  }

  // Check if there are any remaining accepted participants (excluding owner)
  const remainingMembers = await prisma.incidentParticipant.findMany({
    where: {
      incidentId,
      isActive: true,
      invitationStatus: 'ACCEPTED',
      userId: { not: invitation.Incident.createdById },
    },
  });

  // Also check for pending invitations
  const pendingInvitations = await prisma.incidentParticipant.findMany({
    where: {
      incidentId,
      isActive: true,
      invitationStatus: 'PENDING',
    },
  });

  // If no remaining members and no pending invitations, revert to PRIVATE
  if (remainingMembers.length === 0 && pendingInvitations.length === 0 && invitation.Incident.visibility === 'TEAM') {
    await prisma.incident.update({
      where: { id: incidentId },
      data: { 
        visibility: 'PRIVATE',
        isTeamIncident: false,
      },
    });

    // Notify owner that incident was reverted to private
    await prisma.notification.create({
      data: {
        type: 'INCIDENT_ASSIGNED',
        title: 'Incident Visibility Changed',
        message: `Incident ${invitation.Incident.incidentNumber} has been automatically reverted to Private as no team members accepted the invitation.`,
        userId: invitation.Incident.createdById,
        incidentId,
      },
    });

    // Broadcast visibility change to incident room
    websocketService.emitToIncident(incidentId, 'incident:visibility-changed', {
      incidentId,
      visibility: 'PRIVATE',
      reason: 'all_invitations_declined',
      declinedBy: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

    // Send direct notification to owner about visibility change
    websocketService.emitToUser(invitation.Incident.createdById, 'incident:visibility-changed', {
      incidentId,
      incidentNumber: invitation.Incident.incidentNumber,
      visibility: 'PRIVATE',
      reason: 'all_invitations_declined',
      declinedBy: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  }

  // Broadcast real-time update to incident room
  websocketService.emitToIncident(incidentId, 'IncidentParticipant:updated', {
    incidentId,
    action: 'declined',
    userId: user.id,
    declinedBy: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });

  // Also send directly to the owner in case they're not in the incident room
  if (invitation.Incident.createdById !== user.id) {
    websocketService.emitToUser(invitation.Incident.createdById, 'IncidentParticipant:updated', {
      incidentId,
      action: 'declined',
      userId: user.id,
      declinedBy: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  }

  res.json({
    success: true,
    message: 'Invitation declined successfully',
  });
});

export default router;
