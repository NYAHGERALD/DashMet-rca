'use client';

import React, { createContext, useContext, useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/lib/websocket';
import { browserNotificationService, BrowserNotification } from '@/lib/browserNotifications';
import { chatUnreadStore } from '@/lib/chatUnreadStore';
import api from '@/lib/api';
import { useLswBrowserNotifications } from '@/hooks/useLswBrowserNotifications';
import { alertSoundService } from '@/lib/alertSounds';

interface BrowserNotificationContextType {
  requestPermission: () => Promise<NotificationPermission>;
  getPermission: () => NotificationPermission;
  permission: NotificationPermission;
  isSupported: boolean;
  setChatOpen: (incidentId: string, isOpen: boolean) => void;
  getUnreadCount: () => number;
  refreshNotifications: () => void;
  getChatUnreadCount: (incidentId: string) => number;
}

const BrowserNotificationContext = createContext<BrowserNotificationContextType | null>(null);

export function BrowserNotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const { onMessage, onChatNotification, onInvitationReceived, currentIncidentId, connect, isConnected } = useWebSocket();
  const lastMessageTime = useRef<Map<string, number>>(new Map());
  const processedMessages = useRef<Set<string>>(new Set());
  const [permission, setPermission] = useState<NotificationPermission>(() => 
    typeof window !== 'undefined' ? browserNotificationService.getPermission() : 'default'
  );
  useLswBrowserNotifications(Boolean(user));

  // Auto-connect WebSocket when user is logged in
  useEffect(() => {
    console.log('🔌 BrowserNotificationProvider: Checking WebSocket connection', { 
      hasUser: !!user, 
      userId: user?.id, 
      isConnected 
    });
    if (user && !isConnected) {
      console.log('🔌 BrowserNotificationProvider: Auto-connecting WebSocket for user', user.id);
      connect(user.id, user.organizationId);
    }
  }, [user, isConnected, connect]);

  // Set up notification click handler
  useEffect(() => {
    browserNotificationService.setOnNotificationClick((notification: BrowserNotification) => {
      if (notification.data?.url) {
        router.push(notification.data.url);
      }
      alertSoundService.stopRepeat();
    });
  }, [router]);

  // NOTE: We no longer auto-mark chat as open based on currentIncidentId
  // Chat open state is now controlled manually via setChatOpen() from ChatSidebar
  // This ensures notifications only stop when the chat sidebar is actually visible

  // Listen for team invitation events
  useEffect(() => {
    const unsubscribe = onInvitationReceived(async (data: {
      incidentId: string;
      incidentNumber: string;
      customTitle?: string;
      invitedBy: { id: string; firstName: string; lastName: string; email: string };
      role: string;
      invitedAt: string;
    }) => {
      console.log('🔔 Browser notification: Received team invitation:', data);
      
      // Show browser notification for team invitation
      await browserNotificationService.showTeamInvitation({
        incidentId: data.incidentId,
        incidentNumber: data.incidentNumber,
        customTitle: data.customTitle,
        invitedBy: data.invitedBy,
        role: data.role,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [onInvitationReceived]);

  // Helper function to handle incoming chat messages (update unread count, show notifications)
  const handleIncomingMessage = useCallback(async (message: any, source: string) => {
    console.log(`📨 ${source}: Received message`, { id: message.id, userId: message.userId, currentUserId: user?.id });
    
    if (!user) {
      console.log(`❌ ${source}: No user, skipping`);
      return;
    }

    // Don't process own messages
    if (message.userId === user.id) {
      console.log(`❌ ${source}: Own message, skipping`);
      return;
    }

    // Don't process system messages for notifications (but still count them)
    const isSystemMessage = message.messageType === 'SYSTEM';

    // Deduplicate - prevent processing the same message twice (from both onMessage and onChatNotification)
    const messageKey = `${message.id}_${source}`;
    if (processedMessages.current.has(message.id)) {
      console.log(`🔕 ${source}: Message ${message.id} already processed, skipping`);
      return;
    }
    processedMessages.current.add(message.id);
    
    // Cleanup old processed messages (keep last 100)
    if (processedMessages.current.size > 100) {
      const entries = Array.from(processedMessages.current);
      entries.slice(0, 50).forEach(id => processedMessages.current.delete(id));
    }

    const isChatCurrentlyOpen = browserNotificationService.isChatOpen(message.incidentId);
    console.log(`📬 ${source}: Chat open status for ${message.incidentId}: ${isChatCurrentlyOpen}`);

    // Always increment unread count if chat is not open (regardless of throttle)
    if (!isChatCurrentlyOpen) {
      const newCount = chatUnreadStore.incrementCount(message.incidentId);
      console.log(`📬 ${source}: Incremented unread count for ${message.incidentId} to ${newCount}`);

      // Create in-app notification (for the bell icon)
      try {
        const senderData = message.User || message.user;
        const senderName = senderData 
          ? `${senderData.firstName} ${senderData.lastName}` 
          : 'Someone';
        
        await api.post('/notifications', {
          type: 'COMMENT_ADDED',
          title: 'New Chat Message',
          message: `${senderName}: ${(message.content || 'New message').substring(0, 100)}`,
          incidentId: message.incidentId,
        });
      } catch (error) {
        // Notification creation may fail if user already has one, that's ok
        console.log('In-app notification creation skipped or failed');
      }
    }

    // Skip browser notification for system messages
    if (isSystemMessage) return;

    // Don't show browser notification if chat is open
    if (browserNotificationService.isChatOpen(message.incidentId)) {
      console.log(`🔕 ${source}: Chat is open for incident, skipping browser notification`);
      return;
    }

    // Throttle browser notifications: Don't send if we sent one in the last 30 seconds
    const lastTime = lastMessageTime.current.get(message.incidentId) || 0;
    if (Date.now() - lastTime < 30000) {
      console.log(`🔕 ${source}: Browser notification throttled`);
      return;
    }
    lastMessageTime.current.set(message.incidentId, Date.now());

    // Check if user is mentioned
    const isMention = message.content?.toLowerCase().includes(`@${user.firstName.toLowerCase()}`) ||
                      message.content?.toLowerCase().includes(`@${user.lastName.toLowerCase()}`) ||
                      message.content?.includes(`@${user.id}`);

    // Get sender name - handle both User and user property names
    const senderData = message.User || message.user;
    const senderName = senderData 
      ? `${senderData.firstName} ${senderData.lastName}` 
      : 'Someone';
    const senderId = senderData?.id || message.userId;

    // Get incident number from data or construct a fallback
    const incidentNumber = (message as any).incidentNumber || (message as any).incident?.incidentNumber || 'Incident';

    console.log(`🔔 ${source}: Showing browser notification from ${senderName}`);

    // Show browser notification
    await browserNotificationService.showChatNotification({
      incidentId: message.incidentId,
      incidentNumber,
      senderName,
      senderId,
      messagePreview: message.content || 'New message',
      isMention,
    });
  }, [user]);

  // Listen for chat messages via incident room (when on incident page)
  useEffect(() => {
    if (!user) {
      console.log('🔕 BrowserNotificationProvider: No user, skipping onMessage subscription');
      return;
    }

    console.log('✅ BrowserNotificationProvider: Subscribing to onMessage');
    const unsubscribe = onMessage(async (message) => {
      console.log('📨 onMessage triggered with:', message.id);
      await handleIncomingMessage(message, 'onMessage');
    });

    return () => {
      console.log('🔕 BrowserNotificationProvider: Unsubscribing from onMessage');
      unsubscribe();
    };
  }, [user, onMessage, handleIncomingMessage]);

  // Listen for direct chat notifications (sent to user socket, works anywhere)
  useEffect(() => {
    if (!user) {
      console.log('🔕 BrowserNotificationProvider: No user, skipping onChatNotification subscription');
      return;
    }

    console.log('✅ BrowserNotificationProvider: Subscribing to onChatNotification');
    const unsubscribe = onChatNotification(async (message) => {
      console.log('📨 onChatNotification triggered with:', message.id);
      await handleIncomingMessage(message, 'onChatNotification');
    });

    return () => {
      console.log('🔕 BrowserNotificationProvider: Unsubscribing from onChatNotification');
      unsubscribe();
    };
  }, [user, onChatNotification, handleIncomingMessage]);

  const requestPermission = useCallback(async () => {
    const result = await browserNotificationService.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const getPermission = useCallback(() => {
    return browserNotificationService.getPermission();
  }, []);

  const setChatOpen = useCallback((incidentId: string, isOpen: boolean) => {
    browserNotificationService.setChatOpen(incidentId, isOpen);
    // Also clear the unread count when chat is opened
    if (isOpen) {
      chatUnreadStore.clearCount(incidentId);
    }
  }, []);

  const getUnreadCount = useCallback(() => {
    return browserNotificationService.getUnreadCount();
  }, []);

  const getChatUnreadCount = useCallback((incidentId: string) => {
    return chatUnreadStore.getCount(incidentId);
  }, []);

  const refreshNotifications = useCallback(() => {
    // This is used to trigger re-renders when notification state changes
    // The actual state is managed by browserNotificationService
  }, []);

  const value: BrowserNotificationContextType = {
    requestPermission,
    getPermission,
    permission,
    isSupported: browserNotificationService.isNotificationSupported(),
    setChatOpen,
    getUnreadCount,
    getChatUnreadCount,
    refreshNotifications,
  };

  return (
    <BrowserNotificationContext.Provider value={value}>
      {children}
    </BrowserNotificationContext.Provider>
  );
}

export function useBrowserNotifications() {
  const context = useContext(BrowserNotificationContext);
  if (!context) {
    throw new Error('useBrowserNotifications must be used within BrowserNotificationProvider');
  }
  return context;
}
