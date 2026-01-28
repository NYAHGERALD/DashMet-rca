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
  X,
  Film,
  History,
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

interface RecordingHistoryProps {
  incidentId: string;
  isOpen: boolean;
  onClose: () => void;
  currentRoomName?: string;
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

export default function RecordingHistory({ incidentId, isOpen, onClose, currentRoomName }: RecordingHistoryProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecordings, setExpandedRecordings] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalRecordings: number; totalDuration: number; totalSize: number } | null>(null);

  const { socket } = useWebSocket();

  useEffect(() => {
    if (!isOpen) return;

    const fetchRecordings = async () => {
      setLoading(true);
      setError(null);
      try {
        const [recordingsRes, statsRes] = await Promise.all([
          api.get(`/recordings/incident/${incidentId}`),
          api.get(`/recordings/incident/${incidentId}/stats`)
        ]);
        setRecordings(recordingsRes.data);
        setStats(statsRes.data);
      } catch (err) {
        console.error('Error fetching recordings:', err);
        setError('Failed to load recordings');
      } finally {
        setLoading(false);
      }
    };

    fetchRecordings();
  }, [incidentId, isOpen]);

  // Listen for new recordings via WebSocket
  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleNewRecording = (data: any) => {
      setRecordings(prev => [data.recording, ...prev]);
      if (stats) {
        setStats({
          ...stats,
          totalRecordings: stats.totalRecordings + 1,
          totalDuration: stats.totalDuration + (data.recording.duration || 0),
          totalSize: stats.totalSize + (data.recording.fileSize || 0)
        });
      }
    };

    const handleRecordingDeleted = (data: any) => {
      setRecordings(prev => prev.filter(r => r.id !== data.recordingId));
    };

    socket.on('recording:created', handleNewRecording);
    socket.on('recording:deleted', handleRecordingDeleted);

    return () => {
      socket.off('recording:created', handleNewRecording);
      socket.off('recording:deleted', handleRecordingDeleted);
    };
  }, [socket, isOpen, stats]);

  const toggleExpanded = (id: string) => {
    setExpandedRecordings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[95vh] sm:max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-red-500/20 rounded-lg">
              <Film className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">Recording History</h2>
              <p className="text-xs sm:text-sm text-gray-400 hidden xs:block">
                All meeting recordings for this incident
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-red-400 animate-spin" />
              <span className="ml-2 sm:ml-3 text-sm sm:text-base text-gray-400">Loading recordings...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-red-400 text-sm sm:text-base">{error}</p>
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Video className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-2 sm:mb-3" />
              <p className="text-gray-400 text-sm sm:text-base">No recordings yet</p>
              <p className="text-gray-500 text-xs sm:text-sm mt-1">
                Click the Record button during a call to start recording
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div className="bg-gray-800 rounded-lg p-2 sm:p-3 text-center">
                    <div className="text-lg sm:text-2xl font-bold text-white">{stats.totalRecordings}</div>
                    <div className="text-[10px] sm:text-xs text-gray-400">Recordings</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2 sm:p-3 text-center">
                    <div className="text-lg sm:text-2xl font-bold text-blue-400">{formatDuration(stats.totalDuration)}</div>
                    <div className="text-[10px] sm:text-xs text-gray-400">Total Duration</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2 sm:p-3 text-center">
                    <div className="text-lg sm:text-2xl font-bold text-green-400">{formatFileSize(stats.totalSize)}</div>
                    <div className="text-[10px] sm:text-xs text-gray-400">Total Size</div>
                  </div>
                </div>
              )}

              {/* Recordings grouped by session */}
              {groupedRecordings.map((group, groupIndex) => (
                <div key={group.roomName} className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                  {/* Session header */}
                  <div className="p-2 sm:p-3 bg-gray-800 border-b border-gray-700">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                      <span className="text-xs sm:text-sm text-gray-300">
                        Session #{groupedRecordings.length - groupIndex} - <span className="hidden xs:inline">{formatDate(group.date.toISOString())}</span><span className="xs:hidden">{new Date(group.date).toLocaleDateString()}</span>
                      </span>
                      <span className="px-1.5 sm:px-2 py-0.5 bg-gray-700 rounded text-[10px] sm:text-xs text-gray-400">
                        {group.recordings.length} recording{group.recordings.length !== 1 ? 's' : ''}
                      </span>
                      {group.roomName === currentRoomName && (
                        <span className="px-1.5 sm:px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] sm:text-xs">
                          Current
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Recordings in session */}
                  <div className="divide-y divide-gray-700">
                    {group.recordings.map(recording => {
                      const isExpanded = expandedRecordings.has(recording.id);
                      const isDeleting = deletingId === recording.id;

                      return (
                        <div key={recording.id} className="p-3 sm:p-4">
                          <div className="flex items-start gap-2 sm:gap-4">
                            {/* Thumbnail/Play area - hidden on very small screens */}
                            <div className="relative hidden xs:block w-20 h-14 sm:w-32 sm:h-20 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 group">
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <a 
                                href={recording.fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="absolute inset-0"
                              />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="text-white font-medium text-sm sm:text-base truncate">{recording.title}</h4>
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-[10px] sm:text-xs text-gray-400">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatDuration(recording.duration)}
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
                                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                                    {formatDateTime(recording.startedAt)}
                                  </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-0.5 sm:gap-1">
                                  <a
                                    href={recording.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                                    title="Open in new tab"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </a>
                                  <button
                                    onClick={() => handleDownload(recording)}
                                    className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                                    title="Download"
                                  >
                                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(recording)}
                                    disabled={isDeleting}
                                    className="p-1.5 sm:p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded video player */}
                              {isExpanded && (
                                <div className="mt-3">
                                  <video
                                    src={recording.fileUrl}
                                    controls
                                    className="w-full rounded-lg"
                                    style={{ maxHeight: '300px' }}
                                  />
                                </div>
                              )}

                              {/* Toggle expand */}
                              <button
                                onClick={() => toggleExpanded(recording.id)}
                                className="mt-2 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" />
                                    Hide video
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3" />
                                    Show video player
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-[10px] sm:text-xs text-gray-500 text-center">
            Recordings are stored securely in Firebase and linked to this incident for future reference.
          </p>
        </div>
      </div>
    </div>
  );
}
