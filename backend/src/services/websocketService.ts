import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { prisma } from '../utils/prisma';

interface ConnectedUser {
  socketId: string;
  userId: string;
  organizationId: string;
  incidentRooms: Set<string>;
}

class WebSocketService {
  private io: Server | null = null;
  private connectedUsers: Map<string, ConnectedUser> = new Map(); // socketId -> user info
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds

  initialize(httpServer: HTTPServer, corsOrigins: string[]) {
    this.io = new Server(httpServer, {
      cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);
      this.handleConnection(socket);
    });

    console.log('🌐 WebSocket server initialized');
    return this.io;
  }

  private async handleConnection(socket: Socket) {
    // Authentication - expect userId and organizationId from handshake
    const { userId, organizationId } = socket.handshake.auth;

    if (!userId || !organizationId) {
      console.log(`❌ Socket ${socket.id} rejected: missing auth`);
      socket.disconnect();
      return;
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true, firstName: true, lastName: true },
    });

    if (!user || user.organizationId !== organizationId) {
      console.log(`❌ Socket ${socket.id} rejected: invalid user`);
      socket.disconnect();
      return;
    }

    // Track connected user
    const userInfo: ConnectedUser = {
      socketId: socket.id,
      userId,
      organizationId,
      incidentRooms: new Set(),
    };
    this.connectedUsers.set(socket.id, userInfo);

    // Track multiple sockets per user (multiple tabs/devices)
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);
    
    console.log(`🔌 Socket connected: ${socket.id} for user ${userId}, total sockets for user: ${this.userSockets.get(userId)!.size}`);

    // Update user online status
    await this.updateUserPresence(userId, true, socket.id);

    // Join organization room
    socket.join(`org:${organizationId}`);

    // Broadcast user online status to organization
    socket.to(`org:${organizationId}`).emit('user:online', {
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // Handle events
    this.setupEventHandlers(socket, userInfo, user);

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      await this.handleDisconnect(socket.id);
    });
  }

  private setupEventHandlers(socket: Socket, userInfo: ConnectedUser, user: any) {
    // Join incident chat room
    socket.on('incident:join', async (incidentId: string) => {
      try {
        // Verify user has access to this incident
        const hasAccess = await this.verifyIncidentAccess(userInfo.userId, incidentId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this incident' });
          return;
        }

        const roomName = `incident:${incidentId}`;
        socket.join(roomName);
        userInfo.incidentRooms.add(roomName);

        // Notify others in the room
        socket.to(roomName).emit('participant:joined', {
          incidentId,
          userId: userInfo.userId,
          firstName: user.firstName,
          lastName: user.lastName,
        });

        // Send current participants in room to joining user
        const participantsInRoom = await this.getIncidentParticipantsOnline(incidentId);
        socket.emit('incident:participants', { incidentId, participants: participantsInRoom });

        console.log(`👥 User ${userInfo.userId} joined incident room ${incidentId}`);
      } catch (error) {
        console.error('Error joining incident:', error);
        socket.emit('error', { message: 'Failed to join incident room' });
      }
    });

    // Leave incident room
    socket.on('incident:leave', (incidentId: string) => {
      const roomName = `incident:${incidentId}`;
      socket.leave(roomName);
      userInfo.incidentRooms.delete(roomName);

      socket.to(roomName).emit('participant:left', {
        incidentId,
        userId: userInfo.userId,
      });

      console.log(`👋 User ${userInfo.userId} left incident room ${incidentId}`);
    });

    // Send chat message
    socket.on('chat:message', async (data: { incidentId: string; content: string; replyToId?: string }) => {
      try {
        const { incidentId, content, replyToId } = data;

        if (!content || content.trim().length === 0) {
          socket.emit('error', { message: 'Message content required' });
          return;
        }

        // Verify user has access to send messages in this incident
        const hasAccess = await this.verifyIncidentAccess(userInfo.userId, incidentId);
        if (!hasAccess) {
          socket.emit('error', { message: 'You do not have access to this incident chat' });
          return;
        }

        // Create message in database
        const message = await prisma.chatMessage.create({
          data: {
            incidentId,
            userId: userInfo.userId,
            content: content.trim(),
            messageType: 'TEXT',
            replyToId,
            readBy: [userInfo.userId],
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
          },
        });

        // Broadcast to all in the incident room
        this.io?.to(`incident:${incidentId}`).emit('chat:message', message);

        console.log(`💬 Message sent in incident ${incidentId} by ${userInfo.userId}`);

        // Also emit directly to each participant's user socket for notifications
        // This ensures they receive the message even if they're not on the incident page
        const otherParticipants = await prisma.incidentParticipant.findMany({
          where: {
            incidentId,
            userId: { not: userInfo.userId },
            isActive: true,
          },
          select: { userId: true },
        });

        console.log(`[WS] Other participants to notify:`, otherParticipants.map(p => p.userId));
        
        for (const participant of otherParticipants) {
          console.log(`[WS] Emitting chat:notification to user ${participant.userId}`);
          this.emitToUser(participant.userId, 'chat:notification', {
            ...message,
            incidentId,
          });
        }
        console.log(`[WS] Sent chat:notification to ${otherParticipants.length} participants`);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('chat:typing', (data: { incidentId: string; isTyping: boolean }) => {
      const { incidentId, isTyping } = data;
      socket.to(`incident:${incidentId}`).emit('chat:typing', {
        userId: userInfo.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        isTyping,
      });
    });

    // Mark messages as read
    socket.on('chat:read', async (data: { incidentId: string; messageIds?: string[] }) => {
      try {
        const { incidentId, messageIds } = data;

        if (messageIds && messageIds.length > 0) {
          // Mark specific messages as read
          await prisma.$transaction(
            messageIds.map(id =>
              prisma.chatMessage.update({
                where: { id },
                data: { readBy: { push: userInfo.userId } },
              })
            )
          );
        } else {
          // Mark all unread messages as read
          const unread = await prisma.chatMessage.findMany({
            where: {
              incidentId,
              NOT: { readBy: { has: userInfo.userId } },
            },
            select: { id: true },
          });

          if (unread.length > 0) {
            await prisma.$transaction(
              unread.map(msg =>
                prisma.chatMessage.update({
                  where: { id: msg.id },
                  data: { readBy: { push: userInfo.userId } },
                })
              )
            );
          }
        }

        // Notify others that user has read messages
        socket.to(`incident:${incidentId}`).emit('chat:read', {
          userId: userInfo.userId,
          incidentId,
        });
      } catch (error) {
        console.error('Error marking messages read:', error);
      }
    });

    // Participant added/removed notifications
    socket.on('participant:added', (data: { incidentId: string; participants: any[] }) => {
      socket.to(`incident:${data.incidentId}`).emit('participant:added', data);
    });

    socket.on('participant:removed', (data: { incidentId: string; userId: string }) => {
      socket.to(`incident:${data.incidentId}`).emit('participant:removed', data);
    });
  }

  private async handleDisconnect(socketId: string) {
    const userInfo = this.connectedUsers.get(socketId);
    if (!userInfo) return;

    // Remove from connected users
    this.connectedUsers.delete(socketId);

    // Remove socket from user's socket set
    const userSocketSet = this.userSockets.get(userInfo.userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);

      // Only mark offline if no more sockets for this user
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userInfo.userId);
        await this.updateUserPresence(userInfo.userId, false, null);

        // Broadcast offline status
        this.io?.to(`org:${userInfo.organizationId}`).emit('user:offline', {
          userId: userInfo.userId,
        });

        // Notify incident rooms
        for (const roomName of userInfo.incidentRooms) {
          this.io?.to(roomName).emit('participant:left', {
            incidentId: roomName.replace('incident:', ''),
            userId: userInfo.userId,
          });
        }
      }
    }
  }

  private async updateUserPresence(userId: string, isOnline: boolean, socketId: string | null) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isOnline,
          lastSeenAt: new Date(),
          socketId,
        },
      });
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }

  private async verifyIncidentAccess(userId: string, incidentId: string): Promise<boolean> {
    // Check if user is a participant, creator, admin, or same organization
    const [participant, incident, user] = await Promise.all([
      prisma.incidentParticipant.findUnique({
        where: { incidentId_userId: { incidentId, userId } },
        select: { isActive: true },
      }),
      prisma.incident.findUnique({
        where: { id: incidentId },
        select: { createdById: true, organizationId: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, organizationId: true },
      }),
    ]);

    if (!incident || !user) return false;

    // Different organization - deny access
    if (incident.organizationId !== user.organizationId) return false;

    // Is active participant
    if (participant?.isActive) return true;

    // Is creator
    if (incident.createdById === userId) return true;

    // Is admin
    if (['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER', 'SAFETY_SECURITY_MANAGER'].includes(user.role)) return true;

    // Same organization - allow access for team collaboration
    // This enables users from the same org to participate in team chats
    return true;
  }

  private async getIncidentParticipantsOnline(incidentId: string) {
    const participants = await prisma.incidentParticipant.findMany({
      where: { incidentId, isActive: true },
      include: {
        User_IncidentParticipant_userIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            isOnline: true,
            lastSeenAt: true,
          },
        },
      },
    });

    return participants.map(p => ({
      ...p.User_IncidentParticipant_userIdToUser,
      role: p.role,
    }));
  }

  // Public methods for external use
  getIO() {
    return this.io;
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  getUserSocketIds(userId: string): string[] {
    return Array.from(this.userSockets.get(userId) || []);
  }

  emitToUser(userId: string, event: string, data: any) {
    const socketIds = this.getUserSocketIds(userId);
    console.log(`📤 emitToUser: userId=${userId}, event=${event}, socketCount=${socketIds.length}`);
    if (socketIds.length === 0) {
      console.log(`⚠️ No active sockets found for user ${userId}`);
    }
    for (const socketId of socketIds) {
      this.io?.to(socketId).emit(event, data);
      console.log(`  → Emitted to socket ${socketId}`);
    }
  }

  emitToIncident(incidentId: string, event: string, data: any) {
    console.log(`📤 emitToIncident: incidentId=${incidentId}, event=${event}`);
    this.io?.to(`incident:${incidentId}`).emit(event, data);
  }

  emitToOrganization(organizationId: string, event: string, data: any) {
    console.log(`📤 emitToOrganization: orgId=${organizationId}, event=${event}`);
    this.io?.to(`org:${organizationId}`).emit(event, data);
  }
}

export const websocketService = new WebSocketService();
