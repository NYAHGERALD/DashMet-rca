'use client';

import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';

// Types for transcript data
export interface TranscriptEntry {
  timestamp: Date;
  speakerId: string;
  speakerName: string;
  text: string;
}

interface TranscriptData {
  id: string;
  incidentId: string;
  roomName: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  participantIds: string[];
  transcript: TranscriptEntry[];
  aiSummary?: string;
  keyDecisions?: Array<{ decision: string; madeBy?: string }>;
  actionItems?: Array<{ description: string; assignee?: string }>;
  rootCauses?: Array<{ cause: string; category?: string }>;
}

interface TranscriptionPanelProps {
  incidentId: string;
  roomName: string;
  isOpen: boolean;
  onClose: () => void;
  entries: TranscriptEntry[];
  isRecording: boolean;
  onGenerateSummary?: () => Promise<void>;
  transcriptId?: string;
}

// Format timestamp for display
const formatTime = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

// Group consecutive entries by speaker for cleaner display
const groupEntriesBySpeaker = (entries: TranscriptEntry[]): TranscriptEntry[][] => {
  const groups: TranscriptEntry[][] = [];
  let currentGroup: TranscriptEntry[] = [];
  let lastSpeakerId = '';

  entries.forEach((entry) => {
    if (entry.speakerId !== lastSpeakerId) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [entry];
      lastSpeakerId = entry.speakerId;
    } else {
      currentGroup.push(entry);
    }
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

export default function TranscriptionPanel({
  incidentId,
  roomName,
  isOpen,
  onClose,
  entries,
  isRecording,
  onGenerateSummary,
  transcriptId,
}: TranscriptionPanelProps) {
  const [activeTab, setActiveTab] = useState<'live' | 'summary'>('live');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState<TranscriptData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  // Filter entries based on search
  const filteredEntries = searchQuery
    ? entries.filter(
        (e) =>
          e.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.speakerName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  const groupedEntries = groupEntriesBySpeaker(filteredEntries);

  // Generate AI summary
  const handleGenerateSummary = async () => {
    if (!transcriptId) {
      console.error('No transcript ID available');
      return;
    }

    if (entries.length === 0) {
      alert('No transcript entries to summarize. Please record some speech first.');
      return;
    }

    setIsGeneratingSummary(true);
    try {
      // First, save all entries to the backend
      console.log('📝 Saving transcript entries before summarization:', entries.length);
      await api.patch(`/transcripts/${transcriptId}/entries`, { entries });
      
      // Then generate the summary
      const response = await api.post(`/transcripts/${transcriptId}/summarize`);
      if (response.data.success) {
        setSummary(response.data.transcript);
        setActiveTab('summary');
      } else {
        console.error('Summary generation failed:', response.data.error);
        alert(response.data.error || 'Failed to generate summary');
      }
    } catch (error: any) {
      console.error('Failed to generate summary:', error);
      alert(error?.response?.data?.error || 'Failed to generate summary. Please check if OpenAI API key is configured.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="font-semibold text-gray-900 dark:text-white">Transcript</h3>
          {isRecording && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex gap-2">
        <button
          onClick={() => setActiveTab('live')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'live'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Live Transcript
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'summary'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          AI Summary
        </button>
      </div>

      {/* Search (only for live tab) */}
      {activeTab === 'live' && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        {activeTab === 'live' ? (
          <>
            {groupedEntries.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isRecording
                    ? 'Waiting for speech...'
                    : 'No transcript available yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedEntries.map((group, groupIdx) => (
                  <div key={groupIdx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {group[0].speakerName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(group[0].timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      {group.map((entry, idx) => (
                        <p key={idx}>{entry.text}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Summary Tab */
          <div className="space-y-4">
            {!summary && !isGeneratingSummary ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Generate an AI-powered summary of the meeting discussion
                </p>
                <button
                  onClick={handleGenerateSummary}
                  disabled={entries.length === 0 || !transcriptId}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Summary
                </button>
              </div>
            ) : isGeneratingSummary ? (
              <div className="text-center py-8">
                <svg className="w-8 h-8 mx-auto text-blue-500 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Analyzing transcript...
                </p>
              </div>
            ) : summary ? (
              <>
                {/* Summary Section */}
                {summary.aiSummary && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Summary
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {summary.aiSummary}
                    </p>
                  </div>
                )}

                {/* Key Decisions */}
                {summary.keyDecisions && summary.keyDecisions.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Key Decisions
                    </h4>
                    <ul className="space-y-2">
                      {summary.keyDecisions.map((d, i) => (
                        <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">•</span>
                          <span>
                            {d.decision}
                            {d.madeBy && (
                              <span className="text-gray-400 text-xs ml-1">
                                — {d.madeBy}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                {summary.actionItems && summary.actionItems.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Action Items
                    </h4>
                    <ul className="space-y-2">
                      {summary.actionItems.map((a, i) => (
                        <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-orange-500 mt-0.5">•</span>
                          <span>
                            {a.description}
                            {a.assignee && (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded ml-2">
                                @{a.assignee}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Root Causes */}
                {summary.rootCauses && summary.rootCauses.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Root Causes Discussed
                    </h4>
                    <ul className="space-y-2">
                      {summary.rootCauses.map((r, i) => (
                        <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>
                            {r.cause}
                            {r.category && (
                              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded ml-2">
                                {r.category}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Regenerate button */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleGenerateSummary}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate Summary
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
        <span>{entries.length} entries</span>
        {entries.length > 0 && (
          <span>
            {Math.ceil((Date.now() - new Date(entries[0].timestamp).getTime()) / 60000)} min
          </span>
        )}
      </div>
    </div>
  );
}
