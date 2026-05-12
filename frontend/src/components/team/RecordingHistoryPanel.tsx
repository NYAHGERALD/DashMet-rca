'use client';

import React, { useState, useEffect } from 'react';
import {
  Video,
  Play,
  Pause,
  Trash2,
  Download,
  Clock,
  HardDrive,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  Film,
  ExternalLink
} from 'lucide-react';
import api from '@/lib/api';
import { useWebSocket } from '@/lib/websocket';

interface Recording {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  firebasePath: string;
  fileSize: number;
  duration?: number;
  mimeType: string;
  recordingType: string;
  status: string;
  roomName: string;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  recordedBy: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

interface RecordingHistoryPanelProps {
  incidentId: string;
}

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '--:--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getRecordingDurationSeconds = (recording: Pick<Recording, 'duration' | 'startedAt' | 'endedAt'>) => {
  if (typeof recording.duration === 'number' && recording.duration > 0) {
    return recording.duration;
  }

  if (!recording.endedAt) return undefined;

  const started = new Date(recording.startedAt).getTime();
  const ended = new Date(recording.endedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) {
    return undefined;
  }

  return Math.max(1, Math.ceil((ended - started) / 1000));
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

export default function RecordingHistoryPanel({ incidentId }: RecordingHistoryPanelProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecordings, setExpandedRecordings] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(['all'])); // Expand all by default
  const { socket } = useWebSocket();

  useEffect(() => {
    fetchRecordings();
  }, [incidentId]);

  // Listen for new recordings
  useEffect(() => {
    if (!socket) return;

    const handleNewRecording = (data: { incidentId: string; recording: Recording }) => {
      if (data.incidentId === incidentId) {
        setRecordings(prev => [data.recording, ...prev]);
      }
    };

    socket.on('recording:created', handleNewRecording);
    return () => {
      socket.off('recording:created', handleNewRecording);
    };
  }, [socket, incidentId]);

  const fetchRecordings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/recordings/incident/${incidentId}`);
      // API returns array directly, or wrapped in { success, data } or { success, recordings }
      const data = response.data;
      if (Array.isArray(data)) {
        setRecordings(data);
      } else if (data.success) {
        setRecordings(data.data || data.recordings || []);
      } else {
        setRecordings([]);
      }
    } catch (err: any) {
      console.error('Error fetching recordings:', err);
      // If 404, it means no recordings yet - not an error
      if (err.response?.status === 404) {
        setRecordings([]);
      } else {
        setError('Failed to load recordings');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleRecordingExpand = (id: string) => {
    setExpandedRecordings(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSessionExpand = (roomName: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(roomName)) {
        next.delete(roomName);
      } else {
        next.add(roomName);
      }
      return next;
    });
  };

  const handleDelete = async (recording: Recording) => {
    if (!confirm(`Delete recording "${recording.title}"? This cannot be undone.`)) return;

    setDeletingId(recording.id);
    try {
      await api.delete(`/recordings/${recording.id}`);
      setRecordings(prev => prev.filter(r => r.id !== recording.id));
    } catch (err) {
      console.error('Error deleting recording:', err);
      alert('Failed to delete recording');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (recording: Recording) => {
    const link = document.createElement('a');
    link.href = recording.fileUrl;
    link.download = recording.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group recordings by session (roomName)
  const groupedRecordings = React.useMemo(() => {
    const groups: Record<string, { roomName: string; date: Date; recordings: Recording[] }> = {};
    
    recordings.forEach(recording => {
      if (!groups[recording.roomName]) {
        groups[recording.roomName] = {
          roomName: recording.roomName,
          date: new Date(recording.startedAt),
          recordings: []
        };
      }
      groups[recording.roomName].recordings.push(recording);
      const recordingDate = new Date(recording.startedAt);
      if (recordingDate < groups[recording.roomName].date) {
        groups[recording.roomName].date = recordingDate;
      }
    });

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [recordings]);

  // Calculate stats
  const totalRecordings = recordings.length;
  const totalDuration = recordings.reduce((acc, recording) => acc + (getRecordingDurationSeconds(recording) || 0), 0);
  const totalSize = recordings.reduce((acc, r) => acc + r.fileSize, 0);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-800">
      {/* Header Stats */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/10 dark:bg-red-500/20 rounded-lg">
            <Film className="w-5 h-5 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recording History</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">All meeting recordings for this incident</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{totalRecordings}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Recordings</div>
          </div>
          <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xl font-bold text-green-600 dark:text-green-400">{formatDuration(totalDuration)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Duration</div>
          </div>
          <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{formatFileSize(totalSize)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Size</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
            <span className="ml-3 text-gray-500 dark:text-gray-400">Loading recordings...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400">{error}</p>
            <button
              onClick={fetchRecordings}
              className="mt-3 px-4 py-2 bg-red-500/10 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-12">
            <Film className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Recordings Yet</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Start a team call and record it to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedRecordings.map((session, sessionIdx) => (
              <div key={session.roomName} className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Session Header */}
                <button
                  onClick={() => toggleSessionExpand(session.roomName)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <div className="text-left">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        Session #{groupedRecordings.length - sessionIdx} - {formatDate(session.date.toISOString())}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {session.recordings.length} recording{session.recordings.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  {expandedSessions.has(session.roomName) ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {/* Session Recordings */}
                {expandedSessions.has(session.roomName) && (
                  <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                    {session.recordings.map(recording => (
                      <div key={recording.id} className="p-3">
                        <div className="flex items-start gap-3">
                          {/* Play Button */}
                          <button
                            onClick={() => setPlayingId(playingId === recording.id ? null : recording.id)}
                            className="flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          >
                            {playingId === recording.id ? (
                              <Pause className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            ) : (
                              <Play className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            )}
                          </button>

                          {/* Recording Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {recording.title}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(getRecordingDurationSeconds(recording))}
                              </span>
                              <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />
                                {formatFileSize(recording.fileSize)}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {recording.recordedBy.firstName} {recording.recordedBy.lastName}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {formatDateTime(recording.startedAt)}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => window.open(recording.fileUrl, '_blank')}
                              className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded transition-colors"
                              title="Open in new tab"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownload(recording)}
                              className="p-1.5 text-gray-400 hover:text-green-500 dark:hover:text-green-400 rounded transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(recording)}
                              disabled={deletingId === recording.id}
                              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              {deletingId === recording.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Video Player */}
                        {playingId === recording.id && (
                          <div className="mt-3 rounded-lg overflow-hidden bg-black">
                            <video
                              src={recording.fileUrl}
                              controls
                              autoPlay
                              className="w-full max-h-64"
                            >
                              Your browser does not support the video tag.
                            </video>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-none p-3 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Recordings are stored securely in Firebase and linked to this incident for future reference.
        </p>
      </div>
    </div>
  );
}
