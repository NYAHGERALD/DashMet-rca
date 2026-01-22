'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Check, Loader2, Send, User, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import api from '@/lib/api';

interface Collaborator {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
}

interface FMIRCommentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  fmirId: string;
  sectionNumber: number;
  sectionTitle: string;
  collaborators: Collaborator[];
  currentUserId: string;
  onCommentAdded?: () => void;
}

export default function FMIRCommentSidebar({
  isOpen,
  onClose,
  fmirId,
  sectionNumber,
  sectionTitle,
  collaborators,
  currentUserId,
  onCommentAdded,
}: FMIRCommentSidebarProps) {
  const [comment, setComment] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset form when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setComment('');
      setSelectedUsers([]);
      setShowUserDropdown(false);
      setSearchQuery('');
      // Focus textarea after a short delay
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

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const filteredCollaborators = collaborators.filter((collab) => {
    if (collab.id === currentUserId) return false; // Don't show current user
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
        visibleToIds: selectedUsers.length > 0 ? selectedUsers : [], // Empty array = visible to all
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
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-500 text-white shadow-lg">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Comment</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Section {sectionNumber}: {sectionTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
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
                      className="flex items-center gap-1.5 px-2 py-1 bg-primary-100 dark:bg-primary-900/40 rounded-full text-sm"
                    >
                      {user.profilePicture ? (
                        <img src={user.profilePicture} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-primary-500 text-white flex items-center justify-center text-[10px] font-medium">
                          {getInitials(user.firstName, user.lastName)}
                        </div>
                      )}
                      <span className="text-primary-700 dark:text-primary-300">{user.firstName}</span>
                      <button
                        onClick={() => toggleUserSelection(userId)}
                        className="p-0.5 hover:bg-primary-200 dark:hover:bg-primary-800 rounded-full"
                      >
                        <X className="w-3 h-3 text-primary-600 dark:text-primary-400" />
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
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {/* Search */}
                <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                      >
                        {collab.profilePicture ? (
                          <img src={collab.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-medium">
                            {getInitials(collab.firstName, collab.lastName)}
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {collab.firstName} {collab.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{collab.email}</p>
                        </div>
                        {selectedUsers.includes(collab.id) && (
                          <Check className="w-5 h-5 text-primary-500" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Comment Textarea */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Comment
            </label>
            <textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your comment here..."
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-shadow"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Press Ctrl+Enter to save
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      </div>
    </>
  );
}
