'use client';

import { useState } from 'react';
import { formatRelativeDateTime } from '@/lib/dateUtils';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface CommentPanelProps {
  comments: Comment[];
  onAddComment: (content: string) => Promise<void>;
}

export default function CommentPanel({ comments, onAddComment }: CommentPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onAddComment(newComment.trim());
      setNewComment('');
    } finally {
      setSubmitting(false);
    }
  };

  // Use centralized date formatting with proper timezone handling
  const formatDate = (dateString: string) => formatRelativeDateTime(dateString);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getAvatarColor = (userId: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-orange-500',
    ];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex flex-col h-96">
      {/* Comments List */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No comments yet. Be the first to comment!
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex items-start space-x-3">
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(
                  comment.user.id
                )}`}
              >
                {getInitials(comment.user.firstName, comment.user.lastName)}
              </div>

              {/* Comment Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {comment.user.firstName} {comment.user.lastName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-600 pt-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Posting...
                  </span>
                ) : (
                  'Post Comment'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
