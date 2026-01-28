'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '@/lib/websocket';
import { browserNotificationService } from '@/lib/browserNotifications';
import api from '@/lib/api';
import {
  MessageCircle,
  X,
  Minimize2,
  Maximize2,
  Send,
  Reply,
  MoreVertical,
  Check,
  CheckCheck,
  Paperclip,
  Smile,
  Users,
  Pin,
  Edit2,
  FileText,
  GitBranch,
  CheckCircle,
  ArrowRightLeft,
  Image,
  FileVideo,
  Target,
  ListTree,
  RefreshCw,
  HelpCircle,
  TrendingUp,
  Megaphone,
  Gavel,
  Mic,
  File,
  Play,
  Pause,
  Download,
  Filter,
  Calendar,
  User,
  ChevronDown,
  ExternalLink,
  Fish,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears, startOfDay } from 'date-fns';
import { ReactionsDisplay } from './EmojiPicker';
import MentionInput, { renderMessageWithMentions } from './MentionInput';
import MessageActionsMenu, { PinnedMessagesSection } from './MessageActionsMenu';
import EvidencePicker from './EvidencePicker';
import RCALinkPicker from './RCALinkPicker';
import CreateActionFromChat from './CreateActionFromChat';
import HandoffMessage from './HandoffMessage';
import SmartMessageRenderer from './SmartMessageRenderer';
import SmartMessageComposer from './SmartMessageComposer';
import ChatFileUpload from './ChatFileUpload';
import VoiceRecorder from './VoiceRecorder';
import MessageTemplates from './MessageTemplates';

interface MessageReaction {
  emoji: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface ChatMessage {
  id: string;
  incidentId: string;
  userId: string;
  content: string;
  messageType: 'TEXT' | 'SYSTEM' | 'FILE' | 'IMAGE' | 'EVIDENCE_LINK' | 'RCA_LINK' | 'ACTION_ITEM' | 'STATUS_UPDATE' | 'HANDOFF' | 'DECISION' | 'QUESTION' | 'UPDATE' | 'ANNOUNCEMENT';
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned?: boolean;
  pinnedAt?: string | null;
  mentions?: string[];
  readBy: string[];
  // Phase 2 fields
  evidenceId?: string;
  rcaAnalysisId?: string;
  rcaItemType?: string;
  rcaItemId?: string;
  actionItemId?: string;
  statusChange?: { from: string; to: string; changedBy: string };
  handoffData?: { shiftFrom: string; shiftTo: string; checklist: { text: string; completed: boolean }[]; notes?: string };
  evidence?: { id: string; type: string; fileName: string; filePath: string; mimeType?: string; fileSize?: number; transcription?: string };
  rcaAnalysis?: { id: string; method: string; rootCauseStatement?: string };
  // Phase 3 fields
  decisionData?: { decidedBy: string; decidedAt: string; rationale?: string };
  questionData?: { 
    isResolved: boolean; 
    askedBy: string; 
    askedAt: string; 
    resolvedBy?: string; 
    resolvedAt?: string; 
    resolvedByUser?: { id: string; firstName: string; lastName: string };
    reopenedBy?: string;
    reopenedAt?: string;
    reopenedByUser?: { id: string; firstName: string; lastName: string };
    answer?: string;
  };
  updateData?: { category: 'progress' | 'blocker' | 'milestone' | 'general'; priority: 'low' | 'normal' | 'high'; postedBy: string; postedAt: string };
  announcementData?: { priority: 'normal' | 'important' | 'urgent'; postedBy: string; postedAt: string; expiresAt?: string };
  // Phase 4: Rich Content
  attachments?: {
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    isVoiceMessage?: boolean;
  };
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isOnline: boolean;
    profilePicture?: string | null;
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
  reactions?: MessageReaction[];
}

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role?: string;
  isOnline?: boolean;
}

interface IncidentChatPanelProps {
  incidentId: string;
  incidentTitle?: string;
  currentUserId: string;
  isParticipant: boolean;
  participants?: Participant[];
  isSidebarMode?: boolean;
}

export default function IncidentChatPanel({
  incidentId,
  incidentTitle,
  currentUserId,
  isParticipant,
  participants = [],
  isSidebarMode = false,
}: IncidentChatPanelProps) {
  const [isOpen, setIsOpen] = useState(true); // Always open in sidebar mode
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Map<string, { firstName: string; lastName: string }>>(new Map());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMobileMenu, setIsMobileMenu] = useState(false);
  
  // Phase 2: Incident-Specific Actions
  const [showEvidencePicker, setShowEvidencePicker] = useState(false);
  const [showRCALinkPicker, setShowRCALinkPicker] = useState(false);
  const [showCreateAction, setShowCreateAction] = useState(false);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [actionMessageContent, setActionMessageContent] = useState('');
  
  // Phase 3: Smart Message Types
  const [showSmartComposer, setShowSmartComposer] = useState(false);
  const [smartComposerType, setSmartComposerType] = useState<'question' | 'update' | 'announcement'>('question');
  
  // Phase 4: Rich Content
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ [key: string]: { currentTime: number; duration: number } }>({});
  
  // Image preview modal state
  const [previewImage, setPreviewImage] = useState<{ url: string; fileName: string } | null>(null);
  
  // Evidence image URLs loaded from API
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});
  const [loadingEvidenceUrls, setLoadingEvidenceUrls] = useState<Record<string, boolean>>({});
  const evidenceBlobUrlsRef = useRef<string[]>([]);
  
  // Message filtering state
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterByUser, setFilterByUser] = useState<string | null>(null);
  const [filterByType, setFilterByType] = useState<'all' | 'attachments' | 'voice' | 'images' | 'text'>('all');
  const [filterByDateFrom, setFilterByDateFrom] = useState<string>('');
  const [filterByDateTo, setFilterByDateTo] = useState<string>('');
  const filterMenuRef = useRef<HTMLDivElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  
  const {
    isConnected,
    onlineUsers,
    joinIncident,
    leaveIncident,
    sendMessage: wsSendMessage,
    setTyping,
    markMessagesRead,
    onMessage,
    onMessageUpdated,
    onMessageDeleted,
    onTyping,
    onReaction,
    onMessagePinned,
    onMessageUnpinned,
    onMessagesRead,
  } = useWebSocket();

  // Fetch messages
  const fetchMessages = useCallback(async (cursor?: string) => {
    if (!incidentId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '50',
        ...(cursor && { cursor }),
      });
      
      const response = await api.get(`/chat/${incidentId}/messages?${params}`);
      const rawMessages = response.data?.data || response.data?.messages || [];
      
      // Normalize backend response: Prisma returns 'User' but frontend expects 'user'
      // Also normalize 'Evidence' to 'evidence' for evidence link messages
      const fetchedMessages = rawMessages.map((msg: any) => ({
        ...msg,
        user: msg.User || msg.user,
        evidence: msg.Evidence || msg.evidence,
        replyTo: msg.replyTo ? {
          ...msg.replyTo,
          user: msg.replyTo.User || msg.replyTo.user
        } : msg.replyTo
      }));
      
      if (cursor) {
        setMessages(prev => [...fetchedMessages, ...prev]);
      } else {
        setMessages(fetchedMessages);
      }
      setHasMore(response.data?.pagination?.hasMore || false);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      // Don't reset messages on error, keep existing ones
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  // Fetch pinned messages
  const fetchPinnedMessages = useCallback(async () => {
    if (!incidentId) return;
    
    try {
      const response = await api.get(`/chat/${incidentId}/pinned`);
      const rawPinned = response.data?.data || [];
      // Normalize backend response: Prisma returns 'User' but frontend expects 'user'
      // Also normalize 'Evidence' to 'evidence' for evidence link messages
      const normalizedPinned = rawPinned.map((msg: any) => ({
        ...msg,
        user: msg.User || msg.user,
        evidence: msg.Evidence || msg.evidence,
        replyTo: msg.replyTo ? {
          ...msg.replyTo,
          user: msg.replyTo.User || msg.replyTo.user
        } : msg.replyTo
      }));
      setPinnedMessages(normalizedPinned);
    } catch (error) {
      console.error('Failed to fetch pinned messages:', error);
    }
  }, [incidentId]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!incidentId) return;
    
    try {
      const response = await api.get(`/chat/${incidentId}/unread-count`);
      setUnreadCount(response.data?.data?.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [incidentId]);

  // Toggle reaction on a message
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const response = await api.post(`/chat/${incidentId}/messages/${messageId}/reactions`, { emoji });
      const action = response.data?.action;
      
      // Update messages with new reaction
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg;
        
        const reactions = msg.reactions || [];
        if (action === 'removed') {
          // Remove user's reaction
          return {
            ...msg,
            reactions: reactions.filter(r => !(r.emoji === emoji && r.userId === currentUserId))
          };
        } else {
          // Add user's reaction
          const newReaction: MessageReaction = {
            emoji,
            userId: currentUserId,
            user: { id: currentUserId, firstName: 'You', lastName: '' }
          };
          return {
            ...msg,
            reactions: [...reactions, newReaction]
          };
        }
      }));
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  }, [incidentId, currentUserId]);

  // Pin/unpin message
  const pinMessage = useCallback(async (messageId: string) => {
    try {
      const response = await api.post(`/chat/${incidentId}/messages/${messageId}/pin`);
      if (response.data?.success) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, isPinned: true, pinnedAt: new Date().toISOString() } : msg
        ));
        fetchPinnedMessages();
      }
    } catch (error: any) {
      console.error('Failed to pin message:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to pin message';
      alert(errorMessage);
    }
  }, [incidentId, fetchPinnedMessages]);

  const unpinMessage = useCallback(async (messageId: string) => {
    try {
      const response = await api.delete(`/chat/${incidentId}/messages/${messageId}/pin`);
      if (response.data?.success) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, isPinned: false, pinnedAt: undefined } : msg
        ));
        setPinnedMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    } catch (error: any) {
      console.error('Failed to unpin message:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to unpin message';
      alert(errorMessage);
    }
  }, [incidentId]);

  // Edit message
  const startEditing = useCallback((message: ChatMessage) => {
    setEditingMessage(message);
    setNewMessage(message.content);
    setReplyTo(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingMessage(null);
    setNewMessage('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingMessage || !newMessage.trim()) return;
    
    try {
      await api.patch(`/chat/${incidentId}/messages/${editingMessage.id}`, {
        content: newMessage.trim()
      });
      
      setMessages(prev => prev.map(msg => 
        msg.id === editingMessage.id 
          ? { ...msg, content: newMessage.trim(), isEdited: true }
          : msg
      ));
      
      setEditingMessage(null);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  }, [incidentId, editingMessage, newMessage]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
      await api.delete(`/chat/${incidentId}/messages/${messageId}`);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, isDeleted: true } : msg
      ));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }, [incidentId]);

  // Copy message content
  const copyMessage = useCallback(async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  // Jump to pinned message
  const jumpToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-yellow-100', 'dark:bg-yellow-900/30');
      setTimeout(() => {
        element.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/30');
      }, 2000);
    }
  }, []);

  // Long press handlers for message actions (mobile)
  const handleMessageLongPressStart = useCallback((messageId: string, e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      setActiveMenuMessageId(messageId);
      setIsMobileMenu(true);
      setMenuPosition(null);
      // Vibrate on mobile if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms for long press
  }, []);

  const handleMessageLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Right-click context menu handler (desktop) - only for messages
  const handleContextMenu = useCallback((messageId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const messageContainer = target.closest('[data-message-id]');
    
    // If we clicked directly on the container itself (empty flex space), don't show menu
    // Only show menu when clicking on actual content within the message
    if (target === messageContainer) {
      // This is empty space within the message row - don't show custom menu
      return;
    }
    
    // Check if we clicked on actual message content (bubble, avatar, reactions, etc.)
    const isOnContent = target.closest('.message-bubble, .message-avatar, .message-content, [class*="rounded"], [class*="bg-"], img, video, audio, button, span, p');
    if (!isOnContent) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    console.log('[Chat] Context menu triggered for message:', messageId, 'at position:', e.clientX, e.clientY);
    setActiveMenuMessageId(messageId);
    setIsMobileMenu(false);
    setMenuPosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Handler to close menu when right-clicking on empty area
  const handleContainerContextMenu = useCallback((e: React.MouseEvent) => {
    // Check if the click target is the container itself (empty space) or an element without a message context menu
    const target = e.target as HTMLElement;
    const isMessageElement = target.closest('[data-message-id]');
    
    if (!isMessageElement) {
      // Clicked on empty area - close any open menu and allow default browser behavior
      setActiveMenuMessageId(null);
      setMenuPosition(null);
      // Don't prevent default - allow normal right-click on empty areas
    }
  }, []);

  // Handler to close menu when clicking on empty area
  const handleContainerClick = useCallback(() => {
    if (activeMenuMessageId) {
      setActiveMenuMessageId(null);
      setMenuPosition(null);
    }
  }, [activeMenuMessageId]);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load evidence image URL from API
  const loadEvidenceUrl = useCallback(async (evidenceId: string, filePath: string, source?: string) => {
    // Skip if already loaded or loading
    if (evidenceUrls[evidenceId] || loadingEvidenceUrls[evidenceId]) return;
    
    // If it's already a full URL, use it directly
    if (filePath.startsWith('http')) {
      setEvidenceUrls(prev => ({ ...prev, [evidenceId]: filePath }));
      return;
    }
    
    setLoadingEvidenceUrls(prev => ({ ...prev, [evidenceId]: true }));
    
    try {
      let url: string;
      // Check if this is FMIR evidence (ID starts with 'fmir_' or source is 'FMIR')
      if (evidenceId.startsWith('fmir_') || source === 'FMIR') {
        // Get the fmirId from the incident
        const incidentResponse = await api.get(`/incidents/${incidentId}`);
        const fmirId = incidentResponse.data?.data?.fmirReportId || incidentResponse.data?.fmirReportId;
        if (fmirId) {
          const actualId = evidenceId.startsWith('fmir_') ? evidenceId.replace('fmir_', '') : evidenceId;
          url = `/fmir/${fmirId}/evidence/${actualId}/download`;
        } else {
          throw new Error('FMIR ID not found');
        }
      } else {
        url = `/incidents/${incidentId}/evidence/${evidenceId}/download`;
      }
      
      const response = await api.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      evidenceBlobUrlsRef.current.push(blobUrl);
      setEvidenceUrls(prev => ({ ...prev, [evidenceId]: blobUrl }));
    } catch (err) {
      console.error('Failed to load evidence URL:', evidenceId, err);
    } finally {
      setLoadingEvidenceUrls(prev => ({ ...prev, [evidenceId]: false }));
    }
  }, [incidentId, evidenceUrls, loadingEvidenceUrls]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      evidenceBlobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Phase 2: Share evidence in chat
  const handleShareEvidence = useCallback(async (evidence: any, comment: string) => {
    try {
      console.log('[Chat] Sharing evidence:', evidence.id, comment);
      const response = await api.post(`/chat/${incidentId}/messages/evidence`, {
        evidenceId: evidence.id,
        comment,
      });
      console.log('[Chat] Evidence share response:', response.data);
      const newMsg = response.data?.data;
      if (newMsg) {
        // Use duplicate check to avoid double-adding when WebSocket broadcast arrives
        setMessages(prev => {
          const exists = prev.some(m => m.id === newMsg.id);
          if (exists) return prev;
          return [...prev, newMsg];
        });
        scrollToBottom();
      }
    } catch (error: any) {
      console.error('Failed to share evidence:', error.response?.data || error.message);
      throw error; // Re-throw so EvidencePicker can catch it
    }
  }, [incidentId, scrollToBottom]);

  // Phase 2: Share RCA finding in chat
  const handleShareRCA = useCallback(async (rcaAnalysisId: string, rcaItemType: string, rcaItemId: string | null, comment: string) => {
    try {
      const response = await api.post(`/chat/${incidentId}/messages/rca`, {
        rcaAnalysisId,
        rcaItemType,
        rcaItemId,
        comment,
      });
      const newMsg = response.data?.data;
      if (newMsg) {
        // Use duplicate check to avoid double-adding when WebSocket broadcast arrives
        setMessages(prev => {
          const exists = prev.some(m => m.id === newMsg.id);
          if (exists) return prev;
          return [...prev, newMsg];
        });
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to share RCA:', error);
    }
  }, [incidentId, scrollToBottom]);

  // Phase 2: Open create action modal
  const handleOpenCreateAction = useCallback((messageId: string, content: string) => {
    setActionMessageId(messageId);
    setActionMessageContent(content);
    setShowCreateAction(true);
    setActiveMenuMessageId(null);
  }, []);

  // Phase 2: Action created callback
  const handleActionCreated = useCallback(() => {
    // Refresh messages to show the new action item message
    fetchMessages();
  }, []);

  // Phase 2: Handoff created callback
  const handleHandoffCreated = useCallback(() => {
    fetchMessages();
  }, []);

  // Phase 3: Open smart message composer
  const openSmartComposer = useCallback((type: 'question' | 'update' | 'announcement') => {
    setSmartComposerType(type);
    setShowSmartComposer(true);
  }, []);

  // Phase 3: Mark message as decision
  const markAsDecision = useCallback(async (messageId: string) => {
    try {
      await api.post(`/chat/${incidentId}/messages/${messageId}/decision`);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, messageType: 'DECISION' as const } : msg
      ));
      setActiveMenuMessageId(null);
    } catch (error) {
      console.error('Failed to mark as decision:', error);
    }
  }, [incidentId]);

  // Phase 4: Handle file upload complete
  const handleFileUploadComplete = useCallback((message: ChatMessage) => {
    // Use duplicate check to avoid double-adding when WebSocket broadcast arrives
    setMessages(prev => {
      const exists = prev.some(m => m.id === message.id);
      if (exists) return prev;
      return [...prev, message as unknown as ChatMessage];
    });
    scrollToBottom();
  }, [scrollToBottom]);

  // Phase 4: Handle template selection
  const handleTemplateSelect = useCallback((content: string) => {
    setNewMessage(content);
  }, []);

  // Phase 4: Toggle audio playback with progress tracking
  const toggleAudioPlayback = useCallback((messageId: string, audioElement: HTMLAudioElement) => {
    if (playingAudioId === messageId) {
      // Pause current audio
      audioElement.pause();
      setPlayingAudioId(null);
      if (audioAnimationRef.current) {
        cancelAnimationFrame(audioAnimationRef.current);
        audioAnimationRef.current = null;
      }
    } else {
      // Stop any currently playing audio
      const allAudio = document.querySelectorAll('audio');
      allAudio.forEach(a => (a as HTMLAudioElement).pause());
      if (audioAnimationRef.current) {
        cancelAnimationFrame(audioAnimationRef.current);
      }
      
      // Start playing new audio
      audioElement.play();
      setPlayingAudioId(messageId);
      
      // Update progress using requestAnimationFrame for smooth animation
      const updateProgress = () => {
        if (audioElement && !audioElement.paused) {
          setAudioProgress(prev => ({
            ...prev,
            [messageId]: {
              currentTime: audioElement.currentTime,
              duration: audioElement.duration || 0,
            },
          }));
          audioAnimationRef.current = requestAnimationFrame(updateProgress);
        }
      };
      
      // Initialize duration when metadata is loaded
      audioElement.onloadedmetadata = () => {
        setAudioProgress(prev => ({
          ...prev,
          [messageId]: {
            currentTime: 0,
            duration: audioElement.duration || 0,
          },
        }));
      };
      
      audioAnimationRef.current = requestAnimationFrame(updateProgress);
      
      audioElement.onended = () => {
        setPlayingAudioId(null);
        setAudioProgress(prev => ({
          ...prev,
          [messageId]: {
            currentTime: 0,
            duration: prev[messageId]?.duration || 0,
          },
        }));
        if (audioAnimationRef.current) {
          cancelAnimationFrame(audioAnimationRef.current);
          audioAnimationRef.current = null;
        }
      };
    }
  }, [playingAudioId]);

  // Format time for audio display (mm:ss)
  const formatAudioTime = useCallback((seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Phase 4: Format file size
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Transform message reactions to ReactionsDisplay format
  const transformReactionsForDisplay = useCallback((reactions: MessageReaction[]) => {
    if (!reactions || reactions.length === 0) return [];
    
    // Group reactions by emoji
    const groupedMap = new Map<string, { emoji: string; count: number; users: { id: string; firstName: string; lastName: string }[] }>();
    
    for (const reaction of reactions) {
      const existing = groupedMap.get(reaction.emoji);
      if (existing) {
        existing.count++;
        if (reaction.user) {
          existing.users.push(reaction.user);
        }
      } else {
        groupedMap.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          users: reaction.user ? [reaction.user] : []
        });
      }
    }
    
    return Array.from(groupedMap.values());
  }, []);

  // Cleanup long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Fetch messages when component mounts or becomes visible (sidebar mode or isOpen)
  useEffect(() => {
    if (incidentId && (isSidebarMode || isOpen)) {
      fetchMessages();
    }
  }, [incidentId, isSidebarMode, isOpen, fetchMessages]);

  // Join/leave incident room for WebSocket events
  useEffect(() => {
    if (isConnected && incidentId && (isSidebarMode || isOpen)) {
      // Small delay to ensure socket is fully ready
      const timer = setTimeout(() => {
        joinIncident(incidentId);
      }, 100);
      return () => {
        clearTimeout(timer);
        if (incidentId) {
          leaveIncident(incidentId);
        }
      };
    }
    
    return () => {
      if (incidentId) {
        leaveIncident(incidentId);
      }
    };
  }, [isConnected, incidentId, isSidebarMode, isOpen, joinIncident, leaveIncident]);

  // Track chat open state for browser notifications
  useEffect(() => {
    if (incidentId && (isSidebarMode || isOpen)) {
      // Mark chat as open to prevent browser notifications
      browserNotificationService.setChatOpen(incidentId, true);
    }
    
    return () => {
      if (incidentId) {
        // Mark chat as closed when component unmounts or chat closes
        browserNotificationService.setChatOpen(incidentId, false);
      }
    };
  }, [incidentId, isSidebarMode, isOpen]);

  // Subscribe to new messages
  useEffect(() => {
    const unsubMessage = onMessage((message) => {
      if (message.incidentId === incidentId) {
        // Normalize backend response: Prisma returns 'User' but frontend expects 'user'
        // Also normalize 'Evidence' to 'evidence' for evidence link messages
        const normalizedMessage = {
          ...message,
          user: (message as any).User || message.user,
          evidence: (message as any).Evidence || (message as any).evidence,
          replyTo: message.replyTo ? {
            ...message.replyTo,
            user: (message.replyTo as any).User || message.replyTo.user
          } : message.replyTo
        };
        
        // Check if message already exists (avoid duplicates from REST response)
        setMessages(prev => {
          const exists = prev.some(m => m.id === normalizedMessage.id);
          if (exists) return prev;
          return [...prev, normalizedMessage as unknown as ChatMessage];
        });
        
        // Mark as read if panel is open
        if (isOpen && !isMinimized) {
          markMessagesRead(incidentId, [message.id]);
        } else {
          setUnreadCount(prev => prev + 1);
        }
      }
    });
    
    return unsubMessage;
  }, [incidentId, isOpen, isMinimized, onMessage, markMessagesRead]);

  // Subscribe to message updates (e.g., question resolved/reopened)
  useEffect(() => {
    const unsubMessageUpdated = onMessageUpdated((updatedMessage) => {
      if (updatedMessage.incidentId === incidentId) {
        // Normalize backend response: Prisma returns 'User' but frontend expects 'user'
        // Also normalize 'Evidence' to 'evidence' for evidence link messages
        const normalizedMessage = {
          ...updatedMessage,
          user: (updatedMessage as any).User || updatedMessage.user,
          evidence: (updatedMessage as any).Evidence || (updatedMessage as any).evidence,
          replyTo: updatedMessage.replyTo ? {
            ...updatedMessage.replyTo,
            user: (updatedMessage.replyTo as any).User || updatedMessage.replyTo.user
          } : updatedMessage.replyTo
        };
        setMessages(prev => prev.map(m => 
          m.id === normalizedMessage.id ? (normalizedMessage as unknown as ChatMessage) : m
        ));
      }
    });
    
    return unsubMessageUpdated;
  }, [incidentId, onMessageUpdated]);

  // Subscribe to message deletions (real-time)
  useEffect(() => {
    const unsubMessageDeleted = onMessageDeleted((data) => {
      if (data.incidentId === incidentId) {
        setMessages(prev => prev.map(m => 
          m.id === data.id ? { ...m, isDeleted: true } : m
        ));
      }
    });
    
    return unsubMessageDeleted;
  }, [incidentId, onMessageDeleted]);

  // Subscribe to typing events
  useEffect(() => {
    const unsubTyping = onTyping((data) => {
      if (data.userId !== currentUserId) {
        setTypingUsers(prev => {
          const next = new Map(prev);
          if (data.isTyping) {
            next.set(data.userId, { firstName: data.firstName, lastName: data.lastName });
          } else {
            next.delete(data.userId);
          }
          return next;
        });
      }
    });
    
    return unsubTyping;
  }, [currentUserId, onTyping]);

  // Subscribe to reaction events (real-time emoji reactions)
  useEffect(() => {
    const unsubReaction = onReaction((data) => {
      // Skip if this is our own reaction - it's already handled by the API response
      if (data.userId === currentUserId) return;
      
      if (data.incidentId === incidentId) {
        setMessages(prev => prev.map(msg => {
          if (msg.id !== data.messageId) return msg;
          
          const reactions = msg.reactions || [];
          if (data.action === 'removed') {
            // Remove the reaction
            return {
              ...msg,
              reactions: reactions.filter(r => !(r.emoji === data.emoji && r.userId === data.userId))
            };
          } else {
            // Add the reaction (check if already exists to avoid duplicates)
            const exists = reactions.some(r => r.emoji === data.emoji && r.userId === data.userId);
            if (exists) return msg;
            
            // Backend sends 'User' but we need 'user' - handle both
            const userData = data.user || (data as any).User;
            const newReaction = {
              emoji: data.emoji,
              userId: data.userId,
              user: userData
            };
            return {
              ...msg,
              reactions: [...reactions, newReaction]
            };
          }
        }));
      }
    });
    
    return unsubReaction;
  }, [incidentId, currentUserId, onReaction]);

  // Subscribe to message pinned events (real-time pin updates)
  useEffect(() => {
    const unsubPinned = onMessagePinned((data) => {
      if (data.message?.incidentId === incidentId) {
        // Normalize backend response: Prisma returns 'User' but frontend expects 'user'
        const normalizedMessage = {
          ...data.message,
          user: (data.message as any).User || data.message.user,
          replyTo: data.message.replyTo ? {
            ...data.message.replyTo,
            user: (data.message.replyTo as any).User || data.message.replyTo.user
          } : data.message.replyTo
        };
        // Update the message in the messages list
        setMessages(prev => prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, isPinned: true, pinnedAt: normalizedMessage.pinnedAt }
            : msg
        ));
        // Add to pinned messages list
        setPinnedMessages(prev => {
          const exists = prev.some(m => m.id === data.messageId);
          if (exists) return prev;
          return [normalizedMessage as unknown as ChatMessage, ...prev];
        });
      }
    });
    
    return unsubPinned;
  }, [incidentId, onMessagePinned]);

  // Subscribe to message unpinned events (real-time unpin updates)
  useEffect(() => {
    const unsubUnpinned = onMessageUnpinned((data) => {
      if (data.message?.incidentId === incidentId) {
        // Update the message in the messages list
        setMessages(prev => prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, isPinned: false, pinnedAt: undefined }
            : msg
        ));
        // Remove from pinned messages list
        setPinnedMessages(prev => prev.filter(m => m.id !== data.messageId));
      }
    });
    
    return unsubUnpinned;
  }, [incidentId, onMessageUnpinned]);

  // Subscribe to messages read events (real-time read status updates)
  useEffect(() => {
    const unsubRead = onMessagesRead((data) => {
      if (data.incidentId === incidentId && data.userId !== currentUserId) {
        // Another user has read messages - update readBy array for all messages
        setMessages(prev => prev.map(msg => {
          // Only update if this user hasn't already read this message
          if (!msg.readBy.includes(data.userId)) {
            return { ...msg, readBy: [...msg.readBy, data.userId] };
          }
          return msg;
        }));
      }
    });
    
    return unsubRead;
  }, [incidentId, currentUserId, onMessagesRead]);

  // Fetch unread count and pinned messages on mount
  useEffect(() => {
    fetchUnreadCount();
    fetchPinnedMessages();
  }, [fetchUnreadCount, fetchPinnedMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  // Note: Message read marking is handled by ChatSidebar when it opens
  // We only reset unread count here for UI consistency
  useEffect(() => {
    if (isOpen && !isMinimized && unreadCount > 0) {
      setUnreadCount(0);
    }
  }, [isOpen, isMinimized, unreadCount]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isParticipant) return;
    
    // Handle editing
    if (editingMessage) {
      await saveEdit();
      return;
    }
    
    const content = newMessage.trim();
    setNewMessage('');
    setReplyTo(null);
    
    // Send via WebSocket
    wsSendMessage(incidentId, content, replyTo?.id);
    
    // Stop typing indicator
    setTyping(incidentId, false);
  };

  const handleMentionInputChange = (value: string) => {
    setNewMessage(value);
    
    // Send typing indicator
    setTyping(incidentId, true);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(incidentId, false);
    }, 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    setTyping(incidentId, true);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(incidentId, false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === 'Escape' && editingMessage) {
      cancelEditing();
    }
  };

  const toggleOpen = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else {
      setIsOpen(false);
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // Show actual time in 12-hour format with AM/PM
      return format(date, 'h:mm a');
    } catch {
      return '';
    }
  };

  // Format date stamp for message grouping
  const formatDateStamp = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      if (isToday(date)) {
        return 'Today';
      }
      
      if (isYesterday(date)) {
        return 'Yesterday';
      }
      
      // Check if within current week (show day name: Monday, Tuesday, etc.)
      const daysDiff = differenceInDays(startOfDay(now), startOfDay(date));
      if (daysDiff < 7) {
        return format(date, 'EEEE'); // Full day name
      }
      
      // Check weeks
      const weeksDiff = differenceInWeeks(now, date);
      if (weeksDiff === 1) {
        return 'Last week';
      }
      if (weeksDiff < 4) {
        return `${weeksDiff} weeks ago`;
      }
      
      // Check months
      const monthsDiff = differenceInMonths(now, date);
      if (monthsDiff === 1) {
        return 'Last month';
      }
      if (monthsDiff < 12) {
        return format(date, 'MMMM yyyy'); // "January 2026"
      }
      
      // Check years
      const yearsDiff = differenceInYears(now, date);
      if (yearsDiff === 1) {
        return 'Last year';
      }
      
      // Older dates - show full date
      return format(date, 'MMMM d, yyyy'); // "January 1, 2025"
    } catch {
      return '';
    }
  };

  // Check if two dates are on different days
  const isDifferentDay = (date1: string, date2: string): boolean => {
    try {
      const d1 = startOfDay(new Date(date1));
      const d2 = startOfDay(new Date(date2));
      return d1.getTime() !== d2.getTime();
    } catch {
      return false;
    }
  };

  const isUserOnline = (userId: string) => onlineUsers.has(userId);

  // Generate a consistent color for each user based on their ID
  const getUserColor = useCallback((userId: string) => {
    const colors = [
      { bg: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', light: 'bg-purple-100 dark:bg-purple-900/30' },
      { bg: 'bg-green-500', text: 'text-green-600 dark:text-green-400', light: 'bg-green-100 dark:bg-green-900/30' },
      { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', light: 'bg-orange-100 dark:bg-orange-900/30' },
      { bg: 'bg-pink-500', text: 'text-pink-600 dark:text-pink-400', light: 'bg-pink-100 dark:bg-pink-900/30' },
      { bg: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400', light: 'bg-teal-100 dark:bg-teal-900/30' },
      { bg: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', light: 'bg-indigo-100 dark:bg-indigo-900/30' },
      { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', light: 'bg-red-100 dark:bg-red-900/30' },
      { bg: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400', light: 'bg-cyan-100 dark:bg-cyan-900/30' },
    ];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, []);

  // Get unique users from messages for filter dropdown
  const uniqueUsers = React.useMemo(() => {
    const userMap = new Map<string, { id: string; firstName: string; lastName: string }>();
    messages.forEach(msg => {
      if (msg.user && !userMap.has(msg.userId)) {
        userMap.set(msg.userId, {
          id: msg.userId,
          firstName: msg.user.firstName,
          lastName: msg.user.lastName,
        });
      }
    });
    return Array.from(userMap.values());
  }, [messages]);

  // Filter messages based on current filters
  const filteredMessages = React.useMemo(() => {
    return messages.filter(message => {
      // Filter by user
      if (filterByUser && message.userId !== filterByUser) {
        return false;
      }

      // Filter by type
      if (filterByType !== 'all') {
        const hasAttachment = message.attachments || message.messageType === 'FILE' || message.messageType === 'IMAGE';
        const isVoice = message.attachments?.isVoiceMessage || message.messageType === 'FILE' && message.attachments?.mimeType?.startsWith('audio/');
        const isImage = message.messageType === 'IMAGE' || message.attachments?.mimeType?.startsWith('image/') || message.messageType === 'EVIDENCE_LINK';
        
        switch (filterByType) {
          case 'attachments':
            if (!hasAttachment) return false;
            break;
          case 'voice':
            if (!isVoice) return false;
            break;
          case 'images':
            if (!isImage) return false;
            break;
          case 'text':
            if (hasAttachment) return false;
            break;
        }
      }

      // Filter by date range
      if (filterByDateFrom) {
        const messageDate = new Date(message.createdAt);
        const fromDate = new Date(filterByDateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (messageDate < fromDate) return false;
      }

      if (filterByDateTo) {
        const messageDate = new Date(message.createdAt);
        const toDate = new Date(filterByDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (messageDate > toDate) return false;
      }

      return true;
    });
  }, [messages, filterByUser, filterByType, filterByDateFrom, filterByDateTo]);

  // Check if any filter is active
  const hasActiveFilters = filterByUser || filterByType !== 'all' || filterByDateFrom || filterByDateTo;

  // Clear all filters
  const clearFilters = () => {
    setFilterByUser(null);
    setFilterByType('all');
    setFilterByDateFrom('');
    setFilterByDateTo('');
  };

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
    };

    if (showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (typingUsers.size === 0) return null;
    
    const users = Array.from(typingUsers.values());
    const names = users.map(u => u.firstName).join(', ');
    
    return (
      <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 italic">
        {names} {users.length === 1 ? 'is' : 'are'} typing...
      </div>
    );
  };

  if (!isParticipant) {
    return null;
  }

  // Sidebar mode: no floating button, just content
  if (isSidebarMode) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-slate-900" style={{ height: '100%', maxHeight: '100dvh' }}>
        {/* Pinned Messages Section */}
        {pinnedMessages.length > 0 && (
          <div className="flex-none">
            <PinnedMessagesSection
              messages={pinnedMessages}
              onJumpToMessage={jumpToMessage}
              onUnpin={unpinMessage}
              canUnpin={true}
            />
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex-none px-4 py-2 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Filter Button */}
              <div className="relative" ref={filterMenuRef}>
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                    hasActiveFilters
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter</span>
                  {hasActiveFilters && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full">
                      {[filterByUser, filterByType !== 'all', filterByDateFrom, filterByDateTo].filter(Boolean).length}
                    </span>
                  )}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Filter Dropdown Menu */}
                {showFilterMenu && (
                  <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-auto sm:top-full sm:left-0 bottom-20 sm:bottom-auto sm:mt-2 w-auto sm:w-80 md:w-96 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-600 z-50 animate-context-menu">
                    <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200">Filter Messages</h4>
                        {hasActiveFilters && (
                          <button
                            onClick={clearFilters}
                            className="text-xs sm:text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter by User */}
                    <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-slate-700">
                      <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        <User className="w-4 h-4" />
                        By User
                      </label>
                      <select
                        value={filterByUser || ''}
                        onChange={(e) => setFilterByUser(e.target.value || null)}
                        className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">All users</option>
                        {uniqueUsers.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Filter by Type */}
                    <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-slate-700">
                      <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        <Paperclip className="w-4 h-4" />
                        By Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'all', label: 'All' },
                          { value: 'text', label: 'Text Only' },
                          { value: 'attachments', label: 'Attachments' },
                          { value: 'images', label: 'Images' },
                          { value: 'voice', label: 'Voice' },
                        ].map(option => (
                          <button
                            key={option.value}
                            onClick={() => setFilterByType(option.value as any)}
                            className={`px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                              filterByType === option.value
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filter by Date */}
                    <div className="p-3 sm:p-4">
                      <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        <Calendar className="w-4 h-4" />
                        By Date Range
                      </label>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">From</label>
                          <input
                            type="date"
                            value={filterByDateFrom}
                            onChange={(e) => setFilterByDateFrom(e.target.value)}
                            max={filterByDateTo || undefined}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">To</label>
                          <input
                            type="date"
                            value={filterByDateTo}
                            onChange={(e) => setFilterByDateTo(e.target.value)}
                            min={filterByDateFrom || undefined}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Active filter chips */}
              {hasActiveFilters && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {filterByUser && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                      <User className="w-2.5 h-2.5" />
                      {uniqueUsers.find(u => u.id === filterByUser)?.firstName || 'User'}
                      <button onClick={() => setFilterByUser(null)} className="ml-0.5 hover:text-blue-800">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )}
                  {filterByType !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                      <Paperclip className="w-2.5 h-2.5" />
                      {filterByType}
                      <button onClick={() => setFilterByType('all')} className="ml-0.5 hover:text-purple-800">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )}
                  {(filterByDateFrom || filterByDateTo) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                      <Calendar className="w-2.5 h-2.5" />
                      {filterByDateFrom || '...'} - {filterByDateTo || '...'}
                      <button onClick={() => { setFilterByDateFrom(''); setFilterByDateTo(''); }} className="ml-0.5 hover:text-green-800">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Message count */}
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {hasActiveFilters ? `${filteredMessages.length} of ${messages.length}` : `${messages.length}`} messages
            </span>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-gray-50 dark:bg-slate-800"
          onClick={handleContainerClick}
          onContextMenu={handleContainerContextMenu}
        >
          {loading && (!messages || messages.length === 0) ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Loading messages...
            </div>
          ) : !messages || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <MessageCircle className="w-12 h-12 mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Start the conversation!</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <Filter className="w-12 h-12 mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-sm">No messages match filters</p>
              <button
                onClick={clearFilters}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {filteredMessages.map((message, index) => {
                const isOwn = message.userId === currentUserId;
                const online = isUserOnline(message.userId);
                const canEdit = isOwn && !message.isDeleted && 
                  (new Date().getTime() - new Date(message.createdAt).getTime()) < 15 * 60 * 1000;
                
                // Check if we need to show a date separator
                const previousMessage = index > 0 ? filteredMessages[index - 1] : null;
                const showDateSeparator = index === 0 || 
                  (previousMessage && isDifferentDay(previousMessage.createdAt, message.createdAt));
                const canDelete = isOwn;
                const canPin = true;
                
                const groupedReactions = (message.reactions || []).reduce((acc, r) => {
                  const existing = acc.find(g => g.emoji === r.emoji);
                  if (existing) {
                    existing.count++;
                    existing.users.push(r.user);
                  } else {
                    acc.push({ emoji: r.emoji, count: 1, users: [r.user] });
                  }
                  return acc;
                }, [] as { emoji: string; count: number; users: { id: string; firstName: string; lastName: string }[] }[]);
                
                // Date separator component
                const DateSeparator = showDateSeparator ? (
                  <div className="flex items-center justify-center my-4">
                    <div className="flex-1 border-t border-gray-200 dark:border-slate-600"></div>
                    <span className="px-4 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 rounded-full shadow-sm">
                      {formatDateStamp(message.createdAt)}
                    </span>
                    <div className="flex-1 border-t border-gray-200 dark:border-slate-600"></div>
                  </div>
                ) : null;
                
                // Render message based on type - you can add all message type renders here
                if (message.messageType === 'SYSTEM') {
                  return (
                    <React.Fragment key={message.id}>
                      {DateSeparator}
                      <div 
                        id={`message-${message.id}`}
                        data-message-id={message.id}
                        className="text-center transition-colors duration-500 animate-message-system"
                        onContextMenu={(e) => handleContextMenu(message.id, e)}
                        onTouchStart={(e) => handleMessageLongPressStart(message.id, e)}
                        onTouchEnd={handleMessageLongPressEnd}
                        onTouchCancel={handleMessageLongPressEnd}
                      >
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-3 py-1.5 rounded-full inline-flex items-center shadow-sm">
                          {message.content}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                }

                // Phase 3: Render smart message types
                if (['DECISION', 'QUESTION', 'UPDATE', 'ANNOUNCEMENT'].includes(message.messageType)) {
                  return (
                    <React.Fragment key={message.id}>
                      {DateSeparator}
                      <div 
                        id={`message-${message.id}`}
                        data-message-id={message.id}
                        className={`transition-colors duration-500 ${isOwn ? 'animate-message-send' : 'animate-message-receive'}`}
                        onContextMenu={(e) => handleContextMenu(message.id, e)}
                        onTouchStart={(e) => handleMessageLongPressStart(message.id, e)}
                        onTouchEnd={handleMessageLongPressEnd}
                        onTouchCancel={handleMessageLongPressEnd}
                      >
                        <SmartMessageRenderer
                          message={message}
                          incidentId={incidentId}
                          currentUserId={currentUserId}
                          onMessageUpdate={fetchMessages}
                        />
                      </div>
                    </React.Fragment>
                  );
                }

                // Render EVIDENCE_LINK messages with image preview
                if (message.messageType === 'EVIDENCE_LINK') {
                  // If evidence is missing, render a deleted evidence message
                  if (!message.evidence) {
                    return (
                      <React.Fragment key={message.id}>
                        {DateSeparator}
                        <div
                          id={`message-${message.id}`}
                          data-message-id={message.id}
                          className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 transition-colors duration-500 w-full group chat-message-hover ${isOwn ? 'animate-message-send' : 'animate-message-receive'}`}
                        >
                          {/* Avatar */}
                          <div className="flex-shrink-0 mb-1">
                            {message.user.profilePicture ? (
                              <img
                                src={message.user.profilePicture}
                                alt={`${message.user.firstName} ${message.user.lastName}`}
                                className={`w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 shadow-sm`}
                              />
                            ) : (
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                                  isOwn ? 'bg-blue-600' : getUserColor(message.userId).bg
                                } ring-2 ring-white dark:ring-slate-800 shadow-sm`}
                              >
                                {`${message.user.firstName?.[0] || ''}${message.user.lastName?.[0] || ''}`.toUpperCase()}
                              </div>
                            )}
                          </div>
                          {/* Deleted evidence message */}
                          <div className={`max-w-[75%] min-w-0`}>
                            <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <span className={`text-xs font-semibold ${isOwn ? 'text-blue-600 dark:text-blue-400' : getUserColor(message.userId).text}`}>
                                {isOwn ? 'You' : `${message.user.firstName} ${message.user.lastName}`}
                              </span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                {formatTime(message.createdAt)}
                              </span>
                            </div>
                            <div className={`relative rounded-2xl shadow-sm px-4 py-3 ${
                              isOwn
                                ? 'bg-gray-400 dark:bg-gray-600 text-white rounded-br-md'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-bl-md'
                            }`}>
                              <div className="flex items-center gap-2 text-sm italic">
                                <FileText className="w-4 h-4 opacity-50" />
                                <span>Evidence no longer available</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }
                  
                  const evidence = message.evidence;
                  if (evidence) {
                    const fileName = evidence.fileName?.toLowerCase() || '';
                    const isImageByExt = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
                    const isVideoByExt = /\.(mp4|webm|mov|avi|mkv)$/i.test(fileName);
                    const isImage = evidence.mimeType?.startsWith('image/') || ['PHOTO'].includes(evidence.type) || isImageByExt;
                    const isVideo = evidence.mimeType?.startsWith('video/') || ['VIDEO'].includes(evidence.type) || isVideoByExt;
                    
                    // Get the loaded evidence URL, or trigger loading
                    const loadedUrl = evidenceUrls[evidence.id];
                    const isLoadingUrl = loadingEvidenceUrls[evidence.id];
                    
                    // Trigger loading if not already loaded/loading
                    if (!loadedUrl && !isLoadingUrl && (isImage || isVideo)) {
                      // Call loadEvidenceUrl in next tick to avoid state updates during render
                      setTimeout(() => loadEvidenceUrl(evidence.id, evidence.filePath, evidence.source), 0);
                    }
                    
                    // Use loaded blob URL if available, otherwise try direct URL
                    const fileUrl = loadedUrl || (evidence.filePath.startsWith('http') 
                      ? evidence.filePath 
                      : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}${evidence.filePath}`);
                    
                    // Extract comment from content (after "💬 Comment:")
                    const commentMatch = message.content.match(/💬 Comment:\s*(.+)/s);
                    const comment = commentMatch ? commentMatch[1].trim() : null;
                    
                    return (
                      <React.Fragment key={message.id}>
                        {DateSeparator}
                        <div
                          id={`message-${message.id}`}
                          data-message-id={message.id}
                          className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 transition-colors duration-500 w-full group chat-message-hover ${isOwn ? 'animate-message-send' : 'animate-message-receive'}`}
                          onContextMenu={(e) => handleContextMenu(message.id, e)}
                          onTouchStart={(e) => handleMessageLongPressStart(message.id, e)}
                          onTouchEnd={handleMessageLongPressEnd}
                          onTouchCancel={handleMessageLongPressEnd}
                        >
                      {/* Avatar */}
                      <div className="flex-shrink-0 mb-1">
                        {message.user.profilePicture ? (
                          <img
                            src={message.user.profilePicture}
                            alt={`${message.user.firstName} ${message.user.lastName}`}
                            className={`w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 shadow-sm`}
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                              isOwn ? 'bg-blue-600' : getUserColor(message.userId).bg
                            } ring-2 ring-white dark:ring-slate-800 shadow-sm`}
                          >
                            {`${message.user.firstName?.[0] || ''}${message.user.lastName?.[0] || ''}`.toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Evidence content */}
                      <div className={`max-w-[75%] min-w-0`}>
                        {/* Sender name */}
                        <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-xs font-semibold ${isOwn ? 'text-blue-600 dark:text-blue-400' : getUserColor(message.userId).text}`}>
                            {isOwn ? 'You' : `${message.user.firstName} ${message.user.lastName}`}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {formatTime(message.createdAt)}
                          </span>
                        </div>

                        {/* Pinned indicator for evidence */}
                        {message.isPinned && (
                          <div className={`flex items-center gap-1 mb-1 text-xs ${isOwn ? 'justify-end' : 'justify-start'} text-amber-600 dark:text-amber-400`}>
                            <Pin className="w-3 h-3" />
                            <span className="font-medium">Pinned</span>
                          </div>
                        )}

                        <div
                          className={`relative rounded-2xl shadow-sm overflow-hidden ${
                            isOwn
                              ? 'bg-blue-600 rounded-br-md'
                              : 'bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-md border border-emerald-200 dark:border-emerald-800'
                          } ${message.isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}
                        >
                          {/* Evidence badge */}
                          <div className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${
                            isOwn ? 'bg-blue-700 text-blue-100' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            <FileText className="w-3.5 h-3.5" />
                            Evidence Shared
                          </div>

                          {/* Image/Video preview */}
                          {isImage && (
                            isLoadingUrl ? (
                              <div className="w-full h-32 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                              </div>
                            ) : loadedUrl ? (
                              <div 
                                className="cursor-pointer relative group/image"
                                onClick={() => setPreviewImage({ url: fileUrl, fileName: evidence.fileName })}
                              >
                                <img
                                  src={fileUrl}
                                  alt={evidence.fileName}
                                  className="max-w-full max-h-64 object-contain bg-black/5"
                                  onError={(e) => {
                                    // Hide image on error and show fallback
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/image:opacity-100">
                                  <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">Click to view full size</span>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer relative group/image"
                                onClick={() => setPreviewImage({ url: fileUrl, fileName: evidence.fileName })}
                              >
                                <img
                                  src={fileUrl}
                                  alt={evidence.fileName}
                                  className="max-w-full max-h-64 object-contain bg-black/5"
                                  onError={(e) => {
                                    // Hide image on error and show fallback
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/image:opacity-100">
                                  <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">Click to view full size</span>
                                </div>
                              </div>
                            )
                          )}

                          {isVideo && (
                            isLoadingUrl ? (
                              <div className="w-full h-32 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                              </div>
                            ) : (
                              <video
                                src={fileUrl}
                                controls
                                className="max-w-full max-h-64"
                                preload="metadata"
                              />
                            )
                          )}

                          {/* File info */}
                          <div className={`px-3 py-2 ${isOwn ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                            <p className="text-sm font-medium truncate flex items-center gap-1.5">
                              {isImage ? <Image className="w-4 h-4 flex-shrink-0" /> : 
                               isVideo ? <FileVideo className="w-4 h-4 flex-shrink-0" /> :
                               <FileText className="w-4 h-4 flex-shrink-0" />}
                              {evidence.fileName}
                            </p>
                            {comment && (
                              <p className={`text-sm mt-1.5 ${isOwn ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'}`}>
                                💬 {comment}
                              </p>
                            )}
                          </div>

                          {/* Read status */}
                          <div className={`px-3 pb-2 flex items-center justify-end text-[10px] ${
                            isOwn ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {isOwn && (
                              message.readBy.length > 1 ? (
                                <span className="flex items-center gap-0.5">
                                  <CheckCheck className="w-3 h-3" />
                                  <span>Read</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5">
                                  <Check className="w-3 h-3" />
                                  <span>Sent</span>
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                  );
                  }
                }

                // Render RCA_LINK messages with special card styling
                if (message.messageType === 'RCA_LINK') {
                  // Parse the content to extract title, content, and comment
                  const contentParts = message.content.split('\n\n💬 Comment:');
                  const mainContent = contentParts[0] || '';
                  const comment = contentParts[1]?.trim() || null;
                  
                  // Parse title and actual content from mainContent
                  const contentLines = mainContent.split('\n');
                  const title = contentLines[0] || '';
                  const rcaContent = contentLines.slice(1).join('\n') || '';
                  
                  // Determine the icon and colors based on rcaItemType
                  const getRCAStyle = () => {
                    if (message.rcaItemType === 'root_cause') {
                      return {
                        icon: <Target className="w-4 h-4" />,
                        label: 'Root Cause',
                        bgColor: isOwn ? 'bg-blue-700' : 'bg-red-100 dark:bg-red-900/30',
                        textColor: isOwn ? 'text-blue-100' : 'text-red-700 dark:text-red-300',
                        borderColor: 'border-red-200 dark:border-red-800',
                      };
                    } else if (message.rcaItemType === '5why_step') {
                      return {
                        icon: <HelpCircle className="w-4 h-4" />,
                        label: '5-Whys Analysis',
                        bgColor: isOwn ? 'bg-blue-700' : 'bg-amber-100 dark:bg-amber-900/30',
                        textColor: isOwn ? 'text-blue-100' : 'text-amber-700 dark:text-amber-300',
                        borderColor: 'border-amber-200 dark:border-amber-800',
                      };
                    } else if (message.rcaItemType === 'fishbone_cause') {
                      return {
                        icon: <Fish className="w-4 h-4" />,
                        label: 'Fishbone Cause',
                        bgColor: isOwn ? 'bg-blue-700' : 'bg-purple-100 dark:bg-purple-900/30',
                        textColor: isOwn ? 'text-blue-100' : 'text-purple-700 dark:text-purple-300',
                        borderColor: 'border-purple-200 dark:border-purple-800',
                      };
                    } else if (message.rcaItemType === 'fishbone_problem') {
                      return {
                        icon: <Fish className="w-4 h-4" />,
                        label: 'Fishbone Problem',
                        bgColor: isOwn ? 'bg-blue-700' : 'bg-purple-100 dark:bg-purple-900/30',
                        textColor: isOwn ? 'text-blue-100' : 'text-purple-700 dark:text-purple-300',
                        borderColor: 'border-purple-200 dark:border-purple-800',
                      };
                    } else if (message.rcaItemType === 'fishbone_cause_5why') {
                      return {
                        icon: <HelpCircle className="w-4 h-4" />,
                        label: 'Fishbone 5-Why',
                        bgColor: isOwn ? 'bg-blue-700' : 'bg-amber-100 dark:bg-amber-900/30',
                        textColor: isOwn ? 'text-blue-100' : 'text-amber-700 dark:text-amber-300',
                        borderColor: 'border-amber-200 dark:border-amber-800',
                      };
                    } else if (message.rcaItemType === 'fishbone_cause_root') {
                      return {
                        icon: <Target className="w-4 h-4" />,
                        label: 'Fishbone Root Cause',
                        bgColor: isOwn ? 'bg-blue-700' : 'bg-green-100 dark:bg-green-900/30',
                        textColor: isOwn ? 'text-blue-100' : 'text-green-700 dark:text-green-300',
                        borderColor: 'border-green-200 dark:border-green-800',
                      };
                    }
                    return {
                      icon: <GitBranch className="w-4 h-4" />,
                      label: 'RCA Analysis',
                      bgColor: isOwn ? 'bg-blue-700' : 'bg-indigo-100 dark:bg-indigo-900/30',
                      textColor: isOwn ? 'text-blue-100' : 'text-indigo-700 dark:text-indigo-300',
                      borderColor: 'border-indigo-200 dark:border-indigo-800',
                    };
                  };
                  
                  const rcaStyle = getRCAStyle();
                  
                  return (
                    <React.Fragment key={message.id}>
                      {DateSeparator}
                      <div
                        id={`message-${message.id}`}
                        data-message-id={message.id}
                        className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 transition-colors duration-500 w-full group chat-message-hover ${isOwn ? 'animate-message-send' : 'animate-message-receive'}`}
                        onContextMenu={(e) => handleContextMenu(message.id, e)}
                        onTouchStart={(e) => handleMessageLongPressStart(message.id, e)}
                        onTouchEnd={handleMessageLongPressEnd}
                        onTouchCancel={handleMessageLongPressEnd}
                      >
                        {/* Avatar */}
                        <div className="flex-shrink-0 mb-1">
                          {message.user.profilePicture ? (
                            <img
                              src={message.user.profilePicture}
                              alt={`${message.user.firstName} ${message.user.lastName}`}
                              className={`w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 shadow-sm`}
                            />
                          ) : (
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                                isOwn ? 'bg-blue-600' : getUserColor(message.userId).bg
                              } ring-2 ring-white dark:ring-slate-800 shadow-sm`}
                            >
                              {`${message.user.firstName?.[0] || ''}${message.user.lastName?.[0] || ''}`.toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* RCA content */}
                        <div className={`max-w-[75%] min-w-0`}>
                          {/* Sender name */}
                          <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <span className={`text-xs font-semibold ${isOwn ? 'text-blue-600 dark:text-blue-400' : getUserColor(message.userId).text}`}>
                              {isOwn ? 'You' : `${message.user.firstName} ${message.user.lastName}`}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {formatTime(message.createdAt)}
                            </span>
                          </div>

                          {/* Pinned indicator for RCA */}
                          {message.isPinned && (
                            <div className={`flex items-center gap-1 mb-1 text-xs ${isOwn ? 'justify-end' : 'justify-start'} text-amber-600 dark:text-amber-400`}>
                              <Pin className="w-3 h-3" />
                              <span className="font-medium">Pinned</span>
                            </div>
                          )}

                          <div
                            className={`relative rounded-2xl shadow-sm overflow-hidden ${
                              isOwn
                                ? 'bg-blue-600 rounded-br-md'
                                : `bg-white dark:bg-slate-800 rounded-bl-md border ${rcaStyle.borderColor}`
                            } ${message.isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}
                          >
                            {/* RCA badge header */}
                            <div className={`px-3 py-2 text-xs font-medium flex items-center gap-2 ${rcaStyle.bgColor} ${rcaStyle.textColor}`}>
                              {rcaStyle.icon}
                              <span>{rcaStyle.label}</span>
                            </div>

                            {/* RCA content */}
                            <div className={`px-3 py-2 ${isOwn ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                              {/* Title (emoji + type) */}
                              <p className="text-sm font-semibold mb-1">{title}</p>
                              
                              {/* Actual RCA content */}
                              {rcaContent && (
                                <p className="text-sm whitespace-pre-wrap">{rcaContent}</p>
                              )}
                              
                              {/* Comment if present */}
                              {comment && (
                                <p className={`text-sm mt-2 pt-2 border-t ${
                                  isOwn ? 'border-blue-500 text-blue-100' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300'
                                }`}>
                                  💬 {comment}
                                </p>
                              )}
                            </div>

                            {/* View RCA link */}
                            {message.rcaAnalysisId && (
                              <div className={`px-3 py-2 border-t ${
                                isOwn ? 'border-blue-500' : 'border-gray-100 dark:border-slate-700'
                              }`}>
                                <a
                                  href={`/rca/${message.rcaAnalysisId}`}
                                  className={`text-xs flex items-center gap-1 hover:underline ${
                                    isOwn ? 'text-blue-200 hover:text-blue-100' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700'
                                  }`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  View Full RCA
                                </a>
                              </div>
                            )}

                            {/* Read status */}
                            <div className={`px-3 pb-2 flex items-center justify-end text-[10px] ${
                              isOwn ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {isOwn && (
                                message.readBy.length > 1 ? (
                                  <span className="flex items-center gap-0.5">
                                    <CheckCheck className="w-3 h-3" />
                                    <span>Read</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-0.5">
                                    <Check className="w-3 h-3" />
                                    <span>Sent</span>
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }

                // Phase 4: Render FILE and IMAGE messages with attachments
                if ((message.messageType === 'FILE' || message.messageType === 'IMAGE') && message.attachments) {
                  // Handle deleted messages
                  if (message.isDeleted) {
                    return (
                      <React.Fragment key={message.id}>
                        {DateSeparator}
                        <div
                          id={`message-${message.id}`}
                          data-message-id={message.id}
                          className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 transition-colors duration-500 w-full group ${isOwn ? 'animate-message-send' : 'animate-message-receive'}`}
                        >
                        {/* Avatar */}
                        <div className="flex-shrink-0 mb-1">
                          {message.user.profilePicture ? (
                            <img
                              src={message.user.profilePicture}
                              alt={`${message.user.firstName} ${message.user.lastName}`}
                              className={`w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 shadow-sm opacity-50`}
                            />
                          ) : (
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                                isOwn ? 'bg-blue-600' : getUserColor(message.userId).bg
                              } ring-2 ring-white dark:ring-slate-800 shadow-sm opacity-50`}
                            >
                              {`${message.user.firstName?.[0] || ''}${message.user.lastName?.[0] || ''}`.toUpperCase()}
                            </div>
                          )}
                        </div>
                        {/* Deleted message bubble */}
                        <div className={`max-w-[75%] min-w-0`}>
                          <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <span className={`text-xs font-semibold opacity-50 ${isOwn ? 'text-blue-600 dark:text-blue-400' : getUserColor(message.userId).text}`}>
                              {isOwn ? 'You' : `${message.user.firstName} ${message.user.lastName}`}
                            </span>
                          </div>
                          <div className={`px-3 py-2 rounded-2xl ${
                            isOwn 
                              ? 'bg-blue-600/30 text-blue-300' 
                              : 'bg-gray-100/50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400'
                          }`}>
                            <p className="text-sm italic">🗑️ This message was deleted</p>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                    );
                  }

                  const attachment = message.attachments;
                  const isImage = attachment.mimeType?.startsWith('image/');
                  const isVideo = attachment.mimeType?.startsWith('video/');
                  const isAudio = attachment.mimeType?.startsWith('audio/') || attachment.isVoiceMessage;
                  
                  const fileUrl = attachment.filePath.startsWith('http')
                    ? attachment.filePath
                    : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}${attachment.filePath}`;

                  return (
                    <React.Fragment key={message.id}>
                      {DateSeparator}
                      <div
                        id={`message-${message.id}`}
                        data-message-id={message.id}
                        className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 transition-colors duration-500 w-full group chat-message-hover ${isOwn ? 'animate-message-send' : 'animate-message-receive'}`}
                        onContextMenu={(e) => handleContextMenu(message.id, e)}
                        onTouchStart={(e) => handleMessageLongPressStart(message.id, e)}
                        onTouchEnd={handleMessageLongPressEnd}
                        onTouchCancel={handleMessageLongPressEnd}
                      >
                      {/* Avatar */}
                      <div className="flex-shrink-0 mb-1">
                        {message.user.profilePicture ? (
                          <img
                            src={message.user.profilePicture}
                            alt={`${message.user.firstName} ${message.user.lastName}`}
                            className={`w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 shadow-sm`}
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                              isOwn ? 'bg-blue-600' : getUserColor(message.userId).bg
                            } ring-2 ring-white dark:ring-slate-800 shadow-sm`}
                          >
                            {`${message.user.firstName?.[0] || ''}${message.user.lastName?.[0] || ''}`.toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* File content */}
                      <div className={`max-w-[75%] min-w-0`}>
                        {/* Sender name */}
                        <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-xs font-semibold ${isOwn ? 'text-blue-600 dark:text-blue-400' : getUserColor(message.userId).text}`}>
                            {isOwn ? 'You' : `${message.user.firstName} ${message.user.lastName}`}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {formatTime(message.createdAt)}
                          </span>
                        </div>

                        {/* Pinned indicator for attachments */}
                        {message.isPinned && (
                          <div className={`flex items-center gap-1 mb-1 text-xs ${isOwn ? 'justify-end' : 'justify-start'} text-amber-600 dark:text-amber-400`}>
                            <Pin className="w-3 h-3" />
                            <span className="font-medium">Pinned</span>
                          </div>
                        )}

                        {/* File message bubble */}
                        <div className={`rounded-2xl overflow-hidden ${
                          isOwn 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 dark:bg-slate-700'
                        } ${message.isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}>
                          {/* Image Preview */}
                          {isImage && (
                            <div 
                              className="cursor-pointer"
                              onClick={() => setPreviewImage({ url: fileUrl, fileName: attachment.fileName })}
                            >
                              <img
                                src={fileUrl}
                                alt={attachment.fileName}
                                className="max-w-full max-h-60 object-contain"
                                loading="lazy"
                              />
                            </div>
                          )}

                          {/* Video Preview */}
                          {isVideo && (
                            <video
                              src={fileUrl}
                              controls
                              className="max-w-full max-h-60"
                              preload="metadata"
                            />
                          )}

                          {/* Audio/Voice Message with Animated Waveform */}
                          {isAudio && (() => {
                            const progress = audioProgress[message.id];
                            const isPlaying = playingAudioId === message.id;
                            const currentTime = progress?.currentTime || 0;
                            const duration = progress?.duration || 0;
                            const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
                            const timeRemaining = duration - currentTime;
                            
                            // Generate consistent waveform bars based on message ID
                            const waveformBars = Array.from({ length: 32 }, (_, i) => {
                              const seed = message.id.charCodeAt(i % message.id.length) + i;
                              return 8 + (seed % 20);
                            });
                            
                            return (
                              <div className="p-3 min-w-[200px]">
                                <div className="flex items-center gap-3">
                                  {/* Play/Pause Button */}
                                  <button
                                    onClick={() => {
                                      const audio = document.getElementById(`audio-${message.id}`) as HTMLAudioElement;
                                      if (audio) toggleAudioPlayback(message.id, audio);
                                    }}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                                      isOwn 
                                        ? 'bg-blue-500 hover:bg-blue-400 hover:scale-105' 
                                        : 'bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 hover:scale-105'
                                    } ${isPlaying ? 'ring-2 ring-offset-1 ring-blue-300 dark:ring-blue-500' : ''}`}
                                  >
                                    {isPlaying ? (
                                      <Pause className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`} />
                                    ) : (
                                      <Play className={`w-5 h-5 ml-0.5 ${isOwn ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`} />
                                    )}
                                  </button>
                                  
                                  {/* Waveform and Progress */}
                                  <div className="flex-1 min-w-0">
                                    {/* Animated Waveform */}
                                    <div className="flex items-center gap-[2px] h-8 relative">
                                      {waveformBars.map((height, i) => {
                                        const barProgress = (i / waveformBars.length) * 100;
                                        const isPast = barProgress <= progressPercent;
                                        const isCurrent = Math.abs(barProgress - progressPercent) < (100 / waveformBars.length);
                                        
                                        return (
                                          <div
                                            key={i}
                                            className={`w-[3px] rounded-full transition-all duration-150 ${
                                              isPast
                                                ? isOwn 
                                                  ? 'bg-white' 
                                                  : 'bg-blue-500 dark:bg-blue-400'
                                                : isOwn 
                                                  ? 'bg-blue-400/50' 
                                                  : 'bg-gray-300 dark:bg-slate-500'
                                            }`}
                                            style={{ 
                                              height: `${height}px`,
                                              transform: isPlaying && isCurrent ? 'scaleY(1.3)' : 'scaleY(1)',
                                              opacity: isPlaying && isCurrent ? 1 : (isPast ? 0.9 : 0.6),
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                    
                                    {/* Time Display */}
                                    <div className="flex items-center justify-between mt-1">
                                      <span className={`text-[11px] font-mono ${
                                        isOwn ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
                                      }`}>
                                        {isPlaying 
                                          ? formatAudioTime(currentTime)
                                          : attachment.isVoiceMessage ? '🎤 Voice' : '🎵 Audio'
                                        }
                                      </span>
                                      <span className={`text-[11px] font-mono ${
                                        isOwn ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
                                      }`}>
                                        {duration > 0 
                                          ? (isPlaying ? `-${formatAudioTime(timeRemaining)}` : formatAudioTime(duration))
                                          : '--:--'
                                        }
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Hidden Audio Element */}
                                <audio
                                  id={`audio-${message.id}`}
                                  src={fileUrl}
                                  className="hidden"
                                  preload="auto"
                                  onLoadedMetadata={(e) => {
                                    const audio = e.currentTarget;
                                    setAudioProgress(prev => ({
                                      ...prev,
                                      [message.id]: {
                                        currentTime: 0,
                                        duration: audio.duration || 0,
                                      },
                                    }));
                                  }}
                                />
                              </div>
                            );
                          })()}

                          {/* Document/Other Files */}
                          {!isImage && !isVideo && !isAudio && (
                            <div className="p-3">
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3"
                              >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  isOwn ? 'bg-blue-500' : 'bg-gray-200 dark:bg-slate-600'
                                }`}>
                                  <File className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                    {attachment.fileName}
                                  </p>
                                  <p className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {formatFileSize(attachment.fileSize)}
                                  </p>
                                </div>
                                <Download className={`w-4 h-4 ${isOwn ? 'text-blue-200' : 'text-gray-400'}`} />
                              </a>
                            </div>
                          )}

                          {/* Caption */}
                          {message.content && message.content !== attachment.fileName && !attachment.isVoiceMessage && (
                            <div className={`px-3 pb-2 pt-1 text-sm ${isOwn ? '' : 'text-gray-900 dark:text-white'}`}>
                              {message.content}
                            </div>
                          )}
                        </div>

                        {/* Reactions */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className={`mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                            <ReactionsDisplay
                              reactions={transformReactionsForDisplay(message.reactions)}
                              currentUserId={currentUserId}
                              onToggle={(emoji) => toggleReaction(message.id, emoji)}
                            />
                          </div>
                        )}

                        {/* Read receipt */}
                        <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          {isOwn && (
                            message.readBy.length > 1 ? (
                              <span className="flex items-center gap-0.5 text-blue-500">
                                <CheckCheck className="w-3 h-3" />
                                <span>Read</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-gray-400">
                                <Check className="w-3 h-3" />
                                <span>Sent</span>
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                  );
                }

                const userColor = isOwn ? null : getUserColor(message.userId);
                const userInitials = `${message.user.firstName?.[0] || ''}${message.user.lastName?.[0] || ''}`.toUpperCase();

                return (
                  <React.Fragment key={message.id}>
                    {DateSeparator}
                    <div
                      id={`message-${message.id}`}
                      data-message-id={message.id}
                      className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 transition-colors duration-500 w-full group chat-message-hover ${isOwn ? 'animate-message-send' : 'animate-message-receive'}`}
                      onContextMenu={(e) => handleContextMenu(message.id, e)}
                      onTouchStart={(e) => handleMessageLongPressStart(message.id, e)}
                      onTouchEnd={handleMessageLongPressEnd}
                      onTouchCancel={handleMessageLongPressEnd}
                    >
                    {/* Avatar */}
                    <div className="flex-shrink-0 mb-1 message-avatar">
                      {message.user.profilePicture ? (
                        <img
                          src={message.user.profilePicture}
                          alt={`${message.user.firstName} ${message.user.lastName}`}
                          className={`w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 shadow-sm`}
                          title={isOwn ? 'You' : `${message.user.firstName} ${message.user.lastName}`}
                        />
                      ) : (
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                            isOwn ? 'bg-blue-600' : userColor?.bg || 'bg-gray-500'
                          } ring-2 ring-white dark:ring-slate-800 shadow-sm`}
                          title={isOwn ? 'You' : `${message.user.firstName} ${message.user.lastName}`}
                        >
                          {userInitials}
                        </div>
                      )}
                      {/* Online indicator */}
                      <div className="relative">
                        <span
                          className={`absolute -top-1 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 ${
                            online ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Message content */}
                    <div className={`max-w-[75%] min-w-0 message-content`}>
                      {/* Sender name - always show */}
                      <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-xs font-semibold ${isOwn ? 'text-blue-600 dark:text-blue-400' : userColor?.text || 'text-gray-600 dark:text-gray-400'}`}>
                          {isOwn ? 'You' : `${message.user.firstName} ${message.user.lastName}`}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {formatTime(message.createdAt)}
                        </span>
                      </div>

                      {message.replyTo && (
                        <div className={`mb-1 px-2 py-1 rounded text-xs border-l-2 ${
                          isOwn 
                            ? 'bg-blue-500/20 text-blue-100 border-blue-300' 
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-blue-400'
                        }`}>
                          <span className="font-medium">
                            {message.replyTo.user.firstName}:
                          </span>{' '}
                          {message.replyTo.content.substring(0, 50)}
                          {message.replyTo.content.length > 50 && '...'}
                        </div>
                      )}
                      
                      {/* Pinned indicator */}
                      {message.isPinned && (
                        <div className="flex items-center gap-1 mb-1 text-xs text-amber-600 dark:text-amber-400">
                          <Pin className="w-3 h-3" />
                          <span className="font-medium">Pinned</span>
                        </div>
                      )}
                      
                      <div
                        className={`message-bubble relative px-3 py-2 rounded-2xl shadow-sm ${
                          isOwn
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : `${userColor?.light || 'bg-gray-100 dark:bg-slate-700'} text-gray-900 dark:text-white rounded-bl-md border border-gray-200 dark:border-slate-600`
                        } ${message.isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}
                      >
                        <p className="text-sm break-words whitespace-pre-wrap">
                          {message.isDeleted ? (
                            <span className="italic opacity-70">Message deleted</span>
                          ) : (
                            renderMessageWithMentions(
                              message.content, 
                              message.mentions || [], 
                              participants, 
                              currentUserId
                            )
                          )}
                        </p>
                        
                        {groupedReactions.length > 0 && (
                          <ReactionsDisplay
                            reactions={groupedReactions}
                            onToggle={(emoji) => toggleReaction(message.id, emoji)}
                            currentUserId={currentUserId}
                            compact
                          />
                        )}
                        
                        <div
                          className={`flex items-center justify-end space-x-1 mt-1 text-[10px] ${
                            isOwn ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {message.isEdited && (
                            <span className="italic mr-1">(edited)</span>
                          )}
                          {isOwn && (
                            message.readBy.length > 1 ? (
                              <span className="flex items-center gap-0.5">
                                <CheckCheck className="w-3 h-3" />
                                <span className="text-[9px]">Read</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5">
                                <Check className="w-3 h-3" />
                                <span className="text-[9px]">Sent</span>
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator - outside scrollable area for visibility */}
        {typingUsers.size > 0 && (
          <div className="flex-none px-4 py-1.5 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex space-x-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="italic">
                {Array.from(typingUsers.values()).map(u => u.firstName).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          </div>
        )}

        {/* Editing indicator */}
        {editingMessage && (
          <div className="flex-none px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between">
            <div className="flex items-center text-xs text-amber-700 dark:text-amber-400">
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              <span>Editing message</span>
            </div>
            <button
              onClick={cancelEditing}
              className="p-1 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Reply preview */}
        {replyTo && !editingMessage && (
          <div className="flex-none px-4 py-2 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-gray-500 dark:text-gray-400">Replying to </span>
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {replyTo.user.firstName}
              </span>
              <p className="text-gray-600 dark:text-gray-400 truncate max-w-[350px]">
                {replyTo.content}
              </p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="flex-none p-2 sm:p-3 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky bottom-0 z-10 safe-area-bottom">
          <div className="flex items-center space-x-1 sm:space-x-1.5 mb-2 pb-2 border-b border-gray-100 dark:border-slate-700 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setShowEvidencePicker(true)}
              className="group p-1.5 sm:p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
              title="Share Evidence"
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:rotate-6" />
            </button>
            <button
              onClick={() => setShowRCALinkPicker(true)}
              className="group p-1.5 sm:p-2 text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
              title="Share RCA Finding"
            >
              <GitBranch className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:-rotate-12" />
            </button>
            <button
              onClick={() => setShowHandoffModal(true)}
              className="group p-1.5 sm:p-2 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
              title="Shift Handoff"
            >
              <ArrowRightLeft className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
            
            {/* Divider */}
            <div className="w-px h-5 sm:h-6 bg-gray-200 dark:bg-slate-600 mx-0.5 sm:mx-1.5 flex-shrink-0" />
            
            {/* Phase 3: Smart Message Types */}
            <button
              onClick={() => openSmartComposer('question')}
              className="group p-1.5 sm:p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
              title="Ask a Question"
            >
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:rotate-12" />
            </button>
            <button
              onClick={() => openSmartComposer('update')}
              className="group p-1.5 sm:p-2 text-cyan-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
              title="Post Update"
            >
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:-translate-y-0.5" />
            </button>
            <button
              onClick={() => openSmartComposer('announcement')}
              className="group p-1.5 sm:p-2 text-fuchsia-500 hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/30 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
              title="Make Announcement"
            >
              <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:rotate-6" />
            </button>
            
            {/* Divider */}
            <div className="w-px h-5 sm:h-6 bg-gray-200 dark:bg-slate-600 mx-0.5 sm:mx-1.5 flex-shrink-0" />
            
            {/* Phase 4: Rich Content */}
            <button
              onClick={() => setShowFileUpload(true)}
              className="group p-1.5 sm:p-2 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
              title="Upload Files/Images"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:rotate-45" />
            </button>
            <button
              onClick={() => setShowVoiceRecorder(true)}
              className="group p-1.5 sm:p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
              title="Voice Message"
            >
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:scale-110" />
            </button>
            <button
              onClick={() => setShowTemplates(true)}
              className="group p-1.5 sm:p-2 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
              title="Message Templates"
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:-rotate-6" />
            </button>
          </div>
          <div className="flex items-end space-x-2">
            <MentionInput
              value={newMessage}
              onChange={handleMentionInputChange}
              onKeyDown={handleKeyDown}
              participants={participants}
              placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
              disabled={!isParticipant}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className={`group relative p-2.5 sm:p-3 mb-0.5 overflow-hidden ${
                editingMessage 
                  ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 hover:from-amber-500 hover:via-amber-600 hover:to-orange-600' 
                  : 'bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 hover:from-blue-500 hover:via-blue-600 hover:to-indigo-700'
              } text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 ease-out hover:scale-110 hover:shadow-xl hover:shadow-blue-500/30 active:scale-95 flex-shrink-0`}
            >
              {/* Animated background shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              
              {/* Pulse ring on hover */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 group-hover:animate-ping bg-white/20 pointer-events-none" style={{ animationDuration: '1s', animationIterationCount: '1' }} />
              
              {editingMessage ? (
                <Check className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 transition-transform duration-300 group-hover:scale-110" />
              ) : (
                <Send className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 transition-all duration-300 ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 group-disabled:translate-x-0 group-disabled:translate-y-0" />
              )}
            </button>
          </div>
        </div>

        {/* Message Actions Menu */}
        {activeMenuMessageId && (() => {
          const activeMessage = messages.find(m => m.id === activeMenuMessageId);
          console.log('[Chat] Rendering MessageActionsMenu - activeMenuMessageId:', activeMenuMessageId, 'activeMessage:', activeMessage?.id, 'menuPosition:', menuPosition);
          if (!activeMessage) return null;
          
          const isOwn = activeMessage.userId === currentUserId;
          const canEdit = isOwn && !activeMessage.isDeleted && 
            (new Date().getTime() - new Date(activeMessage.createdAt).getTime()) < 15 * 60 * 1000;
          
          return (
            <MessageActionsMenu
              messageId={activeMenuMessageId}
              isOwn={isOwn}
              isPinned={activeMessage.isPinned || false}
              canEdit={canEdit}
              canDelete={isOwn}
              canPin={true}
              messageType={activeMessage.messageType}
              isOpen={true}
              onOpenChange={(open) => {
                if (!open) {
                  setActiveMenuMessageId(null);
                  setMenuPosition(null);
                }
              }}
              menuPosition={menuPosition}
              isMobile={isMobileMenu}
              onReply={() => {
                setReplyTo(activeMessage as any);
                setActiveMenuMessageId(null);
                setMenuPosition(null);
              }}
              onReact={(emoji) => {
                toggleReaction(activeMenuMessageId, emoji);
              }}
              onPin={() => {
                pinMessage(activeMenuMessageId);
                setActiveMenuMessageId(null);
                setMenuPosition(null);
              }}
              onUnpin={() => {
                unpinMessage(activeMenuMessageId);
                setActiveMenuMessageId(null);
                setMenuPosition(null);
              }}
              onEdit={() => {
                startEditing(activeMessage);
                setActiveMenuMessageId(null);
                setMenuPosition(null);
              }}
              onDelete={() => {
                deleteMessage(activeMenuMessageId);
                setActiveMenuMessageId(null);
                setMenuPosition(null);
              }}
              onCopy={() => {
                copyMessage(activeMessage.content, activeMessage.id);
                setActiveMenuMessageId(null);
                setMenuPosition(null);
              }}
              onCreateAction={() => {
                handleOpenCreateAction(activeMessage.id, activeMessage.content);
              }}
              onMarkAsDecision={() => {
                markAsDecision(activeMenuMessageId);
              }}
            />
          );
        })()}

        {/* Modals */}
        <EvidencePicker
          incidentId={incidentId}
          isOpen={showEvidencePicker}
          onClose={() => setShowEvidencePicker(false)}
          onSelect={handleShareEvidence}
        />

        <RCALinkPicker
          incidentId={incidentId}
          isOpen={showRCALinkPicker}
          onClose={() => setShowRCALinkPicker(false)}
          onSelect={handleShareRCA}
        />

        {showCreateAction && actionMessageId && (
          <CreateActionFromChat
            incidentId={incidentId}
            messageId={actionMessageId}
            messageContent={actionMessageContent}
            isOpen={showCreateAction}
            onClose={() => {
              setShowCreateAction(false);
              setActionMessageId(null);
              setActionMessageContent('');
            }}
            onSuccess={handleActionCreated}
            participants={participants}
            currentUserId={currentUserId}
          />
        )}

        <HandoffMessage
          incidentId={incidentId}
          isOpen={showHandoffModal}
          onClose={() => setShowHandoffModal(false)}
          onSuccess={handleHandoffCreated}
          participants={participants}
          currentUserId={currentUserId}
        />

        {/* Phase 3: Smart Message Composer */}
        <SmartMessageComposer
          incidentId={incidentId}
          isOpen={showSmartComposer}
          onClose={() => setShowSmartComposer(false)}
          onSuccess={fetchMessages}
          type={smartComposerType}
        />

        {/* Phase 4: File Upload Modal */}
        {showFileUpload && (
          <ChatFileUpload
            incidentId={incidentId}
            onUploadComplete={handleFileUploadComplete}
            onClose={() => setShowFileUpload(false)}
          />
        )}

        {/* Phase 4: Voice Recorder Modal */}
        {showVoiceRecorder && (
          <VoiceRecorder
            incidentId={incidentId}
            onUploadComplete={handleFileUploadComplete}
            onClose={() => setShowVoiceRecorder(false)}
          />
        )}

        {/* Phase 4: Message Templates Modal */}
        {showTemplates && (
          <MessageTemplates
            onSelectTemplate={handleTemplateSelect}
            onClose={() => setShowTemplates(false)}
          />
        )}

        {/* Image Preview Modal */}
        {previewImage && (
          <div 
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
            onClick={() => setPreviewImage(null)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <div className="max-w-[90vw] max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
              <img
                src={previewImage.url}
                alt={previewImage.fileName}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
              <p className="text-white text-center mt-2 text-sm">{previewImage.fileName}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // IncidentChatPanel should only be used within ChatSidebar
  // If you see this component without a sidebar, use ChatSidebar instead
  return null;
}

