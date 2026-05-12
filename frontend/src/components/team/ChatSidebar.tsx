'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '@/lib/websocket';
import { chatUnreadStore } from '@/lib/chatUnreadStore';
import { useBrowserNotifications } from '@/components/providers/BrowserNotificationProvider';
import { useVideoCall } from '@/components/providers/VideoCallProvider';
import api from '@/lib/api';
import {
  MessageCircle,
  X,
  Users,
  MessageSquare,
  ChevronRight,
  Archive,
  Clock,
  Maximize2,
  Minimize2,
  Video,
  Phone,
  PhoneCall,
  Film,
  History,
} from 'lucide-react';
import IncidentChatPanel from './IncidentChatPanel';
import TeamParticipantSelector from './TeamParticipantSelector';
import ArchivedChatPanel from './ArchivedChatPanel';
import ActivityLogPanel from './ActivityLogPanel';
import RecordingHistoryPanel from './RecordingHistoryPanel';
import DiscussionHistoryPanel from './DiscussionHistoryPanel';

interface Participant {
  id: string;
  userId: string;
  role: 'OWNER' | 'LEAD' | 'MEMBER' | 'OBSERVER';
  canEdit: boolean;
  canChat: boolean;
  isActive?: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
    isOnline?: boolean;
  };
}

interface ChatSidebarProps {
  incidentId: string;
  incidentTitle?: string;
  currentUserId: string;
  organizationId: string;
  isParticipant: boolean;
  participants: Participant[];
  onParticipantsChange: (participants: Participant[]) => void;
  isTeamIncident?: boolean;
  onVisibilityChange?: (newVisibility: 'PRIVATE' | 'TEAM' | 'PUBLIC') => void;
  visibility?: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  // New props for external control
  defaultOpen?: boolean;
  defaultTab?: TabType;
  onTeamTabClosed?: (hasTeamMembers: boolean) => void;
  ownerId?: string; // To exclude owner from team member count
  versionHistory?: Array<{
    id: string;
    versionNumber: number | string;
    createdAt: string;
    changeReason?: string | null;
    createdBy?: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null;
  }>;
}

type TabType = 'chat' | 'archived' | 'team' | 'activity' | 'recordings' | 'discussions';
type ModalPosition = { left: number; top: number };
type ModalDragState = ModalPosition & {
  pointerId: number;
  startX: number;
  startY: number;
};

export default function ChatSidebar({
  incidentId,
  incidentTitle,
  currentUserId,
  organizationId,
  isParticipant,
  participants,
  onParticipantsChange,
  isTeamIncident = false,
  onVisibilityChange,
  visibility,
  defaultOpen = false,
  defaultTab = 'chat',
  onTeamTabClosed,
  ownerId,
  versionHistory = [],
}: ChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [unreadCount, setUnreadCount] = useState(() => chatUnreadStore.getCount(incidentId));
  const [hasArchivedMessages, setHasArchivedMessages] = useState(false);
  const [detachedTab, setDetachedTab] = useState<TabType | null>(null);
  const [detachedModalPosition, setDetachedModalPosition] = useState<ModalPosition | null>(null);
  const [isDetachedModalDragging, setIsDetachedModalDragging] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const detachedModalRef = useRef<HTMLDivElement>(null);
  const detachedDragStateRef = useRef<ModalDragState | null>(null);
  const previousTabRef = useRef<TabType>(defaultTab);
  const originalTitleRef = useRef<string>('');

  const { isConnected, socket, markMessagesRead } = useWebSocket();
  const { setChatOpen } = useBrowserNotifications();
  const { startCall, isCallActive, joinCall, terminateCall } = useVideoCall();
  
  // Track if there's an active call for this incident that user can join
  const [activeCallInfo, setActiveCallInfo] = useState<{
    roomUrl: string;
    roomName: string;
    createdBy: string;
  } | null>(null);
  const [isEndingCall, setIsEndingCall] = useState(false);
  
  // Check for active call when component mounts and periodically
  useEffect(() => {
    const checkActiveCall = async () => {
      try {
        const response = await api.get(`/video-call/incident/${incidentId}/active-call`);
        if (response.data.success && response.data.hasActiveCall && response.data.room) {
          setActiveCallInfo({
            roomUrl: response.data.room.roomUrl,
            roomName: response.data.room.roomName,
            createdBy: response.data.room.createdBy,
          });
        } else {
          setActiveCallInfo(null);
        }
      } catch (err) {
        console.log('📹 Could not check for active call:', err);
      }
    };
    
    // Check immediately
    checkActiveCall();
    
    // Check every 30 seconds
    const intervalId = setInterval(checkActiveCall, 30000);
    
    return () => clearInterval(intervalId);
  }, [incidentId]);

  // Listen for video-call:ended websocket event to clear active call info
  useEffect(() => {
    if (!socket) return;
    
    const handleCallEnded = (data: { incidentId: string; roomName: string }) => {
      console.log('📹 [ChatSidebar] Received video-call:ended event:', data);
      if (data.incidentId === incidentId) {
        setActiveCallInfo(null);
      }
    };
    
    socket.on('video-call:ended', handleCallEnded);
    
    return () => {
      socket.off('video-call:ended', handleCallEnded);
    };
  }, [socket, incidentId]);

  // Subscribe to persistent unread count changes
  useEffect(() => {
    // Initialize with stored count
    setUnreadCount(chatUnreadStore.getCount(incidentId));

    // Subscribe to changes
    const unsubscribe = chatUnreadStore.subscribe((changedIncidentId, count) => {
      if (changedIncidentId === incidentId) {
        setUnreadCount(count);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [incidentId]);

  // Track browser tab visibility
  useEffect(() => {
    // Store original document title
    originalTitleRef.current = document.title;

    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsTabVisible(visible);
      
      // Reset title when tab becomes visible and chat is open
      if (visible && isOpen && unreadCount === 0) {
        document.title = originalTitleRef.current;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Restore original title on unmount
      document.title = originalTitleRef.current;
    };
  }, [isOpen, unreadCount]);

  // Update document title with unread count
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount > 99 ? '99+' : unreadCount}) ${originalTitleRef.current}`;
    } else if (isTabVisible) {
      document.title = originalTitleRef.current;
    }
  }, [unreadCount, isTabVisible]);

  // Sync with defaultOpen prop when it changes (for external control)
  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  // Sync with defaultTab prop when it changes (for external control)
  useEffect(() => {
    setActiveTab(defaultTab);
    previousTabRef.current = defaultTab;
  }, [defaultTab]);

  // If visibility is not TEAM and active tab is 'chat', switch to 'team' tab
  // Chat tab is hidden when visibility is not TEAM
  useEffect(() => {
    if (visibility !== 'TEAM' && activeTab === 'chat') {
      setActiveTab('team');
      previousTabRef.current = 'team';
    }
  }, [visibility, activeTab]);

  useEffect(() => {
    if (visibility !== 'TEAM' && detachedTab === 'chat') {
      setDetachedTab('team');
    }
  }, [visibility, detachedTab]);

  // Helper to count non-owner team members
  const getNonOwnerTeamMemberCount = useCallback(() => {
    const ownerIdToUse = ownerId || currentUserId;
    return participants.filter(p => p.userId !== ownerIdToUse && p.isActive !== false).length;
  }, [participants, ownerId, currentUserId]);

  // Handle tab changes and notify when leaving team tab
  const handleTabChange = useCallback((newTab: TabType) => {
    const wasOnTeamTab = activeTab === 'team';
    setActiveTab(newTab);
    previousTabRef.current = newTab;
    
    // If leaving team tab, notify parent about team member status
    if (wasOnTeamTab && newTab !== 'team' && onTeamTabClosed) {
      const hasTeamMembers = getNonOwnerTeamMemberCount() > 0;
      onTeamTabClosed(hasTeamMembers);
    }
  }, [activeTab, onTeamTabClosed, getNonOwnerTeamMemberCount]);

  const handleDetachedTabChange = useCallback((newTab: TabType) => {
    setDetachedTab(newTab);
    handleTabChange(newTab);
  }, [handleTabChange]);

  // Handle sidebar close
  const handleCloseSidebar = useCallback(() => {
    // If closing while on team tab, notify parent
    if (activeTab === 'team' && onTeamTabClosed) {
      const hasTeamMembers = getNonOwnerTeamMemberCount() > 0;
      onTeamTabClosed(hasTeamMembers);
    }
    setIsOpen(false);
  }, [activeTab, onTeamTabClosed, getNonOwnerTeamMemberCount]);

  // Fetch unread count from backend and sync with persistent store
  const fetchUnreadCount = useCallback(async () => {
    if (!incidentId) return;
    
    try {
      const response = await api.get(`/chat/${incidentId}/unread-count`);
      const backendCount = response.data?.data?.unreadCount || 0;
      const localCount = chatUnreadStore.getCount(incidentId);
      
      // Use the higher of backend count or local count
      // Local count may be higher if notifications came in while not on this page
      const finalCount = Math.max(backendCount, localCount);
      
      if (finalCount !== localCount) {
        chatUnreadStore.setCount(incidentId, finalCount);
      }
      setUnreadCount(finalCount);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [incidentId]);

  // Check for archived messages
  const checkArchivedMessages = useCallback(async () => {
    if (!incidentId) return;
    
    try {
      const response = await api.get(`/chat/${incidentId}/archived/metadata`);
      setHasArchivedMessages(response.data?.data?.hasArchivedMessages || false);
    } catch (error) {
      console.error('Failed to check archived messages:', error);
    }
  }, [incidentId]);

  // Get browser notification functions from context
  const { requestPermission, permission } = useBrowserNotifications();

  // Initial fetch
  useEffect(() => {
    if (incidentId) {
      fetchUnreadCount();
      checkArchivedMessages();
      
      // Request notification permission if not already granted
      if (permission === 'default') {
        requestPermission();
      }
    }
  }, [incidentId, fetchUnreadCount, checkArchivedMessages, permission, requestPermission]);

  // Listen for chat:archived WebSocket event
  useEffect(() => {
    if (!socket || !incidentId) return;

    const handleChatArchived = (data: { incidentId: string }) => {
      if (data.incidentId === incidentId) {
        // Chat was archived, update the archived messages state
        setHasArchivedMessages(true);
        // Re-check to get accurate data
        checkArchivedMessages();
      }
    };

    socket.on('chat:archived', handleChatArchived);
    return () => {
      socket.off('chat:archived', handleChatArchived);
    };
  }, [socket, incidentId, checkArchivedMessages]);

  // Note: Chat message handling and unread count updates are now managed globally
  // by BrowserNotificationProvider using chatUnreadStore for persistence.
  // The component subscribes to chatUnreadStore changes above.

  // Sync local unread count with backend when sidebar opens
  useEffect(() => {
    if (!isOpen) {
      // When closed, sync with backend to get accurate count
      fetchUnreadCount();
    }
  }, [isOpen, fetchUnreadCount]);

  // Mark messages as read on the backend and via WebSocket
  const markMessagesAsRead = useCallback(async () => {
    if (!incidentId) return;
    try {
      // Use WebSocket to mark as read and notify other users in real-time
      markMessagesRead(incidentId);
      // Also call REST API for persistence
      await api.post(`/chat/${incidentId}/mark-read`);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [incidentId, markMessagesRead]);

  useEffect(() => {
    const handleOpenIncidentChat = (event: Event) => {
      const detail = (event as CustomEvent<{ incidentId?: string; tab?: TabType }>).detail;
      if (!detail?.incidentId || detail.incidentId !== incidentId) return;

      const requestedTab = detail.tab || 'chat';
      setDetachedTab(null);
      handleTabChange(requestedTab);
      setIsOpen(true);
      chatUnreadStore.clearCount(incidentId);
      markMessagesAsRead();
      document.title = originalTitleRef.current;
      setChatOpen(incidentId, true);
    };

    window.addEventListener('dashmet:open-incident-chat', handleOpenIncidentChat);
    return () => {
      window.removeEventListener('dashmet:open-incident-chat', handleOpenIncidentChat);
    };
  }, [incidentId, handleTabChange, markMessagesAsRead, setChatOpen]);

  const toggleSidebar = () => {
    if (isOpen) {
      // Closing - use the handler that notifies about team members
      handleCloseSidebar();
    } else {
      // Opening - clear unread count, mark as read, and restore document title
      setIsOpen(true);
      chatUnreadStore.clearCount(incidentId); // Clear persistent count
      markMessagesAsRead();
      document.title = originalTitleRef.current;
      // Mark chat as open in notification service (prevents duplicate notifications)
      setChatOpen(incidentId, true);
    }
  };

  // When sidebar closes, mark chat as closed for notification service
  useEffect(() => {
    if (incidentId) {
      setChatOpen(incidentId, isOpen || Boolean(detachedTab));
    }
  }, [isOpen, detachedTab, incidentId, setChatOpen]);

  const clampDetachedModalPosition = useCallback((position: ModalPosition): ModalPosition => {
    if (typeof window === 'undefined') {
      return position;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const modal = detachedModalRef.current;
    const modalWidth = modal?.offsetWidth || Math.min(1280, Math.max(320, viewportWidth - 16));
    const modalHeight = modal?.offsetHeight || Math.min(832, Math.max(360, viewportHeight - 16));
    const margin = 8;

    return {
      left: Math.min(
        Math.max(margin, position.left),
        Math.max(margin, viewportWidth - modalWidth - margin)
      ),
      top: Math.min(
        Math.max(margin, position.top),
        Math.max(margin, viewportHeight - modalHeight - margin)
      ),
    };
  }, []);

  const centerDetachedModal = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      const modal = detachedModalRef.current;
      if (!modal) {
        return;
      }

      const modalWidth = modal?.offsetWidth || Math.min(1280, Math.max(320, window.innerWidth - 16));
      const modalHeight = modal?.offsetHeight || Math.min(832, Math.max(360, window.innerHeight - 16));

      setDetachedModalPosition(
        clampDetachedModalPosition({
          left: (window.innerWidth - modalWidth) / 2,
          top: (window.innerHeight - modalHeight) / 2,
        })
      );
    });
  }, [clampDetachedModalPosition]);

  useEffect(() => {
    if (!detachedTab) {
      detachedDragStateRef.current = null;
      setDetachedModalPosition(null);
      setIsDetachedModalDragging(false);
      return;
    }

    centerDetachedModal();
  }, [detachedTab, centerDetachedModal]);

  useEffect(() => {
    if (!detachedTab || typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setDetachedModalPosition((position) =>
        position ? clampDetachedModalPosition(position) : position
      );
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [detachedTab, clampDetachedModalPosition]);

  const handleDetachedModalPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"], [data-no-drag="true"]')) {
      return;
    }

    const modal = detachedModalRef.current;
    if (!modal) {
      return;
    }

    const rect = modal.getBoundingClientRect();
    const startPosition = clampDetachedModalPosition({
      left: rect.left,
      top: rect.top,
    });

    detachedDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: startPosition.left,
      top: startPosition.top,
    };

    setDetachedModalPosition(startPosition);
    setIsDetachedModalDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [clampDetachedModalPosition]);

  const handleDetachedModalPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = detachedDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    setDetachedModalPosition(
      clampDetachedModalPosition({
        left: dragState.left + event.clientX - dragState.startX,
        top: dragState.top + event.clientY - dragState.startY,
      })
    );
  }, [clampDetachedModalPosition]);

  const handleDetachedModalPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (detachedDragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    detachedDragStateRef.current = null;
    setIsDetachedModalDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  // Detach a tab into modal view
  const handleDetachTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
    previousTabRef.current = tab;
    setDetachedTab(tab);
    setIsOpen(false);
  }, []);

  // Minimize the detached tab back into the sidebar
  const handleMinimizeDetachedTab = useCallback(() => {
    if (detachedTab) {
      setActiveTab(detachedTab);
      previousTabRef.current = detachedTab;
    }
    setDetachedTab(null);
    setIsOpen(true);
  }, [detachedTab]);

  const handleCloseDetachedTab = useCallback(() => {
    if (detachedTab) {
      setActiveTab(detachedTab);
      previousTabRef.current = detachedTab;
    }

    if (detachedTab === 'team' && onTeamTabClosed) {
      const hasTeamMembers = getNonOwnerTeamMemberCount() > 0;
      onTeamTabClosed(hasTeamMembers);
    }

    setDetachedTab(null);
    setIsOpen(false);
  }, [detachedTab, onTeamTabClosed, getNonOwnerTeamMemberCount]);

  // Get tab display name
  const getTabDisplayName = (tab: TabType): string => {
    switch (tab) {
      case 'chat': return 'Chat';
      case 'archived': return 'Archived';
      case 'team': return 'Team';
      case 'activity': return 'Activity';
      case 'recordings': return 'Recordings';
      case 'discussions': return 'Discussions';
      default: return '';
    }
  };

  // Show sidebar when user is a participant (either through team mode or has participants)
  if (!isParticipant) {
    return null;
  }

  const detachedModalStyle: React.CSSProperties = {
    width: 'min(80rem, calc(100vw - 1rem))',
    height: 'min(52rem, calc(100dvh - 1rem))',
    ...(detachedModalPosition
      ? {
          left: `${detachedModalPosition.left}px`,
          top: `${detachedModalPosition.top}px`,
        }
      : {
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }),
  };
  const detachedPanelTab = detachedTab || activeTab;

  return (
    <>
      {/* Toggle Button - Fixed position */}
      {!isOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all duration-200 z-50 group hover:scale-105 active:scale-95"
          title={unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'Open Chat & Team'}
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <>
              {/* Notification badge */}
              <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
              {/* Pulse animation ring */}
              <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] bg-red-400 rounded-full animate-ping opacity-75" />
            </>
          )}
        </button>
      )}

      {/* Slide-out Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-full bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out z-[60] flex flex-col w-full sm:w-[480px] md:w-[580px] lg:w-[640px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ height: '100dvh' }}
      >
        {/* Header */}
        <div className="flex-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-semibold text-sm truncate max-w-[280px]">
                {incidentTitle || 'Incident Chat'}
              </span>
              {!isConnected && (
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" title="Reconnecting..." />
              )}
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleDetachTab(activeTab)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title={`Expand ${getTabDisplayName(activeTab)} to full view`}
              >
                <Maximize2 className="w-5 h-5" />
              </button>
              <button
                onClick={toggleSidebar}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Close sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs - Scrollable on mobile */}
          <div className="flex border-t border-white/20 overflow-x-auto scrollbar-hide">
            {/* Chat Tab - Only show when visibility is TEAM */}
            {visibility === 'TEAM' && (
              <button
                onClick={() => handleTabChange('chat')}
                className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'chat'
                    ? 'bg-white/20'
                    : 'hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-center space-x-1.5">
                  <MessageSquare className="w-4 h-4" />
                  <span className="whitespace-nowrap">Chat</span>
                  {unreadCount > 0 && activeTab !== 'chat' && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {activeTab === 'chat' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                )}
              </button>
            )}

            {/* Archived Chat Tab - Only show if there are archived messages (visible to owner even if not TEAM) */}
            {hasArchivedMessages && (
              <button
                onClick={() => handleTabChange('archived')}
                className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'archived'
                    ? 'bg-white/20'
                    : 'hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-center space-x-1.5">
                  <Archive className="w-4 h-4" />
                  <span className="whitespace-nowrap">Archive</span>
                </div>
                {activeTab === 'archived' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                )}
              </button>
            )}
            
            <button
              onClick={() => handleTabChange('team')}
              className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'team'
                  ? 'bg-white/20'
                  : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-center space-x-1.5">
                <Users className="w-4 h-4" />
                <span className="whitespace-nowrap">Team</span>
                <span className="text-xs opacity-75">
                  ({participants.length})
                </span>
              </div>
              {activeTab === 'team' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
              )}
            </button>

            {/* Activity Tab */}
            <button
              onClick={() => handleTabChange('activity')}
              className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'activity'
                  ? 'bg-white/20'
                  : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-center space-x-1.5">
                <Clock className="w-4 h-4" />
                <span className="whitespace-nowrap">Activity</span>
              </div>
              {activeTab === 'activity' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
              )}
            </button>

            {/* Recordings Tab */}
            <button
              onClick={() => handleTabChange('recordings')}
              className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'recordings'
                  ? 'bg-white/20'
                  : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-center space-x-1.5">
                <Film className="w-4 h-4" />
                <span className="whitespace-nowrap">Recordings</span>
              </div>
              {activeTab === 'recordings' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
              )}
            </button>

            {/* Discussions Tab */}
            <button
              onClick={() => handleTabChange('discussions')}
              className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'discussions'
                  ? 'bg-white/20'
                  : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-center space-x-1.5">
                <History className="w-4 h-4" />
                <span className="whitespace-nowrap">Discussions</span>
              </div>
              {activeTab === 'discussions' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' ? (
            <div className="h-full">
              <IncidentChatPanel
                incidentId={incidentId}
                incidentTitle={incidentTitle}
                currentUserId={currentUserId}
                isParticipant={isParticipant}
                participants={participants.filter(p => p.user).map(p => ({
                  id: p.user.id,
                  firstName: p.user.firstName || 'Unknown',
                  lastName: p.user.lastName || '',
                  email: p.user.email || '',
                  role: p.user.role,
                  isOnline: p.user.isOnline,
                }))}
                isSidebarMode={true}
              />
            </div>
          ) : activeTab === 'archived' ? (
            <div className="h-full">
              <ArchivedChatPanel incidentId={incidentId} />
            </div>
          ) : activeTab === 'activity' ? (
            <div className="h-full">
              <ActivityLogPanel incidentId={incidentId} versionHistory={versionHistory} />
            </div>
          ) : activeTab === 'recordings' ? (
            <div className="h-full">
              <RecordingHistoryPanel incidentId={incidentId} />
            </div>
          ) : activeTab === 'discussions' ? (
            <div className="h-full">
              <DiscussionHistoryPanel incidentId={incidentId} />
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-slate-800">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Team Management
                  </h3>
                  {/* Video Call Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Join Active Call Button - Shows when there's an active call and user is not in it */}
                    {activeCallInfo && !isCallActive && (
                      <button
                        onClick={() => joinCall(
                          activeCallInfo.roomUrl,
                          activeCallInfo.roomName,
                          incidentId
                        )}
                        className="flex items-center space-x-2 px-3 py-2 text-white text-sm font-medium rounded-lg transition-all bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg animate-pulse hover:animate-none"
                        title="Join the active team call"
                      >
                        <PhoneCall className="w-4 h-4" />
                        <span>Join Call</span>
                      </button>
                    )}
                    {/* End Call Button - Shows when there's an active call and user is not in it */}
                    {activeCallInfo && !isCallActive && (
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to end this call for everyone?')) {
                            setIsEndingCall(true);
                            const success = await terminateCall(incidentId, activeCallInfo.roomName);
                            if (success) {
                              setActiveCallInfo(null);
                            }
                            setIsEndingCall(false);
                          }
                        }}
                        disabled={isEndingCall}
                        className="flex items-center space-x-2 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        title="End call for everyone"
                      >
                        <Phone className="w-4 h-4" />
                        <span>{isEndingCall ? 'Ending...' : 'End Call'}</span>
                      </button>
                    )}
                    {/* Start Call Button */}
                    <button
                      onClick={() => startCall(incidentId)}
                      disabled={isCallActive || !!activeCallInfo}
                      className={`flex items-center space-x-2 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                        isCallActive 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : activeCallInfo 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-green-600 hover:bg-green-700'
                      }`}
                      title={isCallActive ? 'Call in progress' : activeCallInfo ? 'A call is already active - join or end it first' : 'Start video call with team'}
                    >
                      <Video className="w-4 h-4" />
                      <span>{isCallActive ? 'In Call' : 'Start Call'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Add or remove team members and manage their roles for this incident and RCA.
                </p>
                {/* Active Call Banner */}
                {activeCallInfo && !isCallActive && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-sm font-medium">Team call in progress</span>
                      </div>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Click &quot;Join Call&quot; to connect, or &quot;End Call&quot; to terminate the call for everyone.
                    </p>
                  </div>
                )}
              </div>

              <TeamParticipantSelector
                incidentId={incidentId}
                organizationId={organizationId}
                currentUserId={currentUserId}
                selectedParticipants={participants.filter(p => p.user).map(p => ({
                  ...p,
                  user: {
                    ...p.user,
                    role: p.user?.role || 'USER'
                  }
                }))}
                onParticipantsChange={onParticipantsChange}
                isTeamIncident={isTeamIncident}
                onVisibilityChange={onVisibilityChange}
                visibility={visibility}
              />
            </div>
          )}
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[59] lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Detached Tab Modal */}
      {detachedTab && (
        <div className="pointer-events-none fixed inset-0 z-[100] bg-transparent">
          <div
            ref={detachedModalRef}
            className={`pointer-events-auto fixed bg-white dark:bg-slate-900 rounded-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-black/10 ${
              isDetachedModalDragging ? 'select-none shadow-[0_24px_80px_rgba(15,23,42,0.28)]' : ''
            }`}
            style={detachedModalStyle}
          >
            {/* Header */}
            <div
              className={`flex-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md ${
                isDetachedModalDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              onPointerDown={handleDetachedModalPointerDown}
              onPointerMove={handleDetachedModalPointerMove}
              onPointerUp={handleDetachedModalPointerEnd}
              onPointerCancel={handleDetachedModalPointerEnd}
              style={{ touchAction: 'none' }}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center space-x-2 min-w-0">
                  <MessageCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold text-sm truncate max-w-[320px]">
                    {incidentTitle || 'Incident Chat'}
                  </span>
                  {!isConnected && detachedPanelTab === 'chat' && (
                    <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" title="Reconnecting..." />
                  )}
                </div>

                <div className="flex items-center space-x-1 flex-shrink-0 ml-2" data-no-drag="true">
                  <button
                    onClick={handleMinimizeDetachedTab}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
                    title="Return to sidebar"
                  >
                    <Minimize2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Minimize</span>
                  </button>
                  <button
                    onClick={handleCloseDetachedTab}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Tabs - Same side panel tabs, just wider */}
              <div className="flex border-t border-white/20 overflow-x-auto scrollbar-hide" data-no-drag="true">
                {visibility === 'TEAM' && (
                  <button
                    onClick={() => handleDetachedTabChange('chat')}
                    className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                      detachedPanelTab === 'chat'
                        ? 'bg-white/20'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-1.5">
                      <MessageSquare className="w-4 h-4" />
                      <span className="whitespace-nowrap">Chat</span>
                      {unreadCount > 0 && detachedPanelTab !== 'chat' && (
                        <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    {detachedPanelTab === 'chat' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                    )}
                  </button>
                )}

                {hasArchivedMessages && (
                  <button
                    onClick={() => handleDetachedTabChange('archived')}
                    className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                      detachedPanelTab === 'archived'
                        ? 'bg-white/20'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-1.5">
                      <Archive className="w-4 h-4" />
                      <span className="whitespace-nowrap">Archive</span>
                    </div>
                    {detachedPanelTab === 'archived' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                    )}
                  </button>
                )}

                <button
                  onClick={() => handleDetachedTabChange('team')}
                  className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                    detachedPanelTab === 'team'
                      ? 'bg-white/20'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1.5">
                    <Users className="w-4 h-4" />
                    <span className="whitespace-nowrap">Team</span>
                    <span className="text-xs opacity-75">
                      ({participants.length})
                    </span>
                  </div>
                  {detachedPanelTab === 'team' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                  )}
                </button>

                <button
                  onClick={() => handleDetachedTabChange('activity')}
                  className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                    detachedPanelTab === 'activity'
                      ? 'bg-white/20'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1.5">
                    <Clock className="w-4 h-4" />
                    <span className="whitespace-nowrap">Activity</span>
                  </div>
                  {detachedPanelTab === 'activity' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                  )}
                </button>

                <button
                  onClick={() => handleDetachedTabChange('recordings')}
                  className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                    detachedPanelTab === 'recordings'
                      ? 'bg-white/20'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1.5">
                    <Film className="w-4 h-4" />
                    <span className="whitespace-nowrap">Recordings</span>
                  </div>
                  {detachedPanelTab === 'recordings' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                  )}
                </button>

                <button
                  onClick={() => handleDetachedTabChange('discussions')}
                  className={`flex-shrink-0 px-3 py-3 text-sm font-medium transition-colors relative ${
                    detachedPanelTab === 'discussions'
                      ? 'bg-white/20'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1.5">
                    <History className="w-4 h-4" />
                    <span className="whitespace-nowrap">Discussions</span>
                  </div>
                  {detachedPanelTab === 'discussions' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                  )}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {detachedPanelTab === 'chat' ? (
                <div className="h-full">
                  <IncidentChatPanel
                    incidentId={incidentId}
                    incidentTitle={incidentTitle}
                    currentUserId={currentUserId}
                    isParticipant={isParticipant}
                    participants={participants.filter(p => p.user).map(p => ({
                      id: p.user.id,
                      firstName: p.user.firstName || 'Unknown',
                      lastName: p.user.lastName || '',
                      email: p.user.email || '',
                      role: p.user.role,
                      isOnline: p.user.isOnline,
                    }))}
                    isSidebarMode={true}
                  />
                </div>
              ) : detachedPanelTab === 'archived' ? (
                <div className="h-full">
                  <ArchivedChatPanel incidentId={incidentId} />
                </div>
              ) : detachedPanelTab === 'activity' ? (
                <div className="h-full">
                  <ActivityLogPanel incidentId={incidentId} versionHistory={versionHistory} />
                </div>
              ) : detachedPanelTab === 'recordings' ? (
                <div className="h-full">
                  <RecordingHistoryPanel incidentId={incidentId} />
                </div>
              ) : detachedPanelTab === 'discussions' ? (
                <div className="h-full">
                  <DiscussionHistoryPanel incidentId={incidentId} />
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-slate-800">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Team Management
                      </h3>
                      <div className="flex items-center gap-2">
                        {activeCallInfo && !isCallActive && (
                          <button
                            onClick={() => joinCall(
                              activeCallInfo.roomUrl,
                              activeCallInfo.roomName,
                              incidentId
                            )}
                            className="flex items-center space-x-2 px-3 py-2 text-white text-sm font-medium rounded-lg transition-all bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg animate-pulse hover:animate-none"
                            title="Join the active team call"
                          >
                            <PhoneCall className="w-4 h-4" />
                            <span>Join Call</span>
                          </button>
                        )}
                        {activeCallInfo && !isCallActive && (
                          <button
                            onClick={async () => {
                              if (confirm('Are you sure you want to end this call for everyone?')) {
                                setIsEndingCall(true);
                                const success = await terminateCall(incidentId, activeCallInfo.roomName);
                                if (success) {
                                  setActiveCallInfo(null);
                                }
                                setIsEndingCall(false);
                              }
                            }}
                            disabled={isEndingCall}
                            className="flex items-center space-x-2 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors bg-red-600 hover:bg-red-700 disabled:opacity-50"
                            title="End call for everyone"
                          >
                            <Phone className="w-4 h-4" />
                            <span>{isEndingCall ? 'Ending...' : 'End Call'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => startCall(incidentId)}
                          disabled={isCallActive || !!activeCallInfo}
                          className={`flex items-center space-x-2 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                            isCallActive
                              ? 'bg-gray-400 cursor-not-allowed'
                              : activeCallInfo
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700'
                          }`}
                          title={isCallActive ? 'Call in progress' : activeCallInfo ? 'A call is already active - join or end it first' : 'Start video call with team'}
                        >
                          <Video className="w-4 h-4" />
                          <span>{isCallActive ? 'In Call' : 'Start Call'}</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Add or remove team members and manage their roles for this incident and RCA.
                    </p>
                    {activeCallInfo && !isCallActive && (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-sm font-medium">Team call in progress</span>
                          </div>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Click &quot;Join Call&quot; to connect, or &quot;End Call&quot; to terminate the call for everyone.
                        </p>
                      </div>
                    )}
                  </div>

                  <TeamParticipantSelector
                    incidentId={incidentId}
                    organizationId={organizationId}
                    currentUserId={currentUserId}
                    selectedParticipants={participants.filter(p => p.user).map(p => ({
                      ...p,
                      user: {
                        ...p.user,
                        role: p.user?.role || 'USER'
                      }
                    }))}
                    onParticipantsChange={onParticipantsChange}
                    isTeamIncident={isTeamIncident}
                    onVisibilityChange={onVisibilityChange}
                    visibility={visibility}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
