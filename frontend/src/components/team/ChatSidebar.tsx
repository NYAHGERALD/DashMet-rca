'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '@/lib/websocket';
import { chatUnreadStore } from '@/lib/chatUnreadStore';
import { useBrowserNotifications } from '@/components/providers/BrowserNotificationProvider';
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
} from 'lucide-react';
import IncidentChatPanel from './IncidentChatPanel';
import TeamParticipantSelector from './TeamParticipantSelector';
import ArchivedChatPanel from './ArchivedChatPanel';
import ActivityLogPanel from './ActivityLogPanel';

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
}

type TabType = 'chat' | 'archived' | 'team' | 'activity';

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
}: ChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [unreadCount, setUnreadCount] = useState(() => chatUnreadStore.getCount(incidentId));
  const [hasArchivedMessages, setHasArchivedMessages] = useState(false);
  const [detachedTab, setDetachedTab] = useState<TabType | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const previousTabRef = useRef<TabType>(defaultTab);
  const originalTitleRef = useRef<string>('');

  const { isConnected, socket } = useWebSocket();
  const { setChatOpen } = useBrowserNotifications();

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

  // Mark messages as read on the backend
  const markMessagesAsRead = useCallback(async () => {
    if (!incidentId) return;
    try {
      await api.post(`/chat/${incidentId}/mark-read`);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [incidentId]);

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
    // Mark chat as closed when sidebar is closed OR on initial mount if sidebar starts closed
    if (!isOpen && incidentId) {
      setChatOpen(incidentId, false);
    }
    // Also mark as open if sidebar starts open
    if (isOpen && incidentId) {
      setChatOpen(incidentId, true);
    }
  }, [isOpen, incidentId, setChatOpen]);

  // Detach a tab into modal view
  const handleDetachTab = useCallback((tab: TabType) => {
    setDetachedTab(tab);
  }, []);

  // Attach the detached tab back to sidebar
  const handleAttachTab = useCallback(() => {
    setDetachedTab(null);
  }, []);

  // Get tab display name
  const getTabDisplayName = (tab: TabType): string => {
    switch (tab) {
      case 'chat': return 'Chat';
      case 'archived': return 'Archived';
      case 'team': return 'Team';
      case 'activity': return 'Activity';
      default: return '';
    }
  };

  // Show sidebar when user is a participant (either through team mode or has participants)
  if (!isParticipant) {
    return null;
  }

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

          {/* Tabs */}
          <div className="flex border-t border-white/20">
            {/* Chat Tab - Only show when visibility is TEAM */}
            {visibility === 'TEAM' && (
              <button
                onClick={() => handleTabChange('chat')}
                className={`flex-1 px-3 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'chat'
                    ? 'bg-white/20'
                    : 'hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-center space-x-1.5">
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat</span>
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
                className={`flex-1 px-3 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'archived'
                    ? 'bg-white/20'
                    : 'hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-center space-x-1.5">
                  <Archive className="w-4 h-4" />
                  <span>Archive</span>
                </div>
                {activeTab === 'archived' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                )}
              </button>
            )}
            
            <button
              onClick={() => handleTabChange('team')}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'team'
                  ? 'bg-white/20'
                  : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-center space-x-1.5">
                <Users className="w-4 h-4" />
                <span>Team</span>
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
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'activity'
                  ? 'bg-white/20'
                  : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-center space-x-1.5">
                <Clock className="w-4 h-4" />
                <span>Activity</span>
              </div>
              {activeTab === 'activity' && (
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
                participants={participants.map(p => ({
                  id: p.user.id,
                  firstName: p.user.firstName,
                  lastName: p.user.lastName,
                  email: p.user.email,
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
              <ActivityLogPanel incidentId={incidentId} />
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-slate-800">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Team Management
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Add or remove team members and manage their roles for this incident and RCA.
                </p>
              </div>

              <TeamParticipantSelector
                incidentId={incidentId}
                organizationId={organizationId}
                currentUserId={currentUserId}
                selectedParticipants={participants.map(p => ({
                  ...p,
                  user: {
                    ...p.user,
                    role: p.user.role || 'USER'
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6 lg:p-8">
          {/* Modal Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleAttachTab}
          />
          
          {/* Modal Content - Full screen on mobile, contained on larger screens */}
          <div className="relative w-full h-full sm:h-[95vh] md:h-[90vh] sm:max-w-4xl md:max-w-5xl lg:max-w-7xl bg-white dark:bg-slate-900 sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {detachedTab === 'chat' && <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />}
                    {detachedTab === 'archived' && <Archive className="w-4 h-4 sm:w-5 sm:h-5" />}
                    {detachedTab === 'team' && <Users className="w-4 h-4 sm:w-5 sm:h-5" />}
                    {detachedTab === 'activity' && <Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-base sm:text-lg truncate">
                      {getTabDisplayName(detachedTab)}
                    </h2>
                    <p className="text-xs text-white/70 truncate">
                      {incidentTitle || 'Incident'}
                    </p>
                  </div>
                  {!isConnected && detachedTab === 'chat' && (
                    <span className="flex-shrink-0 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" title="Reconnecting..." />
                  )}
                </div>
                
                <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 ml-2">
                  <button
                    onClick={handleAttachTab}
                    className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-xs sm:text-sm"
                    title="Return to sidebar"
                  >
                    <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Minimize</span>
                  </button>
                  <button
                    onClick={handleAttachTab}
                    className="p-1 sm:p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {detachedTab === 'chat' ? (
                <div className="h-full">
                  <IncidentChatPanel
                    incidentId={incidentId}
                    incidentTitle={incidentTitle}
                    currentUserId={currentUserId}
                    isParticipant={isParticipant}
                    participants={participants.map(p => ({
                      id: p.user.id,
                      firstName: p.user.firstName,
                      lastName: p.user.lastName,
                      email: p.user.email,
                      role: p.user.role,
                      isOnline: p.user.isOnline,
                    }))}
                    isSidebarMode={true}
                  />
                </div>
              ) : detachedTab === 'archived' ? (
                <div className="h-full">
                  <ArchivedChatPanel incidentId={incidentId} />
                </div>
              ) : detachedTab === 'activity' ? (
                <div className="h-full">
                  <ActivityLogPanel incidentId={incidentId} />
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-gray-50 dark:bg-slate-800">
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-4 sm:mb-6">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                        Team Management
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Add or remove team members and manage their roles for this incident and RCA.
                      </p>
                    </div>

                    <TeamParticipantSelector
                      incidentId={incidentId}
                      organizationId={organizationId}
                      currentUserId={currentUserId}
                      selectedParticipants={participants.map(p => ({
                        ...p,
                        user: {
                          ...p.user,
                          role: p.user.role || 'USER'
                        }
                      }))}
                      onParticipantsChange={onParticipantsChange}
                      isTeamIncident={isTeamIncident}
                      onVisibilityChange={onVisibilityChange}
                      visibility={visibility}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
