'use client';

import React, { useState } from 'react';
import {
  Gavel,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  TrendingUp,
  AlertTriangle,
  Flag,
  RotateCcw,
  MessageSquare,
  Clock,
  Pin,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';

interface SmartMessageRendererProps {
  message: {
    id: string;
    content: string;
    messageType: string;
    userId: string;
    isPinned?: boolean;
    pinnedAt?: string | null;
    decisionData?: {
      decidedBy: string;
      decidedAt: string;
      rationale?: string;
    };
    questionData?: {
      isResolved: boolean;
      askedBy: string;
      askedAt: string;
      resolvedBy?: string;
      resolvedAt?: string;
      resolvedByUser?: {
        id: string;
        firstName: string;
        lastName: string;
      };
      reopenedBy?: string;
      reopenedAt?: string;
      reopenedByUser?: {
        id: string;
        firstName: string;
        lastName: string;
      };
      answer?: string;
    };
    updateData?: {
      category: 'progress' | 'blocker' | 'milestone' | 'general';
      priority: 'low' | 'normal' | 'high';
      postedBy: string;
      postedAt: string;
    };
    announcementData?: {
      priority: 'normal' | 'important' | 'urgent';
      postedBy: string;
      postedAt: string;
      expiresAt?: string;
    };
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
    createdAt: string;
  };
  incidentId: string;
  currentUserId: string;
  onMessageUpdate?: () => void;
}

// Decision Message Component
export function DecisionMessage({
  message,
  isOwn,
}: {
  message: SmartMessageRendererProps['message'];
  isOwn: boolean;
}) {
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Pinned indicator */}
      {message.isPinned && (
        <div className="flex items-center gap-1 mb-1 justify-center text-xs text-amber-600 dark:text-amber-400">
          <Pin className="w-3 h-3" />
          <span className="font-medium">Pinned</span>
        </div>
      )}
      <div className={`bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20 rounded-lg border-2 border-purple-300 dark:border-purple-600 overflow-hidden ${message.isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}>
        {/* Header */}
        <div className="flex items-center space-x-2 px-4 py-2 bg-purple-500/20 dark:bg-purple-500/30 border-b border-purple-300 dark:border-purple-600">
          <Gavel className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
            Decision
          </span>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-800 dark:text-gray-100 font-medium leading-relaxed">
            {message.content}
          </p>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <span>Decided by</span>
              <span className="font-medium text-purple-600 dark:text-purple-400">
                {message.user.firstName} {message.user.lastName}
              </span>
            </div>
            <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Question Message Component
export function QuestionMessage({
  message,
  incidentId,
  currentUserId,
  onMessageUpdate,
}: {
  message: SmartMessageRendererProps['message'];
  incidentId: string;
  currentUserId: string;
  onMessageUpdate?: () => void;
}) {
  const [isResolving, setIsResolving] = useState(false);
  const [answer, setAnswer] = useState('');
  const [showAnswerInput, setShowAnswerInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const questionData = message.questionData;
  const isResolved = questionData?.isResolved;

  const handleResolve = async () => {
    setLoading(true);
    try {
      await api.post(`/chat/${incidentId}/messages/${message.id}/resolve-question`, {
        answer: answer.trim() || undefined,
      });
      setShowAnswerInput(false);
      setAnswer('');
      onMessageUpdate?.();
    } catch (error) {
      console.error('Failed to resolve question:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    setLoading(true);
    try {
      await api.post(`/chat/${incidentId}/messages/${message.id}/reopen-question`);
      onMessageUpdate?.();
    } catch (error) {
      console.error('Failed to reopen question:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Pinned indicator */}
      {message.isPinned && (
        <div className="flex items-center gap-1 mb-1 justify-center text-xs text-amber-600 dark:text-amber-400">
          <Pin className="w-3 h-3" />
          <span className="font-medium">Pinned</span>
        </div>
      )}
      <div
        className={`rounded-lg border-2 overflow-hidden ${
          isResolved
            ? 'bg-green-50/50 dark:bg-green-900/20 border-green-300 dark:border-green-600'
            : 'bg-amber-50/50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600'
        } ${message.isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-2 border-b ${
            isResolved
              ? 'bg-green-100/50 dark:bg-green-800/30 border-green-300 dark:border-green-600'
              : 'bg-amber-100/50 dark:bg-amber-800/30 border-amber-300 dark:border-amber-600'
          }`}
        >
          <div className="flex items-center space-x-2">
            {isResolved ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            )}
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                isResolved
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {isResolved ? 'Resolved Question' : 'Open Question'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-800 dark:text-gray-100 font-medium leading-relaxed">
            {message.content}
          </p>

          {/* Answer (if resolved) */}
          {isResolved && questionData?.answer && (
            <div className="mt-3 p-3 bg-green-100/50 dark:bg-green-800/30 rounded-lg">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Answer:</p>
              <p className="text-sm text-gray-700 dark:text-gray-200">{questionData.answer}</p>
            </div>
          )}

          {/* Answer input */}
          {showAnswerInput && (
            <div className="mt-3 space-y-2">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Add an answer (optional)..."
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                rows={2}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowAnswerInput(false)}
                  className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={loading}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Resolving...' : 'Mark Resolved'}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!showAnswerInput && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex flex-col space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Asked by{' '}
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {message.user.firstName} {message.user.lastName}
                    </span>
                  </span>
                  {isResolved && questionData?.resolvedByUser && (
                    <span className="text-green-600 dark:text-green-400">
                      ✓ Resolved by{' '}
                      <span className="font-medium">
                        {questionData.resolvedByUser.firstName} {questionData.resolvedByUser.lastName}
                      </span>
                      {questionData.resolvedAt && (
                        <span className="text-gray-400 dark:text-gray-500">
                          {' '}
                          · {formatDistanceToNow(new Date(questionData.resolvedAt), { addSuffix: true })}
                        </span>
                      )}
                    </span>
                  )}
                  {!isResolved && questionData?.reopenedByUser && (
                    <span className="text-amber-600 dark:text-amber-400">
                      ↺ Reopened by{' '}
                      <span className="font-medium">
                        {questionData.reopenedByUser.firstName} {questionData.reopenedByUser.lastName}
                      </span>
                      {questionData.reopenedAt && (
                        <span className="text-gray-400 dark:text-gray-500">
                          {' '}
                          · {formatDistanceToNow(new Date(questionData.reopenedAt), { addSuffix: true })}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {isResolved ? (
                  <button
                    onClick={handleReopen}
                    disabled={loading}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reopen</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAnswerInput(true)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-800/50 dark:text-green-300 dark:hover:bg-green-800"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Resolve</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Update Message Component
export function UpdateMessage({ message }: { message: SmartMessageRendererProps['message'] }) {
  const updateData = message.updateData;
  const category = updateData?.category || 'general';
  const priority = updateData?.priority || 'normal';

  const categoryConfig = {
    progress: {
      icon: TrendingUp,
      color: 'blue',
      label: 'Progress Update',
    },
    blocker: {
      icon: AlertTriangle,
      color: 'red',
      label: 'Blocker',
    },
    milestone: {
      icon: Flag,
      color: 'green',
      label: 'Milestone',
    },
    general: {
      icon: MessageSquare,
      color: 'gray',
      label: 'Update',
    },
  };

  const config = categoryConfig[category] || categoryConfig.general;
  const Icon = config.icon;

  const colorClasses = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-300 dark:border-blue-600',
      header: 'bg-blue-100/50 dark:bg-blue-800/30',
      icon: 'text-blue-600 dark:text-blue-400',
      text: 'text-blue-700 dark:text-blue-300',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-300 dark:border-red-600',
      header: 'bg-red-100/50 dark:bg-red-800/30',
      icon: 'text-red-600 dark:text-red-400',
      text: 'text-red-700 dark:text-red-300',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-300 dark:border-green-600',
      header: 'bg-green-100/50 dark:bg-green-800/30',
      icon: 'text-green-600 dark:text-green-400',
      text: 'text-green-700 dark:text-green-300',
    },
    gray: {
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      border: 'border-gray-300 dark:border-gray-600',
      header: 'bg-gray-100/50 dark:bg-gray-800/30',
      icon: 'text-gray-600 dark:text-gray-400',
      text: 'text-gray-700 dark:text-gray-300',
    },
  };

  const colors = colorClasses[config.color as keyof typeof colorClasses];

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Pinned indicator */}
      {message.isPinned && (
        <div className="flex items-center gap-1 mb-1 justify-center text-xs text-amber-600 dark:text-amber-400">
          <Pin className="w-3 h-3" />
          <span className="font-medium">Pinned</span>
        </div>
      )}
      <div className={`rounded-lg border-2 overflow-hidden ${colors.bg} ${colors.border} ${message.isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}>
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-2 border-b ${colors.header} ${colors.border}`}
        >
          <div className="flex items-center space-x-2">
            <Icon className={`w-4 h-4 ${colors.icon}`} />
            <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
              {config.label}
            </span>
          </div>
          {priority === 'high' && (
            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-300 rounded-full">
              High Priority
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">{message.content}</p>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>
              {message.user.firstName} {message.user.lastName}
            </span>
            <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Announcement Message Component
export function AnnouncementMessage({
  message,
}: {
  message: SmartMessageRendererProps['message'];
}) {
  const announcementData = message.announcementData;
  const priority = announcementData?.priority || 'normal';
  const expiresAt = announcementData?.expiresAt;

  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  const priorityConfig = {
    normal: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-400 dark:border-blue-500',
      header: 'bg-blue-100 dark:bg-blue-800/40',
      icon: 'text-blue-600 dark:text-blue-400',
      text: 'text-blue-800 dark:text-blue-200',
    },
    important: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-400 dark:border-amber-500',
      header: 'bg-amber-100 dark:bg-amber-800/40',
      icon: 'text-amber-600 dark:text-amber-400',
      text: 'text-amber-800 dark:text-amber-200',
    },
    urgent: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-400 dark:border-red-500',
      header: 'bg-red-100 dark:bg-red-800/40',
      icon: 'text-red-600 dark:text-red-400',
      text: 'text-red-800 dark:text-red-200',
    },
  };

  const config = priorityConfig[priority] || priorityConfig.normal;

  return (
    <div className={`w-full max-w-lg mx-auto ${isExpired ? 'opacity-60' : ''}`}>
      {/* Pinned indicator */}
      {message.isPinned && (
        <div className="flex items-center gap-1 mb-1 justify-center text-xs text-amber-600 dark:text-amber-400">
          <Pin className="w-3 h-3" />
          <span className="font-medium">Pinned</span>
        </div>
      )}
      <div className={`rounded-lg border-2 overflow-hidden ${config.bg} ${config.border} ${message.isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 ${config.header} border-b ${config.border}`}>
          <div className="flex items-center space-x-2">
            <Megaphone className={`w-4 h-4 ${config.icon}`} />
            <span className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>
              {priority === 'urgent' ? '🚨 URGENT ANNOUNCEMENT' : priority === 'important' ? '⚠️ IMPORTANT' : 'ANNOUNCEMENT'}
            </span>
          </div>
          {isExpired && (
            <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full">
              Expired
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <p className={`text-sm font-medium leading-relaxed ${config.text}`}>{message.content}</p>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>
              Posted by {message.user.firstName} {message.user.lastName}
            </span>
            <div className="flex items-center space-x-2">
              {expiresAt && !isExpired && (
                <span className="flex items-center space-x-1 text-amber-600 dark:text-amber-400">
                  <Clock className="w-3 h-3" />
                  <span>Expires {formatDistanceToNow(new Date(expiresAt), { addSuffix: true })}</span>
                </span>
              )}
              <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Smart Message Renderer
export default function SmartMessageRenderer({
  message,
  incidentId,
  currentUserId,
  onMessageUpdate,
}: SmartMessageRendererProps) {
  const isOwn = message.userId === currentUserId;

  switch (message.messageType) {
    case 'DECISION':
      return <DecisionMessage message={message} isOwn={isOwn} />;
    case 'QUESTION':
      return (
        <QuestionMessage
          message={message}
          incidentId={incidentId}
          currentUserId={currentUserId}
          onMessageUpdate={onMessageUpdate}
        />
      );
    case 'UPDATE':
      return <UpdateMessage message={message} />;
    case 'ANNOUNCEMENT':
      return <AnnouncementMessage message={message} />;
    default:
      return null;
  }
}
