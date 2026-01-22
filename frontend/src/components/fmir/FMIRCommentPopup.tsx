'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import api from '@/lib/api';

interface Comment {
  id: string;
  content: string;
  sectionNumber: number;
  createdAt: string;
  Author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
  };
}

interface FMIRCommentPopupProps {
  isOpen: boolean;
  onClose: () => void;
  comments: Comment[];
  currentUserId: string;
  fmirId: string;
  sectionNumber: number;
  onCommentDeleted?: () => void;
  anchorPosition?: { top: number; left: number };
}

export default function FMIRCommentPopup({
  isOpen,
  onClose,
  comments,
  currentUserId,
  fmirId,
  sectionNumber,
  onCommentDeleted,
  anchorPosition,
}: FMIRCommentPopupProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Reset to first comment when popup opens or comments change
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen, comments.length]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < comments.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, comments.length, onClose]);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const handleDelete = async () => {
    const comment = comments[currentIndex];
    if (!comment) return;

    setIsDeleting(true);
    try {
      await api.delete(`/fmir/${fmirId}/comments/${comment.id}`);
      onCommentDeleted?.();
      // If this was the last comment, close the popup
      if (comments.length === 1) {
        onClose();
      } else if (currentIndex >= comments.length - 1) {
        setCurrentIndex((prev) => prev - 1);
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || comments.length === 0) return null;

  const currentComment = comments[currentIndex];
  const isOwnComment = currentComment.Author.id === currentUserId;

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 sm:w-96 transform transition-all duration-200 ease-out"
      style={{
        top: anchorPosition?.top || '50%',
        left: anchorPosition?.left || '50%',
        transform: anchorPosition ? 'translate(0, 0)' : 'translate(-50%, -50%)',
        maxHeight: 'calc(100vh - 100px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-t-xl">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Comment {currentIndex + 1} of {comments.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Author Info */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        {currentComment.Author.profilePicture ? (
          <img
            src={currentComment.Author.profilePicture}
            alt=""
            className="w-10 h-10 rounded-full object-cover border-2 border-primary-200 dark:border-primary-700"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-medium border-2 border-primary-200 dark:border-primary-700">
            {getInitials(currentComment.Author.firstName, currentComment.Author.lastName)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {isOwnComment ? 'You' : `${currentComment.Author.firstName} ${currentComment.Author.lastName}`}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {format(new Date(currentComment.createdAt), 'MMM d, yyyy • h:mm a')}
          </p>
        </div>
        {/* Delete button for own comments */}
        {isOwnComment && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            title="Delete comment"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Comment Content */}
      <div className="px-4 py-4 max-h-48 overflow-y-auto">
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
          {currentComment.content}
        </p>
      </div>

      {/* Navigation Footer */}
      {comments.length > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <button
            onClick={() => setCurrentIndex((prev) => prev - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {comments.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-primary-500 w-4'
                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentIndex((prev) => prev + 1)}
            disabled={currentIndex === comments.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
