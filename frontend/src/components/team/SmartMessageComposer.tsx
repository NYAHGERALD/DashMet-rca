'use client';

import React, { useState } from 'react';
import {
  X,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  Flag,
  MessageSquare,
  Megaphone,
  Send,
} from 'lucide-react';
import api from '@/lib/api';

interface SmartMessageComposerProps {
  incidentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'question' | 'update' | 'announcement';
}

export default function SmartMessageComposer({
  incidentId,
  isOpen,
  onClose,
  onSuccess,
  type,
}: SmartMessageComposerProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'progress' | 'blocker' | 'milestone' | 'general'>('progress');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const config = {
    question: {
      title: 'Ask a Question',
      icon: HelpCircle,
      color: 'amber',
      placeholder: 'Ask a question that needs team input or clarification...',
      description: 'Questions are tracked separately and can be marked as resolved when answered.',
    },
    update: {
      title: 'Post an Update',
      icon: TrendingUp,
      color: 'blue',
      placeholder: 'Share a progress update, blocker, or milestone...',
      description: 'Updates are highlighted and help track progress throughout the incident.',
    },
    announcement: {
      title: 'Make an Announcement',
      icon: Megaphone,
      color: 'purple',
      placeholder: 'Write an important announcement for the team...',
      description: 'Announcements are prominently displayed and notify all team members.',
    },
  };

  const currentConfig = config[type];
  const Icon = currentConfig.icon;

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let endpoint = '';
      let payload: any = { content: content.trim() };

      switch (type) {
        case 'question':
          endpoint = `/chat/${incidentId}/messages/question`;
          break;
        case 'update':
          endpoint = `/chat/${incidentId}/messages/update`;
          payload.category = category;
          payload.priority = priority;
          break;
        case 'announcement':
          endpoint = `/chat/${incidentId}/messages/announcement`;
          payload.priority = announcementPriority;
          break;
      }

      await api.post(endpoint, payload);
      setContent('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to post message');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div
            className={`flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r ${
              type === 'question'
                ? 'from-amber-500 to-orange-500'
                : type === 'update'
                ? 'from-blue-500 to-cyan-500'
                : 'from-purple-500 to-pink-500'
            }`}
          >
            <div className="flex items-center space-x-2 text-white">
              <Icon className="w-5 h-5" />
              <h3 className="font-semibold">{currentConfig.title}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{currentConfig.description}</p>

            {/* Update Category Selector */}
            {type === 'update' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Update Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'progress', label: 'Progress', icon: TrendingUp, color: 'blue' },
                    { value: 'blocker', label: 'Blocker', icon: AlertTriangle, color: 'red' },
                    { value: 'milestone', label: 'Milestone', icon: Flag, color: 'green' },
                    { value: 'general', label: 'General', icon: MessageSquare, color: 'gray' },
                  ].map((opt) => {
                    const OptIcon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setCategory(opt.value as any)}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all ${
                          category === opt.value
                            ? `border-${opt.color}-500 bg-${opt.color}-50 dark:bg-${opt.color}-900/30`
                            : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                      >
                        <OptIcon
                          className={`w-4 h-4 ${
                            category === opt.value
                              ? `text-${opt.color}-600 dark:text-${opt.color}-400`
                              : 'text-gray-400'
                          }`}
                        />
                        <span
                          className={`text-sm ${
                            category === opt.value
                              ? 'text-gray-800 dark:text-gray-100 font-medium'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Update Priority Selector */}
            {type === 'update' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Priority
                </label>
                <div className="flex space-x-2">
                  {['low', 'normal', 'high'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p as any)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all capitalize ${
                        priority === p
                          ? p === 'high'
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : p === 'low'
                            ? 'border-gray-400 bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-slate-500'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Announcement Priority Selector */}
            {type === 'announcement' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Announcement Priority
                </label>
                <div className="flex space-x-2">
                  {[
                    { value: 'normal', label: 'Normal', desc: 'Standard notification' },
                    { value: 'important', label: 'Important', desc: 'Highlighted message' },
                    { value: 'urgent', label: 'Urgent', desc: 'Immediate attention' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAnnouncementPriority(opt.value as any)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all ${
                        announcementPriority === opt.value
                          ? opt.value === 'urgent'
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : opt.value === 'important'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-slate-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {type === 'question' ? 'Your Question' : type === 'update' ? 'Update Details' : 'Announcement'}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={currentConfig.placeholder}
                className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
                rows={4}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 px-5 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !content.trim()}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                type === 'question'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : type === 'update'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Posting...' : 'Post'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
