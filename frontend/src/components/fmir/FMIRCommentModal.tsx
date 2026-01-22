'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Check, Loader2, Send, MessageSquare, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';
import api from '@/lib/api';

interface Collaborator {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
}

interface FMIRCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  fmirId: string;
  sectionNumber: number;
  sectionTitle: string;
  collaborators: Collaborator[];
  currentUserId: string;
  onCommentAdded?: () => void;
}

interface ModalPosition {
  x: number;
  y: number;
}

interface ModalSize {
  width: number;
  height: number;
}

const MIN_WIDTH = 360;
const MIN_HEIGHT = 400;
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 520;

export default function FMIRCommentModal({
  isOpen,
  onClose,
  fmirId,
  sectionNumber,
  sectionTitle,
  collaborators,
  currentUserId,
  onCommentAdded,
}: FMIRCommentModalProps) {
  const [comment, setComment] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  
  const [position, setPosition] = useState<ModalPosition>({ x: 0, y: 0 });
  const [size, setSize] = useState<ModalSize>({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [preMaximizeState, setPreMaximizeState] = useState<{ position: ModalPosition; size: ModalSize } | null>(null);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; width: number; height: number; posX: number; posY: number }>({ mouseX: 0, mouseY: 0, width: 0, height: 0, posX: 0, posY: 0 });

  // Center modal on open
  useEffect(() => {
    if (isOpen) {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      setPosition({
        x: (windowWidth - DEFAULT_WIDTH) / 2,
        y: (windowHeight - DEFAULT_HEIGHT) / 2,
      });
      setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
      setComment('');
      setSelectedUsers([]);
      setShowUserDropdown(false);
      setSearchQuery('');
      setIsMaximized(false);
      setPreMaximizeState(null);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  // Dragging handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [isMaximized, position]);

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;
    
    const newX = Math.max(0, Math.min(window.innerWidth - size.width, dragStartRef.current.posX + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, dragStartRef.current.posY + deltaY));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging, size.width]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Resizing handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
  }, [isMaximized, size, position]);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeDirection) return;
    
    const deltaX = e.clientX - resizeStartRef.current.mouseX;
    const deltaY = e.clientY - resizeStartRef.current.mouseY;
    
    let newWidth = resizeStartRef.current.width;
    let newHeight = resizeStartRef.current.height;
    let newX = resizeStartRef.current.posX;
    let newY = resizeStartRef.current.posY;
    
    if (resizeDirection.includes('e')) {
      newWidth = Math.max(MIN_WIDTH, resizeStartRef.current.width + deltaX);
    }
    if (resizeDirection.includes('w')) {
      const potentialWidth = resizeStartRef.current.width - deltaX;
      if (potentialWidth >= MIN_WIDTH) {
        newWidth = potentialWidth;
        newX = resizeStartRef.current.posX + deltaX;
      }
    }
    if (resizeDirection.includes('s')) {
      newHeight = Math.max(MIN_HEIGHT, resizeStartRef.current.height + deltaY);
    }
    if (resizeDirection.includes('n')) {
      const potentialHeight = resizeStartRef.current.height - deltaY;
      if (potentialHeight >= MIN_HEIGHT) {
        newHeight = potentialHeight;
        newY = resizeStartRef.current.posY + deltaY;
      }
    }
    
    setSize({ width: newWidth, height: newHeight });
    setPosition({ x: newX, y: newY });
  }, [isResizing, resizeDirection]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDirection(null);
  }, []);

  // Mouse event listeners for drag and resize
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDrag, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResize, handleResizeEnd]);

  const toggleMaximize = () => {
    if (isMaximized) {
      if (preMaximizeState) {
        setPosition(preMaximizeState.position);
        setSize(preMaximizeState.size);
      }
      setIsMaximized(false);
    } else {
      setPreMaximizeState({ position, size });
      setPosition({ x: 20, y: 20 });
      setSize({ width: window.innerWidth - 40, height: window.innerHeight - 40 });
      setIsMaximized(true);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const filteredCollaborators = collaborators.filter((collab) => {
    if (collab.id === currentUserId) return false;
    const fullName = `${collab.firstName} ${collab.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || collab.email.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveComment = async () => {
    if (!comment.trim()) return;

    setIsSaving(true);
    try {
      await api.post(`/fmir/${fmirId}/comments`, {
        sectionNumber,
        content: comment.trim(),
        visibleToIds: selectedUsers.length > 0 ? selectedUsers : [],
      });

      setComment('');
      setSelectedUsers([]);
      onCommentAdded?.();
      onClose();
    } catch (error) {
      console.error('Failed to save comment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSaveComment();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`fixed z-50 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-shadow ${
          isDragging || isResizing ? 'shadow-3xl' : ''
        }`}
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        {/* Header - Draggable */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center justify-center text-gray-400 dark:text-gray-500">
              <GripHorizontal className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">Add Comment</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">Section {sectionNumber}: {sectionTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); toggleMaximize(); }}
              className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Select Users to View */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Visible To
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                (Leave empty for all collaborators)
              </span>
            </label>

            {/* Selected Users Display */}
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedUsers.length === 0 ? (
                <span className="text-sm text-gray-500 dark:text-gray-400 italic">All collaborators can view</span>
              ) : (
                selectedUsers.map((userId) => {
                  const user = collaborators.find((c) => c.id === userId);
                  if (!user) return null;
                  return (
                    <div
                      key={userId}
                      className="flex items-center gap-1.5 px-2 py-1 bg-teal-100 dark:bg-teal-900/40 rounded-full text-sm"
                    >
                      {user.profilePicture ? (
                        <img src={user.profilePicture} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center text-[10px] font-medium">
                          {getInitials(user.firstName, user.lastName)}
                        </div>
                      )}
                      <span className="text-teal-700 dark:text-teal-300">{user.firstName}</span>
                      <button
                        onClick={() => toggleUserSelection(userId)}
                        className="p-0.5 hover:bg-teal-200 dark:hover:bg-teal-800 rounded-full"
                      >
                        <X className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dropdown Toggle */}
            <button
              type="button"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Select specific users...
              </span>
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {/* Search */}
                <div className="p-2 border-b border-gray-200 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-700">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* User List */}
                <div className="py-1">
                  {filteredCollaborators.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No collaborators found
                    </div>
                  ) : (
                    filteredCollaborators.map((collab) => (
                      <button
                        key={collab.id}
                        onClick={() => toggleUserSelection(collab.id)}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
                      >
                        {collab.profilePicture ? (
                          <img src={collab.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-medium">
                            {getInitials(collab.firstName, collab.lastName)}
                          </div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {collab.firstName} {collab.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{collab.email}</p>
                        </div>
                        {selectedUsers.includes(collab.id) && (
                          <Check className="w-5 h-5 text-teal-500 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Comment Textarea */}
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Comment
            </label>
            <textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your comment here..."
              className="flex-1 min-h-[120px] w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none transition-shadow"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Press Ctrl+Enter to save
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveComment}
              disabled={!comment.trim() || isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Save Comment
            </button>
          </div>
        </div>

        {/* Resize Handles */}
        {!isMaximized && (
          <>
            {/* Corners */}
            <div
              className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize"
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
            <div
              className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize"
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            <div
              className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize"
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
              onMouseDown={(e) => handleResizeStart(e, 'se')}
            >
              <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400 dark:border-gray-500 group-hover:border-teal-500 transition-colors" />
            </div>
            
            {/* Edges */}
            <div
              className="absolute top-0 left-4 right-4 h-1 cursor-n-resize"
              onMouseDown={(e) => handleResizeStart(e, 'n')}
            />
            <div
              className="absolute bottom-0 left-4 right-4 h-1 cursor-s-resize"
              onMouseDown={(e) => handleResizeStart(e, 's')}
            />
            <div
              className="absolute left-0 top-4 bottom-4 w-1 cursor-w-resize"
              onMouseDown={(e) => handleResizeStart(e, 'w')}
            />
            <div
              className="absolute right-0 top-4 bottom-4 w-1 cursor-e-resize"
              onMouseDown={(e) => handleResizeStart(e, 'e')}
            />
          </>
        )}
      </div>
    </>
  );
}
