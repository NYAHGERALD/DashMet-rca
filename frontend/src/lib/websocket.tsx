'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  incidentId: string;
  userId: string;
  content: string;
  messageType: 'TEXT' | 'SYSTEM' | 'FILE' | 'IMAGE';
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned?: boolean;
  pinnedAt?: string | null;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isOnline: boolean;
  };
  replyTo?: {
    id: string;
    content: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };

  // Allow additional fields from newer chat features without constantly widening this type.
  [key: string]: any;
}

interface TypingUser {
  userId: string;
  firstName: string;
  lastName: string;
  isTyping: boolean;
}

interface OnlineUser {
  userId: string;
  firstName?: string;
  lastName?: string;
}

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  typingUsers: Map<string, TypingUser>;
  currentIncidentId: string | null;
  // Methods
  connect: (userId: string, organizationId: string) => void;
  disconnect: () => void;
  joinIncident: (incidentId: string) => void;
  leaveIncident: (incidentId: string) => void;
  sendMessage: (incidentId: string, content: string, replyToId?: string) => void;
  setTyping: (incidentId: string, isTyping: boolean) => void;
  markMessagesRead: (incidentId: string, messageIds?: string[]) => void;
  // Event handlers
  onMessage: (callback: (message: ChatMessage) => void) => () => void;
  onMessageUpdated: (callback: (message: ChatMessage) => void) => () => void;
  onMessageDeleted: (callback: (data: { id: string; incidentId: string; isDeleted: boolean }) => void) => () => void;
  onChatNotification: (callback: (message: ChatMessage) => void) => () => void;
  onTyping: (callback: (data: TypingUser) => void) => () => void;
  onParticipantJoined: (callback: (data: { incidentId: string; userId: string; firstName: string; lastName: string }) => void) => () => void;
  onParticipantLeft: (callback: (data: { incidentId: string; userId: string }) => void) => () => void;
  onParticipantsUpdated: (callback: (data: { incidentId: string; action: string; participants?: any[]; userId?: string }) => void) => () => void;
  onParticipantRoleUpdated: (callback: (data: { incidentId: string; participantId: string; userId: string; role: string; canEdit: boolean; canChat: boolean; updatedBy: string }) => void) => () => void;
  onUserOnline: (callback: (data: OnlineUser) => void) => () => void;
  onUserOffline: (callback: (data: { userId: string }) => void) => () => void;
  // Invitation event handlers
  onInvitationReceived: (callback: (data: { incidentId: string; incidentNumber: string; customTitle?: string; invitedBy: { id: string; firstName: string; lastName: string; email: string }; role: string; invitedAt: string }) => void) => () => void;
  onInvitationDeclined: (callback: (data: { incidentId: string; incidentNumber: string; declinedBy: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  onVisibilityChanged: (callback: (data: { incidentId: string; incidentNumber?: string; visibility: string; reason?: string; declinedBy?: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  // Reaction event handler
  onReaction: (callback: (data: { messageId: string; incidentId: string; action: 'added' | 'removed'; emoji: string; userId: string; user: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  // Pin/Unpin event handlers
  onMessagePinned: (callback: (data: { messageId: string; message: ChatMessage; pinnedBy: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  onMessageUnpinned: (callback: (data: { messageId: string; message: ChatMessage; unpinnedBy: { id: string; firstName: string; lastName: string } }) => void) => () => void;
  // FMIR collaborator event handler (supports both QA auto-add and manual add)
  onFmirCollaboratorAdded: (callback: (data: any) => void) => () => void;
  // FMIR collaborator removed event handler (for real-time removal notification)
  onFmirCollaboratorRemoved: (callback: (data: { reportId: string; reportNumber: string; removedUserId: string; removedByName: string }) => void) => () => void;
  // FMIR collaborators updated event handler (for real-time list updates when collaborators change)
  onFmirCollaboratorsUpdated: (callback: (data: { reportId: string; reportNumber: string; action: 'added' | 'removed'; collaboratorIds: string[]; collaborators: any[]; updatedByName: string; updatedById: string; removedUserId?: string }) => void) => () => void;
  // FMIR visibility changed event handler
  onFmirVisibilityChanged: (callback: (data: { reportId: string; reportNumber: string; isVisible: boolean; ownerId: string }) => void) => () => void;
  // FMIR visibility off event handler (for immediate modal on collaborators)
  onFmirVisibilityOff: (callback: (data: { reportId: string; reportNumber: string; ownerId: string; ownerName: string }) => void) => () => void;
  // FMIR updated event handler (for real-time collaboration sync)
  onFmirUpdated: (callback: (data: { reportId: string; reportNumber: string; updatedById: string; updatedByName: string; updateType: 'save' | 'submit'; newStatus?: string }) => void) => () => void;
  // FMIR closed status changed event handler (for real-time lock/unlock by QA)
  onFmirClosedStatusChanged: (callback: (data: { reportId: string; reportNumber: string; isClosed: boolean; closedById: string | null; closedAt: string | null }) => void) => () => void;
  // FMIR status changed event handler (for real-time status updates by QA - e.g., SUBMITTED -> UNDER_INVESTIGATION)
  onFmirStatusChanged: (callback: (data: { reportId: string; reportNumber: string; previousStatus: string; newStatus: string; statusDisplay: string; changedBy: string; changedById: string; notes: string | null; timestamp: string }) => void) => () => void;
  // FMIR deleted event handler (for real-time deletion notification)
  onFmirDeleted: (callback: (data: { reportId: string; reportNumber: string; deletedById: string; deletedByName: string }) => void) => () => void;
  // FMIR evidence updated event handler (for real-time evidence sync)
  onFmirEvidenceUpdated: (callback: (data: { reportId: string; reportNumber: string; action: 'upload' | 'delete'; evidence?: any[]; evidenceId?: string; updatedById: string; updatedByName: string }) => void) => () => void;
  // FMIR audit progress event handler (for real-time AI audit validation progress)
  onFmirAuditProgress: (callback: (data: { reportId: string; reportNumber: string; stepId: string; stepLabel: string; stepDescription: string; status: 'pending' | 'active' | 'completed'; stepIndex: number; totalSteps: number; message?: string }) => void) => () => void;
  // FMIR comment added event handler (for real-time comment sync)
  onFmirCommentAdded: (callback: (data: { reportId: string; reportNumber: string; comment: any; addedByName: string }) => void) => () => void;
  // FMIR comment deleted event handler (for real-time comment sync)
  onFmirCommentDeleted: (callback: (data: { reportId: string; reportNumber: string; commentId: string; sectionNumber: number; deletedByName: string }) => void) => () => void;
  // Privilege changed event handler (for real-time privilege updates)
  onPrivilegeChanged: (callback: (data: { organizationId: string; changedBy: string; changedAt: string; affectedRoles?: string[]; affectedUsers?: string[]; changes?: any }) => void) => () => void;
  // Support request notification (for Admin/QC Manager real-time alerts)
  onSupportNewRequest: (callback: (data: { id: string; subject: string; description: string; category: string; recipientRole: string | null; status: string; createdAt: string; submittedByUser: any; submittedByUserEmail: string; hasAttachments: boolean }) => void) => () => void;
  // Support request status changed notification (for users who submitted requests)
  onSupportStatusChanged: (callback: (data: { id: string; subject: string; status: string; previousStatus: string; message: string; resolvedBy: { id: string; firstName: string; lastName: string } | null; updatedAt: string }) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null);
  const connectionAttempted = useRef(false);
  
  const messageCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set());
  const messageUpdatedCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set());
  const messageDeletedCallbacks = useRef<Set<(data: { id: string; incidentId: string; isDeleted: boolean }) => void>>(new Set());
  const chatNotificationCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set());
  const typingCallbacks = useRef<Set<(data: TypingUser) => void>>(new Set());
  const participantJoinedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const participantLeftCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const participantsUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const participantRoleUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const userOnlineCallbacks = useRef<Set<(data: OnlineUser) => void>>(new Set());
  const userOfflineCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const invitationReceivedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const invitationDeclinedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const visibilityChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const reactionCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const messagePinnedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const messageUnpinnedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const messagesReadCallbacks = useRef<Set<(data: { userId: string; incidentId: string }) => void>>(new Set());
  const fmirCollaboratorAddedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirCollaboratorRemovedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirCollaboratorsUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirVisibilityChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirVisibilityOffCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirClosedStatusChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirStatusChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirDeletedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirEvidenceUpdatedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirAuditProgressCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirCommentAddedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const fmirCommentDeletedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const privilegeChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const supportNewRequestCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const supportStatusChangedCallbacks = useRef<Set<(data: any) => void>>(new Set());

  const connect = useCallback((userId: string, organizationId: string) => {
    // Prevent multiple connection attempts
    if (socket?.connected || connectionAttempted.current) return;
    connectionAttempted.current = true;

    // Use WS_URL if available, otherwise derive from API_URL
    // For production: API_URL might be https://api.dashmet.com/api, we need https://api.dashmet.com for WebSocket
    let backendUrl = process.env.NEXT_PUBLIC_WS_URL;
    
    if (!backendUrl && process.env.NEXT_PUBLIC_API_URL) {
      // Remove /api suffix and keep the protocol (Socket.IO handles ws/wss automatically)
      backendUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '');
    }
    
    backendUrl = backendUrl || 'http://localhost:5002';
    
    console.log('🔌 Connecting WebSocket to:', backendUrl);
    
    const newSocket = io(backendUrl, {
      auth: { userId, organizationId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,  // Reduced from 5
      reconnectionDelay: 2000,  // Increased delay
      reconnectionDelayMax: 10000,  // Max delay between reconnection attempts
      timeout: 10000,  // Connection timeout
    });

    newSocket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
    });

    // Stop reconnection attempts after max retries
    newSocket.io.on('reconnect_failed', () => {
      console.warn('🔌 WebSocket reconnection failed - giving up');
      connectionAttempted.current = false;  // Allow manual reconnection later
    });

    // Handle chat messages
    newSocket.on('chat:message', (message: ChatMessage) => {
      messageCallbacks.current.forEach(cb => cb(message));
    });

    // Handle chat notifications (sent directly to user, not via room)
    newSocket.on('chat:notification', (message: ChatMessage) => {
      console.log('🔔 Chat notification received:', message.id);
      chatNotificationCallbacks.current.forEach(cb => cb(message));
    });

    // Handle chat message updates (e.g., question resolved/reopened)
    newSocket.on('chat:message:updated', (message: ChatMessage) => {
      messageUpdatedCallbacks.current.forEach(cb => cb(message));
    });

    // Handle chat message deletions
    newSocket.on('chat:message:deleted', (data: { id: string; incidentId: string; isDeleted: boolean }) => {
      messageDeletedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle typing indicators
    newSocket.on('chat:typing', (data: TypingUser) => {
      if (data.isTyping) {
        setTypingUsers(prev => new Map(prev).set(data.userId, data));
      } else {
        setTypingUsers(prev => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
      }
      typingCallbacks.current.forEach(cb => cb(data));
    });

    // Handle user online/offline
    newSocket.on('user:online', (data: OnlineUser) => {
      setOnlineUsers(prev => new Set(prev).add(data.userId));
      userOnlineCallbacks.current.forEach(cb => cb(data));
    });

    newSocket.on('user:offline', (data: { userId: string }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
      userOfflineCallbacks.current.forEach(cb => cb(data));
    });

    // Handle participant events
    newSocket.on('participant:joined', (data: any) => {
      participantJoinedCallbacks.current.forEach(cb => cb(data));
    });

    newSocket.on('participant:left', (data: any) => {
      participantLeftCallbacks.current.forEach(cb => cb(data));
    });

    // Handle participants updated (add/remove) - listen to both event names for compatibility
    newSocket.on('participants:updated', (data: any) => {
      participantsUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Also listen for the backend's actual event name
    newSocket.on('IncidentParticipant:updated', (data: any) => {
      console.log('👥 IncidentParticipant:updated event:', data);
      participantsUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle participant role updated
    newSocket.on('participant:role-updated', (data: any) => {
      console.log('👥 participant:role-updated event:', data);
      participantRoleUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle invitation received (sent directly to invited user)
    newSocket.on('invitation:received', (data: any) => {
      console.log('🔔 Invitation received event:', data);
      console.log('🔔 Invitation callbacks registered:', invitationReceivedCallbacks.current.size);
      invitationReceivedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle invitation declined (sent directly to owner)
    newSocket.on('invitation:declined', (data: any) => {
      console.log('🔔 Invitation declined event:', data);
      invitationDeclinedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle visibility changed (sent directly to owner or via incident room)
    newSocket.on('incident:visibility-changed', (data: any) => {
      console.log('🔔 Visibility changed event:', data);
      visibilityChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle chat reactions (real-time updates for emoji reactions)
    newSocket.on('chat:reaction', (data: any) => {
      console.log('🎉 Reaction event:', data);
      reactionCallbacks.current.forEach(cb => cb(data));
    });

    // Handle message pinned (real-time pin updates)
    newSocket.on('chat:message-pinned', (data: any) => {
      console.log('📌 Message pinned event:', data);
      messagePinnedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle message unpinned (real-time unpin updates)
    newSocket.on('chat:message-unpinned', (data: any) => {
      console.log('📌 Message unpinned event:', data);
      messageUnpinnedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle messages read (real-time read status updates)
    newSocket.on('chat:read', (data: { userId: string; incidentId: string }) => {
      console.log('✓ Messages read event:', data);
      messagesReadCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR collaborator added (when QA/Food Safety user is added to open FMIRs)
    newSocket.on('fmir:collaborator-added', (data: any) => {
      console.log('👥 FMIR collaborator added event:', data);
      fmirCollaboratorAddedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR collaborator removed (when owner removes a collaborator)
    newSocket.on('fmir:collaborator-removed', (data: any) => {
      console.log('👤 FMIR collaborator removed event:', data);
      fmirCollaboratorRemovedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR collaborators updated (broadcast to all viewers when collaborator list changes)
    newSocket.on('fmir:collaborators-updated', (data: any) => {
      console.log('👥 FMIR collaborators updated event:', data);
      fmirCollaboratorsUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR visibility changed (when owner toggles visibility)
    newSocket.on('fmir:visibility-changed', (data: any) => {
      console.log('👁️ FMIR visibility changed event:', data);
      fmirVisibilityChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR visibility OFF (sent directly to collaborators for immediate modal)
    newSocket.on('fmir:visibility-off', (data: any) => {
      console.log('🚫 FMIR visibility OFF event:', data);
      fmirVisibilityOffCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR updated (real-time collaboration sync)
    newSocket.on('fmir:updated', (data: any) => {
      console.log('📝 FMIR updated event:', data);
      fmirUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR closed status changed (real-time lock/unlock by QA)
    newSocket.on('fmir:closed-status-changed', (data: any) => {
      console.log('🔒 FMIR closed status changed event:', data);
      fmirClosedStatusChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR status changed (real-time status updates by QA - e.g., investigation toggle)
    newSocket.on('fmir:status-changed', (data: any) => {
      console.log('📊 FMIR status changed event:', data);
      fmirStatusChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR deleted (real-time deletion notification)
    newSocket.on('fmir:deleted', (data: any) => {
      console.log('🗑️ FMIR deleted event:', data);
      fmirDeletedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR evidence updated (real-time evidence sync)
    newSocket.on('fmir:evidence-updated', (data: any) => {
      console.log('📎 FMIR evidence updated event:', data);
      fmirEvidenceUpdatedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR audit progress (real-time AI audit validation progress)
    newSocket.on('fmir:audit-progress', (data: any) => {
      console.log('🔍 FMIR audit progress event:', data);
      fmirAuditProgressCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR comment added (real-time comment sync)
    newSocket.on('fmir:comment-added', (data: any) => {
      console.log('💬 FMIR comment added event:', data);
      fmirCommentAddedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle FMIR comment deleted (real-time comment sync)
    newSocket.on('fmir:comment-deleted', (data: any) => {
      console.log('🗑️ FMIR comment deleted event:', data);
      fmirCommentDeletedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle privilege changed (real-time privilege updates)
    newSocket.on('privilege:changed', (data: any) => {
      console.log('🔐 Privilege changed event:', data);
      privilegeChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle new support request (real-time notification for Admin/QC Manager)
    newSocket.on('support:new-request', (data: any) => {
      console.log('📬 New support request event:', data);
      supportNewRequestCallbacks.current.forEach(cb => cb(data));
    });

    // Handle support request status changed (real-time notification for user who submitted)
    newSocket.on('support:status-changed', (data: any) => {
      console.log('📬 Support request status changed event:', data);
      supportStatusChangedCallbacks.current.forEach(cb => cb(data));
    });

    // Handle incident participants list
    newSocket.on('incident:participants', (data: { incidentId: string; participants: any[] }) => {
      const onlineIds = data.participants.filter(p => p.isOnline).map(p => p.id);
      setOnlineUsers(prev => {
        const next = new Set(prev);
        onlineIds.forEach(id => next.add(id));
        return next;
      });
    });

    // Handle errors
    newSocket.on('error', (data: { message: string }) => {
      console.error('WebSocket error:', data.message);
    });

    setSocket(newSocket);
  }, [socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      connectionAttempted.current = false;  // Reset so we can reconnect later
    }
  }, [socket]);

  const joinIncident = useCallback((incidentId: string) => {
    if (socket?.connected) {
      socket.emit('incident:join', incidentId);
      setCurrentIncidentId(incidentId);
    }
  }, [socket]);

  const leaveIncident = useCallback((incidentId: string) => {
    if (socket?.connected) {
      socket.emit('incident:leave', incidentId);
      if (currentIncidentId === incidentId) {
        setCurrentIncidentId(null);
      }
    }
  }, [socket, currentIncidentId]);

  const sendMessage = useCallback((incidentId: string, content: string, replyToId?: string) => {
    if (socket?.connected) {
      socket.emit('chat:message', { incidentId, content, replyToId });
    }
  }, [socket]);

  const setTyping = useCallback((incidentId: string, isTyping: boolean) => {
    if (socket?.connected) {
      socket.emit('chat:typing', { incidentId, isTyping });
    }
  }, [socket]);

  const markMessagesRead = useCallback((incidentId: string, messageIds?: string[]) => {
    if (socket?.connected) {
      socket.emit('chat:read', { incidentId, messageIds });
    }
  }, [socket]);

  // Event subscription helpers
  const onMessage = useCallback((callback: (message: ChatMessage) => void) => {
    messageCallbacks.current.add(callback);
    return () => { messageCallbacks.current.delete(callback); };
  }, []);

  const onMessageUpdated = useCallback((callback: (message: ChatMessage) => void) => {
    messageUpdatedCallbacks.current.add(callback);
    return () => { messageUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onMessageDeleted = useCallback((callback: (data: { id: string; incidentId: string; isDeleted: boolean }) => void) => {
    messageDeletedCallbacks.current.add(callback);
    return () => { messageDeletedCallbacks.current.delete(callback); };
  }, []);

  const onChatNotification = useCallback((callback: (message: ChatMessage) => void) => {
    chatNotificationCallbacks.current.add(callback);
    return () => { chatNotificationCallbacks.current.delete(callback); };
  }, []);

  const onTyping = useCallback((callback: (data: TypingUser) => void) => {
    typingCallbacks.current.add(callback);
    return () => { typingCallbacks.current.delete(callback); };
  }, []);

  const onParticipantJoined = useCallback((callback: (data: any) => void) => {
    participantJoinedCallbacks.current.add(callback);
    return () => { participantJoinedCallbacks.current.delete(callback); };
  }, []);

  const onParticipantLeft = useCallback((callback: (data: any) => void) => {
    participantLeftCallbacks.current.add(callback);
    return () => { participantLeftCallbacks.current.delete(callback); };
  }, []);

  const onParticipantsUpdated = useCallback((callback: (data: any) => void) => {
    participantsUpdatedCallbacks.current.add(callback);
    return () => { participantsUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onParticipantRoleUpdated = useCallback((callback: (data: any) => void) => {
    participantRoleUpdatedCallbacks.current.add(callback);
    return () => { participantRoleUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onUserOnline = useCallback((callback: (data: OnlineUser) => void) => {
    userOnlineCallbacks.current.add(callback);
    return () => { userOnlineCallbacks.current.delete(callback); };
  }, []);

  const onUserOffline = useCallback((callback: (data: any) => void) => {
    userOfflineCallbacks.current.add(callback);
    return () => { userOfflineCallbacks.current.delete(callback); };
  }, []);

  const onInvitationReceived = useCallback((callback: (data: any) => void) => {
    console.log('📝 Registering invitation:received callback, total callbacks:', invitationReceivedCallbacks.current.size + 1);
    invitationReceivedCallbacks.current.add(callback);
    return () => { 
      invitationReceivedCallbacks.current.delete(callback);
      console.log('📝 Unregistered invitation:received callback, remaining callbacks:', invitationReceivedCallbacks.current.size);
    };
  }, []);

  const onInvitationDeclined = useCallback((callback: (data: any) => void) => {
    invitationDeclinedCallbacks.current.add(callback);
    return () => { invitationDeclinedCallbacks.current.delete(callback); };
  }, []);

  const onVisibilityChanged = useCallback((callback: (data: any) => void) => {
    visibilityChangedCallbacks.current.add(callback);
    return () => { visibilityChangedCallbacks.current.delete(callback); };
  }, []);

  const onReaction = useCallback((callback: (data: any) => void) => {
    reactionCallbacks.current.add(callback);
    return () => { reactionCallbacks.current.delete(callback); };
  }, []);

  const onMessagePinned = useCallback((callback: (data: any) => void) => {
    messagePinnedCallbacks.current.add(callback);
    return () => { messagePinnedCallbacks.current.delete(callback); };
  }, []);

  const onMessageUnpinned = useCallback((callback: (data: any) => void) => {
    messageUnpinnedCallbacks.current.add(callback);
    return () => { messageUnpinnedCallbacks.current.delete(callback); };
  }, []);

  const onMessagesRead = useCallback((callback: (data: { userId: string; incidentId: string }) => void) => {
    messagesReadCallbacks.current.add(callback);
    return () => { messagesReadCallbacks.current.delete(callback); };
  }, []);

  const onFmirCollaboratorAdded = useCallback((callback: (data: any) => void) => {
    fmirCollaboratorAddedCallbacks.current.add(callback);
    return () => { fmirCollaboratorAddedCallbacks.current.delete(callback); };
  }, []);

  const onFmirCollaboratorRemoved = useCallback((callback: (data: any) => void) => {
    fmirCollaboratorRemovedCallbacks.current.add(callback);
    return () => { fmirCollaboratorRemovedCallbacks.current.delete(callback); };
  }, []);

  const onFmirCollaboratorsUpdated = useCallback((callback: (data: any) => void) => {
    fmirCollaboratorsUpdatedCallbacks.current.add(callback);
    return () => { fmirCollaboratorsUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onFmirVisibilityChanged = useCallback((callback: (data: any) => void) => {
    fmirVisibilityChangedCallbacks.current.add(callback);
    return () => { fmirVisibilityChangedCallbacks.current.delete(callback); };
  }, []);

  const onFmirVisibilityOff = useCallback((callback: (data: any) => void) => {
    fmirVisibilityOffCallbacks.current.add(callback);
    return () => { fmirVisibilityOffCallbacks.current.delete(callback); };
  }, []);

  const onFmirUpdated = useCallback((callback: (data: any) => void) => {
    fmirUpdatedCallbacks.current.add(callback);
    return () => { fmirUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onFmirClosedStatusChanged = useCallback((callback: (data: any) => void) => {
    fmirClosedStatusChangedCallbacks.current.add(callback);
    return () => { fmirClosedStatusChangedCallbacks.current.delete(callback); };
  }, []);

  const onFmirStatusChanged = useCallback((callback: (data: any) => void) => {
    fmirStatusChangedCallbacks.current.add(callback);
    return () => { fmirStatusChangedCallbacks.current.delete(callback); };
  }, []);

  const onFmirDeleted = useCallback((callback: (data: any) => void) => {
    fmirDeletedCallbacks.current.add(callback);
    return () => { fmirDeletedCallbacks.current.delete(callback); };
  }, []);

  const onFmirEvidenceUpdated = useCallback((callback: (data: any) => void) => {
    fmirEvidenceUpdatedCallbacks.current.add(callback);
    return () => { fmirEvidenceUpdatedCallbacks.current.delete(callback); };
  }, []);

  const onFmirAuditProgress = useCallback((callback: (data: any) => void) => {
    fmirAuditProgressCallbacks.current.add(callback);
    return () => { fmirAuditProgressCallbacks.current.delete(callback); };
  }, []);

  const onFmirCommentAdded = useCallback((callback: (data: any) => void) => {
    fmirCommentAddedCallbacks.current.add(callback);
    return () => { fmirCommentAddedCallbacks.current.delete(callback); };
  }, []);

  const onFmirCommentDeleted = useCallback((callback: (data: any) => void) => {
    fmirCommentDeletedCallbacks.current.add(callback);
    return () => { fmirCommentDeletedCallbacks.current.delete(callback); };
  }, []);

  const onPrivilegeChanged = useCallback((callback: (data: any) => void) => {
    privilegeChangedCallbacks.current.add(callback);
    return () => { privilegeChangedCallbacks.current.delete(callback); };
  }, []);

  const onSupportNewRequest = useCallback((callback: (data: any) => void) => {
    supportNewRequestCallbacks.current.add(callback);
    return () => { supportNewRequestCallbacks.current.delete(callback); };
  }, []);

  const onSupportStatusChanged = useCallback((callback: (data: any) => void) => {
    supportStatusChangedCallbacks.current.add(callback);
    return () => { supportStatusChangedCallbacks.current.delete(callback); };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        typingUsers,
        currentIncidentId,
        connect,
        disconnect,
        joinIncident,
        leaveIncident,
        sendMessage,
        setTyping,
        markMessagesRead,
        onMessage,
        onMessageUpdated,
        onMessageDeleted,
        onChatNotification,
        onTyping,
        onParticipantJoined,
        onParticipantLeft,
        onParticipantsUpdated,
        onParticipantRoleUpdated,
        onUserOnline,
        onUserOffline,
        onInvitationReceived,
        onInvitationDeclined,
        onVisibilityChanged,
        onReaction,
        onMessagePinned,
        onMessageUnpinned,
        onMessagesRead,
        onFmirCollaboratorAdded,
        onFmirCollaboratorRemoved,
        onFmirCollaboratorsUpdated,
        onFmirVisibilityChanged,
        onFmirVisibilityOff,
        onFmirUpdated,
        onFmirClosedStatusChanged,
        onFmirStatusChanged,
        onFmirDeleted,
        onFmirEvidenceUpdated,
        onFmirAuditProgress,
        onFmirCommentAdded,
        onFmirCommentDeleted,
        onPrivilegeChanged,
        onSupportNewRequest,
        onSupportStatusChanged,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
