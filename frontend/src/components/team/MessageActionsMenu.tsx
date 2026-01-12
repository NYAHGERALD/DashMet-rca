'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreHorizontal,
  Reply,
  Edit,
  Trash2,
  Pin,
  PinOff,
  Copy,
  Smile,
  X,
  ListChecks,
  Gavel,
} from 'lucide-react';
import { QuickReactionBar } from './EmojiPicker';

interface MenuPosition {
  x: number;
  y: number;
}

interface MessageActionsMenuProps {
  messageId: string;
  isOwn: boolean;
  isPinned: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  messageType?: string;
  onReply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onCopy: () => void;
  onReact: (emoji: string) => void;
  onCreateAction?: () => void;
  onMarkAsDecision?: () => void;
  position?: 'left' | 'right';
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile?: boolean;
  menuPosition?: MenuPosition | null;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export default function MessageActionsMenu({
  messageId,
  isOwn,
  isPinned,
  canEdit,
  canDelete,
  canPin,
  messageType,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onCopy,
  onReact,
  onCreateAction,
  onMarkAsDecision,
  position = 'left',
  isOpen,
  onOpenChange,
  isMobile = false,
  menuPosition = null,
  containerRef,
}: MessageActionsMenuProps) {
  console.log('[MessageActionsMenu] Rendering - isOpen:', isOpen, 'isMobile:', isMobile, 'menuPosition:', menuPosition);
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<MenuPosition | null>(null);

  // Adjust menu position to stay within viewport bounds
  useEffect(() => {
    if (!isOpen || isMobile || !menuPosition) {
      setAdjustedPosition(null);
      return;
    }

    // Calculate adjusted position based on viewport
    const menuWidth = 220; // Approximate menu width (slightly larger to be safe)
    const menuHeight = 350; // Approximate menu height
    const padding = 16; // Increased padding from edges

    let x = menuPosition.x;
    let y = menuPosition.y;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust horizontal position - if menu would overflow right edge, position to the LEFT of click point
    if (x + menuWidth > viewportWidth - padding) {
      x = Math.max(padding, menuPosition.x - menuWidth - 5);
    }
    // Ensure it doesn't go off the left edge
    if (x < padding) {
      x = padding;
    }

    // Adjust vertical position - if menu would overflow bottom, show above cursor
    if (y + menuHeight > viewportHeight - padding) {
      y = Math.max(padding, y - menuHeight);
    }
    // Ensure it doesn't go off the top
    if (y < padding) {
      y = padding;
    }

    setAdjustedPosition({ x, y });
  }, [isOpen, isMobile, menuPosition]);

  // Re-adjust when menu actually renders and we know exact size
  useEffect(() => {
    if (!isOpen || isMobile || !menuPosition || !menuRef.current) {
      return;
    }

    // Wait for next frame to get actual menu dimensions
    requestAnimationFrame(() => {
      if (!menuRef.current) return;
      
      const menuRect = menuRef.current.getBoundingClientRect();
      const padding = 16;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = menuPosition.x;
      let y = menuPosition.y;

      // Adjust horizontal - if menu would overflow right edge, show to the LEFT of click point
      if (x + menuRect.width > viewportWidth - padding) {
        x = Math.max(padding, menuPosition.x - menuRect.width - 5);
      }
      if (x < padding) {
        x = padding;
      }

      // Adjust vertical - if overflowing bottom, position above click point
      if (y + menuRect.height > viewportHeight - padding) {
        y = Math.max(padding, menuPosition.y - menuRect.height);
      }
      if (y < padding) {
        y = padding;
      }

      setAdjustedPosition({ x, y });
    });
  }, [isOpen, isMobile, menuPosition]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onOpenChange]);

  const handleAction = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  const handleReact = (emoji: string) => {
    onReact(emoji);
    onOpenChange(false);
  };

  if (!isOpen) {
    console.log('[MessageActionsMenu] Not rendering - isOpen is false');
    return null;
  }

  // Check if we're in browser environment for portal
  if (typeof document === 'undefined') {
    return null;
  }

  // Desktop context menu style
  if (!isMobile) {
    // Use menuPosition if available, otherwise default to center of screen
    const pos = adjustedPosition || menuPosition || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    console.log('[MessageActionsMenu] Rendering desktop menu at position:', pos);
    
    const menuContent = (
      <>
        {/* Backdrop - transparent for desktop with fade animation */}
        <div 
          className="fixed inset-0 z-[9998] animate-backdrop"
          onClick={() => onOpenChange(false)}
        />
        
        {/* Context Menu with smooth entrance animation */}
        <div
          ref={menuRef}
          className="fixed bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-600 z-[9999] min-w-[200px] py-1.5 animate-context-menu backdrop-blur-sm"
          style={{ 
            left: pos.x,
            top: pos.y,
            maxHeight: '320px',
            overflowY: 'auto'
          }}
        >
          {/* Quick Reactions Row with stagger animation */}
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center justify-center space-x-0.5">
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji, index) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-all duration-200 text-xl hover:scale-125 active:scale-95"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons with smooth hover transitions */}
          <button
            onClick={() => handleAction(onReply)}
            className="context-menu-item w-full flex items-center px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 transition-all duration-150"
            style={{ animationDelay: '40ms' }}
          >
            <Reply className="w-4 h-4 mr-3 text-blue-500" />
            Reply
          </button>

          <button
            onClick={() => handleAction(onCopy)}
            className="context-menu-item w-full flex items-center px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 transition-all duration-150"
            style={{ animationDelay: '60ms' }}
          >
            <Copy className="w-4 h-4 mr-3 text-gray-500" />
            Copy text
          </button>

          {isOwn && canEdit && onEdit && (
            <button
              onClick={() => handleAction(onEdit)}
              className="context-menu-item w-full flex items-center px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 transition-all duration-150"
              style={{ animationDelay: '80ms' }}
            >
              <Edit className="w-4 h-4 mr-3 text-amber-500" />
              Edit
            </button>
          )}

          {canPin && (
            isPinned ? (
              <button
                onClick={() => handleAction(onUnpin!)}
                className="context-menu-item w-full flex items-center px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 transition-all duration-150"
                style={{ animationDelay: '100ms' }}
              >
                <PinOff className="w-4 h-4 mr-3 text-amber-500" />
                Unpin
              </button>
            ) : (
              <button
                onClick={() => handleAction(onPin!)}
                className="context-menu-item w-full flex items-center px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 transition-all duration-150"
                style={{ animationDelay: '100ms' }}
              >
                <Pin className="w-4 h-4 mr-3 text-amber-500" />
                Pin
              </button>
            )
          )}

          {onCreateAction && (
            <button
              onClick={() => handleAction(onCreateAction)}
              className="context-menu-item w-full flex items-center px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 transition-all duration-150"
              style={{ animationDelay: '120ms' }}
            >
              <ListChecks className="w-4 h-4 mr-3 text-green-500" />
              Create Action
            </button>
          )}

          {onMarkAsDecision && messageType === 'TEXT' && (
            <button
              onClick={() => handleAction(onMarkAsDecision)}
              className="context-menu-item w-full flex items-center px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 transition-all duration-150"
              style={{ animationDelay: '150ms' }}
            >
              <Gavel className="w-4 h-4 mr-3 text-purple-500" />
              Mark as Decision
            </button>
          )}

          {canDelete && onDelete && (
            <>
              <div className="border-t border-gray-100/80 dark:border-slate-700/80 my-1.5" />
              <button
                onClick={() => handleAction(onDelete)}
                className="context-menu-item w-full flex items-center px-3 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-150"
                style={{ animationDelay: '180ms' }}
              >
                <Trash2 className="w-4 h-4 mr-3" />
                Delete
              </button>
            </>
          )}
        </div>
      </>
    );
    
    // Use portal to render at document body level
    return createPortal(menuContent, document.body);
  }

  // Mobile bottom sheet style
  const mobileContent = (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/30 dark:bg-black/50 z-[9998] animate-backdrop backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Actions Menu - Bottom sheet style */}
      <div
        ref={menuRef}
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl z-[9999] animate-bottom-sheet"
        style={{ maxHeight: '70vh' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Quick Reactions */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-medium uppercase tracking-wide">React</p>
          <QuickReactionBar onSelect={handleReact} showAll />
        </div>

        {/* Action buttons */}
        <div className="px-3 py-2">
          {/* Reply */}
          <button
            onClick={() => handleAction(onReply)}
            className="w-full flex items-center px-4 py-3.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 rounded-xl transition-all duration-200 active:scale-[0.98]"
          >
            <Reply className="w-5 h-5 mr-4 text-blue-500" />
            <span className="font-medium">Reply</span>
          </button>

          {/* Copy */}
          <button
            onClick={() => handleAction(onCopy)}
            className="w-full flex items-center px-4 py-3.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 rounded-xl transition-all duration-200 active:scale-[0.98]"
          >
            <Copy className="w-5 h-5 mr-4 text-gray-500" />
            <span className="font-medium">Copy text</span>
          </button>

          {/* Edit (own messages only, within time limit) */}
          {isOwn && canEdit && onEdit && (
            <button
              onClick={() => handleAction(onEdit)}
              className="w-full flex items-center px-4 py-3.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              <Edit className="w-5 h-5 mr-4 text-amber-500" />
              <span className="font-medium">Edit message</span>
            </button>
          )}

          {/* Pin/Unpin */}
          {canPin && (
            isPinned ? (
              <button
                onClick={() => handleAction(onUnpin!)}
                className="w-full flex items-center px-4 py-3.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 rounded-xl transition-all duration-200 active:scale-[0.98]"
              >
                <PinOff className="w-5 h-5 mr-4 text-amber-500" />
                <span className="font-medium">Unpin message</span>
              </button>
            ) : (
              <button
                onClick={() => handleAction(onPin!)}
                className="w-full flex items-center px-4 py-3.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 rounded-xl transition-all duration-200 active:scale-[0.98]"
              >
                <Pin className="w-5 h-5 mr-4 text-amber-500" />
                <span className="font-medium">Pin message</span>
              </button>
            )
          )}

          {/* Create Action */}
          {onCreateAction && (
            <button
              onClick={() => handleAction(onCreateAction)}
              className="w-full flex items-center px-4 py-3.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              <ListChecks className="w-5 h-5 mr-4 text-green-500" />
              <span className="font-medium">Create Action Item</span>
            </button>
          )}

          {/* Mark as Decision */}
          {onMarkAsDecision && messageType === 'TEXT' && (
            <button
              onClick={() => handleAction(onMarkAsDecision)}
              className="w-full flex items-center px-4 py-3.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/70 rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              <Gavel className="w-5 h-5 mr-4 text-purple-500" />
              <span className="font-medium">Mark as Decision</span>
            </button>
          )}

          {/* Delete */}
          {canDelete && onDelete && (
            <>
              <div className="border-t border-gray-100/80 dark:border-slate-700/80 my-2 mx-2" />
              <button
                onClick={() => handleAction(onDelete)}
                className="w-full flex items-center px-4 py-3.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all duration-200 active:scale-[0.98]"
              >
                <Trash2 className="w-5 h-5 mr-4" />
                <span className="font-medium">Delete message</span>
              </button>
            </>
          )}
        </div>

        {/* Safe area padding for mobile */}
        <div className="h-8" />
      </div>
    </>
  );
  
  // Use portal to render at document body level
  return createPortal(mobileContent, document.body);
}

// Pinned messages section component
interface PinnedMessage {
  id: string;
  content: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    role?: string;
    isOnline?: boolean;
  };
  pinnedAt?: string | null;
  createdAt: string;
  // Allow other properties from ChatMessage
  [key: string]: any;
}

interface PinnedMessagesSectionProps {
  messages: PinnedMessage[];
  onJumpToMessage: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  canUnpin: boolean;
}

export function PinnedMessagesSection({
  messages,
  onJumpToMessage,
  onUnpin,
  canUnpin,
}: PinnedMessagesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!messages || messages.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Pin className="w-4 h-4" />
          <span className="font-medium">
            {messages.length} Pinned {messages.length === 1 ? 'message' : 'messages'}
          </span>
        </div>
        <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="max-h-40 overflow-y-auto px-4 pb-2 space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start justify-between bg-white dark:bg-slate-800 rounded-lg p-2 border border-amber-200 dark:border-amber-800"
            >
              <button
                onClick={() => onJumpToMessage(msg.id)}
                className="flex-1 text-left"
              >
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {msg.user.firstName} {msg.user.lastName}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2">
                  {msg.content}
                </p>
              </button>
              {canUnpin && (
                <button
                  onClick={() => onUnpin(msg.id)}
                  className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Unpin"
                >
                  <PinOff className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
