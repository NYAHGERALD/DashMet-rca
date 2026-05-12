import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';
import { clearRoomFromCache } from '../routes/videoCallRoutes';
import jwt from 'jsonwebtoken';
import { ACCESS_COOKIE_NAME, hashToken } from '../utils/sessionCookies';
import { syncRcaFishboneBoard } from './rcaFishboneBoardService';

interface ConnectedUser {
  socketId: string;
  userId: string;
  organizationId: string;
  firstName?: string;
  lastName?: string;
  incidentRooms: Set<string>;
}

class WebSocketService {
  private io: Server | null = null;
  private connectedUsers: Map<string, ConnectedUser> = new Map(); // socketId -> user info
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds

  private getCookieFromHeader(cookieHeader: string | undefined, name: string): string | undefined {
    if (!cookieHeader) return undefined;

    for (const part of cookieHeader.split(';')) {
      const [rawKey, ...rawValue] = part.trim().split('=');
      if (rawKey === name) {
        return decodeURIComponent(rawValue.join('='));
      }
    }

    return undefined;
  }

  initialize(httpServer: HTTPServer, corsOrigins: string[]) {
    this.io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no Origin header (native mobile apps, server-to-server)
          if (!origin) return callback(null, true);
          // Allow configured web origins
          if (corsOrigins.includes(origin)) return callback(null, true);
          callback(new Error('Not allowed by CORS'));
        },
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
    const { token: handshakeToken, userId, organizationId } = socket.handshake.auth;
    const cookieToken = this.getCookieFromHeader(socket.handshake.headers.cookie, ACCESS_COOKIE_NAME);
    const token = cookieToken || handshakeToken;

    if (!userId || !organizationId) {
      console.log(`❌ Socket ${socket.id} rejected: missing auth`);
      socket.disconnect();
      return;
    }

    if (!token) {
      console.log(`❌ Socket ${socket.id} rejected: missing auth token`);
      socket.disconnect();
      return;
    }

    let user = null;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      if (decoded?.userId) {
        const session = await prisma.session.findFirst({
          where: {
            userId: decoded.userId,
            token: hashToken(token),
            expiresAt: { gt: new Date() },
          },
        });

        if (session) {
          user = await prisma.user.findFirst({
            where: { id: decoded.userId, isActive: true },
            select: { id: true, organizationId: true, firstName: true, lastName: true, firebaseUid: true },
          });
        }
      }
    } catch {
      user = null;
    }

    if (!user || user.id !== userId || user.organizationId !== organizationId) {
      console.log(`❌ Socket ${socket.id} rejected: user/token mismatch`);
      socket.disconnect();
      return;
    }

    // Track connected user
    const userInfo: ConnectedUser = {
      socketId: socket.id,
      userId,
      organizationId,
      firstName: user.firstName,
      lastName: user.lastName,
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
        console.log(`🚪 [WS] incident:join request from user ${userInfo.userId} for incident ${incidentId}`);
        
        // Verify user has access to this incident
        const hasAccess = await this.verifyIncidentAccess(userInfo.userId, incidentId);
        if (!hasAccess) {
          console.log(`🚫 [WS] Access denied for user ${userInfo.userId} to incident ${incidentId}`);
          socket.emit('error', { message: 'Access denied to this incident' });
          return;
        }

        const roomName = `incident:${incidentId}`;
        socket.join(roomName);
        userInfo.incidentRooms.add(roomName);
        
        // Debug: log all rooms this socket is in
        console.log(`🚪 [WS] Socket ${socket.id} rooms:`, Array.from(socket.rooms));

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
        
        // Confirm join to the user
        socket.emit('incident:joined', { incidentId, roomName, success: true });

        console.log(`👥 User ${userInfo.userId} joined incident room ${incidentId} (room: ${roomName})`);
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
            id: uuidv4(),
            updatedAt: new Date(),
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

    // RCA modal state sync (for real-time team collaboration on Start RCA modal)
    socket.on('rca:modal-state', (data: { incidentId: string; action: string; selectedMethod?: string; visibility?: string }) => {
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      // Broadcast to all team members in the incident room (except sender)
      socket.to(`incident:${data.incidentId}`).emit('rca:modal-state', {
        ...data,
        userId: userInfo.userId,
        userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User',
      });
    });

    // RCA clarification answer sync (for real-time collaborative input)
    socket.on('rca:clarification-answer', (data: { incidentId: string; rcaId: string; questionIndex: number; answer: string }) => {
      console.log('📝 [WS] Received rca:clarification-answer from socket:', socket.id, 'data:', JSON.stringify(data));
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) {
        console.log('📝 [WS] No userInfo for socket, ignoring clarification-answer');
        return;
      }
      console.log('📝 [WS] Broadcasting to room incident:', data.incidentId);

      // Broadcast to all team members in the incident room (except sender)
      socket.to(`incident:${data.incidentId}`).emit('rca:clarification-answer', {
        ...data,
        userId: userInfo.userId,
        userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User',
        timestamp: new Date().toISOString(),
      });
    });

    // RCA problem statement sync (for real-time collaborative editing)
    socket.on('rca:problem-update', async (data: { incidentId: string; rcaId: string; problem: string }) => {
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      console.log('📝 [WS] Received rca:problem-update from socket:', socket.id, 'data:', { incidentId: data.incidentId, rcaId: data.rcaId, problemLength: data.problem?.length });

      // Save the problem statement to the database (auto-save)
      try {
        const rca = await prisma.rCAAnalysis.findUnique({
          where: { id: data.rcaId },
          select: { fishboneData: true }
        });
        
        if (rca) {
          const currentData = (rca.fishboneData as any) || { problem: '', categories: [] };
          await prisma.rCAAnalysis.update({
            where: { id: data.rcaId },
            data: {
              fishboneData: {
                ...currentData,
                problem: data.problem
              },
              updatedAt: new Date()
            }
          });
          console.log('📝 [WS] Problem statement auto-saved to database for RCA:', data.rcaId);
        }
      } catch (error) {
        console.error('📝 [WS] Failed to auto-save problem statement:', error);
      }

      // Broadcast to all team members in the incident room (except sender)
      socket.to(`incident:${data.incidentId}`).emit('rca:problem-update', {
        ...data,
        userId: userInfo.userId,
        userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User',
        timestamp: new Date().toISOString(),
      });
    });

    // RCA categories sync (for real-time fishbone diagram updates)
    socket.on('rca:categories-updated', async (data: { incidentId: string; rcaId: string; categories: any[]; problem: string }) => {
      console.log('📈 [WS] Received rca:categories-updated from socket:', socket.id);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) {
        console.log('📈 [WS] No userInfo for socket, ignoring categories-updated');
        return;
      }
      console.log('📈 [WS] Broadcasting categories to room incident:', data.incidentId);

      // Save categories to database (auto-save)
      try {
        const rca = await prisma.rCAAnalysis.findUnique({
          where: { id: data.rcaId },
          select: { fishboneData: true }
        });
        
        if (rca) {
          const currentData = (rca.fishboneData as any) || { problem: '', categories: [] };
          await prisma.rCAAnalysis.update({
            where: { id: data.rcaId },
            data: {
              fishboneData: {
                ...currentData,
                problem: data.problem,
                categories: data.categories
              },
              updatedAt: new Date()
            }
          });
          console.log('📈 [WS] Categories auto-saved to database for RCA:', data.rcaId);
          try {
            await syncRcaFishboneBoard(data.rcaId, userInfo.userId, {
              ...currentData,
              problem: data.problem,
              categories: data.categories,
            }, 'FISHBONE_REALTIME_UPDATE');
            console.log('📈 [WS] Fishbone whiteboard synced for RCA:', data.rcaId);
          } catch (syncError) {
            console.error('📈 [WS] Failed to sync fishbone whiteboard:', syncError);
          }
        }
      } catch (error) {
        console.error('📈 [WS] Failed to auto-save categories:', error);
      }

      // Broadcast to all team members in the incident room (except sender)
      socket.to(`incident:${data.incidentId}`).emit('rca:categories-updated', {
        ...data,
        userId: userInfo.userId,
        userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User',
        timestamp: new Date().toISOString(),
      });
    });

    // RCA cause input typing sync (for real-time "Add a cause" input updates)
    socket.on('rca:cause-input-typing', (data: { incidentId: string; rcaId: string; categoryId: string; text: string }) => {
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      // Broadcast to all team members in the incident room (except sender)
      socket.to(`incident:${data.incidentId}`).emit('rca:cause-input-typing', {
        ...data,
        userId: userInfo.userId,
        userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User',
        timestamp: new Date().toISOString(),
      });
    });

    // RCA 5 Whys modal opened sync (for real-time modal synchronization across team)
    socket.on('rca:five-whys-modal-opened', async (data: { 
      incidentId: string; 
      rcaId: string; 
      causeId: string; 
      causeText: string; 
      categoryName: string;
      mode: 'choose' | 'continue-or-restart' | 'manual' | 'ai';
      hasAnswers: boolean;
      answerCount: number;
      steps: Array<{ stepNumber: number; question: string; answer: string }>;
      rootCause?: string;
    }) => {
      console.log('🔍 [WS] Received rca:five-whys-modal-opened from socket:', socket.id, 'mode:', data.mode, 'hasAnswers:', data.hasAnswers, 'rootCause:', data.rootCause);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Save modal state to database for persistence across page refreshes
      try {
        await prisma.rCAAnalysis.update({
          where: { id: data.rcaId },
          data: {
            fiveWhysModalState: {
              isOpen: true,
              causeId: data.causeId,
              causeText: data.causeText,
              categoryName: data.categoryName,
              mode: data.mode,
              hasAnswers: data.hasAnswers,
              answerCount: data.answerCount,
              openedBy: {
                id: userInfo.userId,
                firstName: userInfo.firstName || '',
                lastName: userInfo.lastName || '',
              },
              openedAt: new Date().toISOString(),
            },
            updatedAt: new Date()
          }
        });
        console.log('🔍 [WS] 5 Whys modal state saved to database for RCA:', data.rcaId);
      } catch (error) {
        console.error('🔍 [WS] Failed to save 5 Whys modal state:', error);
      }

      // Broadcast to ALL team members in the incident room (including sender for confirmation)
      if (this.io) {
        this.io.to(`incident:${data.incidentId}`).emit('rca:five-whys-modal-opened', {
          ...data,
          openedBy: {
            id: userInfo.userId,
            firstName: userInfo.firstName || '',
            lastName: userInfo.lastName || '',
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // RCA 5 Whys modal closed sync (for real-time modal synchronization across team)
    socket.on('rca:five-whys-modal-closed', async (data: { incidentId: string; rcaId: string }) => {
      console.log('🔍 [WS] Received rca:five-whys-modal-closed from socket:', socket.id);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Clear modal state from database
      try {
        await prisma.rCAAnalysis.update({
          where: { id: data.rcaId },
          data: {
            fiveWhysModalState: Prisma.DbNull,
            updatedAt: new Date()
          }
        });
        console.log('🔍 [WS] 5 Whys modal state cleared from database for RCA:', data.rcaId);
      } catch (error) {
        console.error('🔍 [WS] Failed to clear 5 Whys modal state:', error);
      }

      // Broadcast to ALL team members in the incident room (including sender for confirmation)
      if (this.io) {
        this.io.to(`incident:${data.incidentId}`).emit('rca:five-whys-modal-closed', {
          ...data,
          closedBy: {
            id: userInfo.userId,
            firstName: userInfo.firstName || '',
            lastName: userInfo.lastName || '',
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // RCA 5 Whys mode changed sync (for real-time mode synchronization across team)
    socket.on('rca:five-whys-mode-changed', async (data: { 
      incidentId: string; 
      rcaId: string; 
      mode: 'choose' | 'manual' | 'ai';
      resetData?: {
        causeId: string;
        causeText: string;
        steps: Array<{ stepNumber: number; question: string; answer: string }>;
        hasAnswers: boolean;
        answerCount: number;
      };
    }) => {
      console.log('🔍 [WS] Received rca:five-whys-mode-changed from socket:', socket.id, 'mode:', data.mode, 'hasResetData:', !!data.resetData);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to ALL team members in the incident room (including sender for confirmation)
      if (this.io) {
        this.io.to(`incident:${data.incidentId}`).emit('rca:five-whys-mode-changed', {
          ...data,
          changedBy: {
            id: userInfo.userId,
            firstName: userInfo.firstName || '',
            lastName: userInfo.lastName || '',
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // RCA 5 Whys field typing sync (for real-time typing indicator across team)
    socket.on('rca:five-whys-field-typing', (data: { incidentId: string; rcaId: string; fieldType: 'why' | 'rootCause'; stepNumber?: number; isTyping: boolean }) => {
      console.log('🔍 [WS] Received rca:five-whys-field-typing from socket:', socket.id);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to OTHER team members in the incident room (not sender - they know they're typing)
      socket.to(`incident:${data.incidentId}`).emit('rca:five-whys-field-typing', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // RCA 5 Whys field content update sync (for real-time text sync across team)
    socket.on('rca:five-whys-field-update', (data: { incidentId: string; rcaId: string; fieldType: 'why' | 'rootCause'; stepNumber?: number; text: string; nextQuestion?: string }) => {
      console.log('🔍 [WS] Received rca:five-whys-field-update from socket:', socket.id);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to OTHER team members in the incident room (not sender - they already have the text)
      socket.to(`incident:${data.incidentId}`).emit('rca:five-whys-field-update', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // RCA 5 Whys status changed sync (for real-time color indicator updates)
    socket.on('rca:five-whys-status-changed', (data: { incidentId: string; rcaId: string; causeId: string; hasAnswers: boolean; answerCount: number }) => {
      console.log('🔍 [WS] Received rca:five-whys-status-changed from socket:', socket.id);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to OTHER team members in the incident room
      socket.to(`incident:${data.incidentId}`).emit('rca:five-whys-status-changed', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // RCA 5 Whys AI analyzing state sync (for real-time loading spinner across team)
    socket.on('rca:five-whys-ai-analyzing', (data: { incidentId: string; rcaId: string; causeId: string; isAnalyzing: boolean }) => {
      console.log('🔍 [WS] Received rca:five-whys-ai-analyzing from socket:', socket.id, 'isAnalyzing:', data.isAnalyzing);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to ALL team members in the incident room (including sender for confirmation)
      if (this.io) {
        this.io.to(`incident:${data.incidentId}`).emit('rca:five-whys-ai-analyzing', {
          ...data,
          userId: userInfo.userId,
          userName,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // RCA 5 Whys AI result sync (for real-time AI analysis result across team)
    socket.on('rca:five-whys-ai-result', (data: { incidentId: string; rcaId: string; causeId: string; result: any }) => {
      console.log('🔍 [WS] Received rca:five-whys-ai-result from socket:', socket.id);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to ALL team members in the incident room (including sender for confirmation)
      if (this.io) {
        this.io.to(`incident:${data.incidentId}`).emit('rca:five-whys-ai-result', {
          ...data,
          userId: userInfo.userId,
          userName,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // RCA 5 Whys AI Edit mode sync (for real-time edit mode state across team)
    socket.on('rca:five-whys-ai-edit-mode', (data: { incidentId: string; rcaId: string; causeId: string; isEditing: boolean; editedSteps: any[]; editedRootCause: string }) => {
      console.log('🔍 [WS] Received rca:five-whys-ai-edit-mode from socket:', socket.id, 'isEditing:', data.isEditing);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to ALL team members in the incident room (including sender for confirmation)
      if (this.io) {
        this.io.to(`incident:${data.incidentId}`).emit('rca:five-whys-ai-edit-mode', {
          ...data,
          userId: userInfo.userId,
          userName,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // RCA 5 Whys AI Edit typing sync (for real-time typing indicator across team)
    socket.on('rca:five-whys-ai-edit-typing', (data: { incidentId: string; rcaId: string; fieldType: string; stepNumber?: number; isTyping: boolean }) => {
      console.log('🔍 [WS] Received rca:five-whys-ai-edit-typing from socket:', socket.id, 'fieldType:', data.fieldType, 'isTyping:', data.isTyping);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to all team members except sender
      socket.to(`incident:${data.incidentId}`).emit('rca:five-whys-ai-edit-typing', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // RCA 5 Whys AI Edit update sync (for real-time content updates across team)
    socket.on('rca:five-whys-ai-edit-update', (data: { incidentId: string; rcaId: string; fieldType: string; stepNumber?: number; text: string }) => {
      console.log('🔍 [WS] Received rca:five-whys-ai-edit-update from socket:', socket.id, 'fieldType:', data.fieldType, 'stepNumber:', data.stepNumber);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to all team members except sender
      socket.to(`incident:${data.incidentId}`).emit('rca:five-whys-ai-edit-update', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // RCA 5 Whys Manual validation state sync (for real-time validation loading sync)
    socket.on('rca:five-whys-manual-validating', (data: { incidentId: string; rcaId: string; causeId: string; isValidating: boolean }) => {
      console.log('🔍 [WS] Received rca:five-whys-manual-validating from socket:', socket.id, 'isValidating:', data.isValidating);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to ALL team members in the incident room (including sender for confirmation)
      if (this.io) {
        this.io.to(`incident:${data.incidentId}`).emit('rca:five-whys-manual-validating', {
          ...data,
          userId: userInfo.userId,
          userName,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // RCA 5 Whys Manual validation result sync (for real-time validation result across team)
    socket.on('rca:five-whys-manual-validation-result', (data: { incidentId: string; rcaId: string; causeId: string; result: any }) => {
      console.log('🔍 [WS] Received rca:five-whys-manual-validation-result from socket:', socket.id);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to ALL team members in the incident room (including sender for confirmation)
      if (this.io) {
        this.io.to(`incident:${data.incidentId}`).emit('rca:five-whys-manual-validation-result', {
          ...data,
          userId: userInfo.userId,
          userName,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // RCA 5 Whys Manual correction applied sync (for real-time fix application across team)
    socket.on('rca:five-whys-manual-correction-applied', (data: { incidentId: string; rcaId: string; causeId: string; stepNumber: number; correctedText: string }) => {
      console.log('🔍 [WS] Received rca:five-whys-manual-correction-applied from socket:', socket.id, 'stepNumber:', data.stepNumber);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to all team members except sender
      socket.to(`incident:${data.incidentId}`).emit('rca:five-whys-manual-correction-applied', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // RCA 5 Whys AI Edit validation state sync (for real-time AI edit validation loading)
    socket.on('rca:five-whys-ai-edit-validating', (data: { incidentId: string; rcaId: string; causeId: string; isValidating: boolean }) => {
      console.log('🔍 [WS] Received rca:five-whys-ai-edit-validating from socket:', socket.id, 'isValidating:', data.isValidating);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to all team members except sender
      socket.to(`incident:${data.incidentId}`).emit('rca:five-whys-ai-edit-validating', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // RCA 5 Whys AI Edit validation result sync (for real-time AI edit validation result)
    socket.on('rca:five-whys-ai-edit-validation-result', (data: { incidentId: string; rcaId: string; causeId: string; result: any }) => {
      console.log('🔍 [WS] Received rca:five-whys-ai-edit-validation-result from socket:', socket.id);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to all team members except sender
      socket.to(`incident:${data.incidentId}`).emit('rca:five-whys-ai-edit-validation-result', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // RCA 5 Whys AI Edit fix applied sync (for real-time Apply Fix)
    socket.on('rca:five-whys-ai-edit-fix-applied', (data: { incidentId: string; rcaId: string; causeId: string; stepNumber: number; correctedText: string }) => {
      console.log('🔍 [WS] Received rca:five-whys-ai-edit-fix-applied from socket:', socket.id, 'stepNumber:', data.stepNumber);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to all team members except sender
      socket.to(`incident:${data.incidentId}`).emit('rca:five-whys-ai-edit-fix-applied', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // RCA corrective actions sync (for real-time action plans updates)
    socket.on('rca:corrective-actions-updated', (data: { incidentId: string; rcaId: string; actionPlans: any; preventiveControls: any[] }) => {
      console.log('\ud83d\udee0\ufe0f [WS] Received rca:corrective-actions-updated from socket:', socket.id);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;
      console.log('\ud83d\udee0\ufe0f [WS] Broadcasting corrective actions to room incident:', data.incidentId);

      // Broadcast to all team members in the incident room (except sender)
      socket.to(`incident:${data.incidentId}`).emit('rca:corrective-actions-updated', {
        ...data,
        userId: userInfo.userId,
        userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User',
        timestamp: new Date().toISOString(),
      });
    });

    // RCA 5 Whys cause recommendation sync (for real-time keep/eliminate)
    socket.on('rca:five-whys-cause-recommendation', (data: { incidentId: string; rcaId: string; causeId: string; categoryName: string; recommendation: 'keep' | 'eliminate'; fiveWhysAnalysis?: any }) => {
      console.log('🔍 [WS] Received rca:five-whys-cause-recommendation from socket:', socket.id, 'recommendation:', data.recommendation);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Unknown User';

      // Broadcast to all team members except sender
      socket.to(`incident:${data.incidentId}`).emit('rca:five-whys-cause-recommendation', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // ========================================
    // VIDEO CALL EVENTS
    // ========================================

    // Video call started - notify incident/FMIR team members only
    socket.on('video-call:started', async (data: { incidentId: string; roomUrl: string; roomName: string }) => {
      console.log('📹 [WS] Video call started:', data.incidentId, 'from user:', socket.id);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) {
        console.log('📹 [WS] No user info found for socket:', socket.id);
        return;
      }

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Someone';

      const payload = {
        ...data,
        startedBy: userInfo.userId,
        startedByName: userName,
        timestamp: new Date().toISOString(),
      };

      try {
        const participantIds = new Set<string>();
        
        // First try to get incident participants (regular incidents)
        const incident = await prisma.incident.findUnique({
          where: { id: data.incidentId },
          select: {
            createdById: true,
            fmirReportId: true, // Check if incident is linked to an FMIR
            IncidentParticipant: {
              select: { userId: true },
            },
          },
        });

        if (incident) {
          // Regular incident - collect participants
          if (incident.createdById) participantIds.add(incident.createdById);
          incident.IncidentParticipant.forEach(p => participantIds.add(p.userId));
          console.log('📹 [WS] Found incident with', participantIds.size, 'direct participants');
          
          // If incident is linked to an FMIR, also include FMIR collaborators
          if (incident.fmirReportId) {
            const linkedFmir = await prisma.foreignMaterialIncident.findUnique({
              where: { id: incident.fmirReportId },
              select: {
                createdById: true,
                collaboratorIds: true,
              },
            });
            
            if (linkedFmir) {
              if (linkedFmir.createdById) participantIds.add(linkedFmir.createdById);
              if (linkedFmir.collaboratorIds && Array.isArray(linkedFmir.collaboratorIds)) {
                linkedFmir.collaboratorIds.forEach((id: string) => participantIds.add(id));
              }
              console.log('📹 [WS] Added FMIR collaborators, total:', participantIds.size);
            }
          }
        } else {
          // Try FMIR - the incidentId might be an FMIR ID
          const fmir = await prisma.foreignMaterialIncident.findUnique({
            where: { id: data.incidentId },
            select: {
              createdById: true,
              collaboratorIds: true,
            },
          });

          if (fmir) {
            // FMIR - collect creator and collaborators
            if (fmir.createdById) participantIds.add(fmir.createdById);
            if (fmir.collaboratorIds && Array.isArray(fmir.collaboratorIds)) {
              fmir.collaboratorIds.forEach((id: string) => participantIds.add(id));
            }
            console.log('📹 [WS] Found FMIR with', participantIds.size, 'participants');
          } else {
            console.log('📹 [WS] Neither incident nor FMIR found:', data.incidentId);
            return;
          }
        }

        console.log('📹 [WS] Broadcasting video-call:started to', participantIds.size, 'participants');

        // Send to each participant's sockets (excluding the sender)
        for (const participantId of participantIds) {
          if (participantId === userInfo.userId) continue; // Don't send to self
          
          const participantSockets = this.userSockets.get(participantId);
          if (participantSockets) {
            participantSockets.forEach(socketId => {
              this.io?.to(socketId).emit('video-call:started', payload);
            });
            console.log('📹 [WS] Sent to participant:', participantId);
          }
        }
      } catch (error) {
        console.error('📹 [WS] Error broadcasting video call:', error);
      }
    });

    // Video call ended
    socket.on('video-call:ended', async (data: { incidentId: string; roomName: string }) => {
      console.log('📹 [WS] Video call ended:', data.incidentId);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      // Clear room from cache
      clearRoomFromCache(data.incidentId, data.roomName);

      try {
        const participantIds = new Set<string>();
        
        // First try regular incident
        const incident = await prisma.incident.findUnique({
          where: { id: data.incidentId },
          select: {
            createdById: true,
            fmirReportId: true, // Check if linked to FMIR
            IncidentParticipant: {
              select: { userId: true },
            },
          },
        });

        if (incident) {
          if (incident.createdById) participantIds.add(incident.createdById);
          incident.IncidentParticipant.forEach(p => participantIds.add(p.userId));
          
          // If incident is linked to an FMIR, also include FMIR collaborators
          if (incident.fmirReportId) {
            const linkedFmir = await prisma.foreignMaterialIncident.findUnique({
              where: { id: incident.fmirReportId },
              select: {
                createdById: true,
                collaboratorIds: true,
              },
            });
            
            if (linkedFmir) {
              if (linkedFmir.createdById) participantIds.add(linkedFmir.createdById);
              if (linkedFmir.collaboratorIds && Array.isArray(linkedFmir.collaboratorIds)) {
                linkedFmir.collaboratorIds.forEach((id: string) => participantIds.add(id));
              }
            }
          }
        } else {
          // Try FMIR
          const fmir = await prisma.foreignMaterialIncident.findUnique({
            where: { id: data.incidentId },
            select: {
              createdById: true,
              collaboratorIds: true,
            },
          });

          if (fmir) {
            if (fmir.createdById) participantIds.add(fmir.createdById);
            if (fmir.collaboratorIds && Array.isArray(fmir.collaboratorIds)) {
              fmir.collaboratorIds.forEach((id: string) => participantIds.add(id));
            }
          } else {
            return; // Neither found
          }
        }

        const payload = {
          ...data,
          endedBy: userInfo.userId,
          timestamp: new Date().toISOString(),
        };

        // Send to each participant
        for (const participantId of participantIds) {
          const participantSockets = this.userSockets.get(participantId);
          if (participantSockets) {
            participantSockets.forEach(socketId => {
              this.io?.to(socketId).emit('video-call:ended', payload);
            });
          }
        }
      } catch (error) {
        console.error('📹 [WS] Error broadcasting video call ended:', error);
      }
    });

    // User joined call
    socket.on('video-call:user-joined', (data: { incidentId: string; roomName: string }) => {
      console.log('📹 [WS] User joined video call:', data.incidentId);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      const userName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Someone';

      socket.to(`incident:${data.incidentId}`).emit('video-call:user-joined', {
        ...data,
        userId: userInfo.userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    });

    // User left call
    socket.on('video-call:user-left', (data: { incidentId: string; roomName: string }) => {
      console.log('📹 [WS] User left video call:', data.incidentId);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      socket.to(`incident:${data.incidentId}`).emit('video-call:user-left', {
        ...data,
        userId: userInfo.userId,
        timestamp: new Date().toISOString(),
      });
    });

    // Spotlight evidence navigation sync
    socket.on('spotlight:evidence-changed', (data: { roomName: string; spotlightId: string; evidenceId: string; selectedIndex: number }) => {
      console.log('🔦 [WS] Spotlight evidence changed:', data.spotlightId, 'index:', data.selectedIndex);
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      // Extract incidentId from roomName (format: "spotlight_<incidentId>_<timestamp>" or just use roomName)
      // Broadcast to all other users in the same room
      socket.broadcast.emit('spotlight:evidence-changed', {
        ...data,
        userId: userInfo.userId,
        timestamp: new Date().toISOString(),
      });
    });

    // Spotlight view state (zoom/pan) sync
    socket.on('spotlight:viewChange', (data: { incidentId: string; evidenceId: string; spotlightId: string; viewState: { zoom: number; panX: number; panY: number }; userId: string }) => {
      const userInfo = this.connectedUsers.get(socket.id);
      if (!userInfo) return;

      // Broadcast zoom/pan changes to all other users in the incident room
      const roomName = `incident:${data.incidentId}`;
      socket.to(roomName).emit('spotlight:viewChanged', {
        ...data,
        timestamp: new Date().toISOString(),
      });
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
