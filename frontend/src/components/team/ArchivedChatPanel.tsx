'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { formatDateTime, formatTime } from '@/lib/dateUtils';
import { Archive, Clock, User, ChevronDown, ChevronRight, MessageSquare, AlertCircle } from 'lucide-react';

interface ArchivedMessage {
  id: string;
  originalMessageId: string;
  content: string;
  messageType: string;
  originalCreatedAt: string;
  senderFirstName: string;
  senderLastName: string;
  senderEmail: string;
  isPinned: boolean;
  mentions: string[];
  attachments: any;
}

interface ArchiveBatch {
  archiveBatchId: string;
  archivedAt: string;
  archiveReason: 'TEAM_TO_PRIVATE' | 'TEAM_TO_PUBLIC' | 'LAST_MEMBER_REMOVED';
  messages: ArchivedMessage[];
}

interface ArchivedChatPanelProps {
  incidentId: string;
}

const reasonLabels: Record<string, string> = {
  TEAM_TO_PRIVATE: 'Team → Private transition',
  TEAM_TO_PUBLIC: 'Team → Public transition',
  LAST_MEMBER_REMOVED: 'Last team member removed',
};

export default function ArchivedChatPanel({ incidentId }: ArchivedChatPanelProps) {
  const [batches, setBatches] = useState<ArchiveBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchArchivedMessages();
  }, [incidentId]);

  const fetchArchivedMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/chat/${incidentId}/archived`);
      setBatches(response.data?.data?.batches || []);
      
      // Auto-expand the first batch if there's only one
      if (response.data?.data?.batches?.length === 1) {
        setExpandedBatches(new Set([response.data.data.batches[0].archiveBatchId]));
      }
    } catch (err: any) {
      console.error('Failed to fetch archived messages:', err);
      setError(err.response?.data?.error || 'Failed to load archived chat history');
    } finally {
      setLoading(false);
    }
  };

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchArchivedMessages}
          className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="p-6 text-center">
        <Archive className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Archived Chat History
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          When chat history is archived (e.g., when switching from Team to Private mode),
          it will appear here for reference.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <Archive className="w-5 h-5" />
          <span className="font-medium">Archived Chat History</span>
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          Read-only • Messages are preserved from previous team collaboration sessions
        </p>
      </div>

      {/* Batches */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {batches.map((batch) => (
          <div
            key={batch.archiveBatchId}
            className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden"
          >
            {/* Batch Header */}
            <button
              onClick={() => toggleBatch(batch.archiveBatchId)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {expandedBatches.has(batch.archiveBatchId) ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDateTime(batch.archivedAt)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {reasonLabels[batch.archiveReason] || batch.archiveReason}
                  </span>
                </div>
              </div>
              <span className="text-xs bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">
                {batch.messages.length} message{batch.messages.length !== 1 ? 's' : ''}
              </span>
            </button>

            {/* Messages */}
            {expandedBatches.has(batch.archiveBatchId) && (
              <div className="border-t border-gray-200 dark:border-slate-700 max-h-96 overflow-y-auto">
                {batch.messages.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No messages in this archive
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {batch.messages.map((msg) => (
                      <div key={msg.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="flex-none w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-medium">
                            {msg.senderFirstName?.[0]?.toUpperCase()}
                            {msg.senderLastName?.[0]?.toUpperCase()}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm text-gray-900 dark:text-white">
                                {msg.senderFirstName} {msg.senderLastName}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {formatTime(msg.originalCreatedAt)}
                              </span>
                              {msg.messageType !== 'TEXT' && (
                                <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                  {msg.messageType.toLowerCase().replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="flex-none px-4 py-2 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          <MessageSquare className="inline w-3 h-3 mr-1" />
          {batches.reduce((sum, b) => sum + b.messages.length, 0)} total archived messages
        </p>
      </div>
    </div>
  );
}
