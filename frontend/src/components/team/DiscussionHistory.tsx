'use client';

import React, { useState, useEffect } from 'react';
import {
  Eye,
  CheckCircle,
  Target,
  Flag,
  MessageSquare,
  Clock,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Video,
  FileText,
  Loader2,
  X,
  History
} from 'lucide-react';
import api from '@/lib/api';

interface DiscussionMarker {
  id: string;
  markerType: string;
  title: string;
  description?: string;
  evidenceId?: string;
  roomName: string;
  timestamp: string;
  callOffset?: number;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  evidence?: {
    id: string;
    fileName: string;
    type: string;
  };
}

interface GroupedMarkers {
  roomName: string;
  date: Date;
  markers: DiscussionMarker[];
}

interface DiscussionHistoryProps {
  incidentId: string;
  isOpen: boolean;
  onClose: () => void;
}

const markerTypes = [
  { type: 'evidence_discussed', label: 'Evidence Discussed', icon: Eye, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  { type: 'decision_made', label: 'Decision Made', icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/10' },
  { type: 'action_assigned', label: 'Action Assigned', icon: Target, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  { type: 'root_cause_identified', label: 'Root Cause Found', icon: Flag, color: 'text-red-400', bgColor: 'bg-red-500/10' },
  { type: 'custom', label: 'Note', icon: MessageSquare, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
];

const formatCallOffset = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

export default function DiscussionHistory({ incidentId, isOpen, onClose }: DiscussionHistoryProps) {
  const [markers, setMarkers] = useState<DiscussionMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    const fetchAllMarkers = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all markers for this incident (no roomName filter)
        const response = await api.get(`/evidence/markers/incident/${incidentId}`);
        setMarkers(response.data);
        
        // Expand the most recent session by default
        if (response.data.length > 0) {
          const mostRecentRoom = response.data[response.data.length - 1].roomName;
          setExpandedSessions(new Set([mostRecentRoom]));
        }
      } catch (err) {
        console.error('Error fetching discussion history:', err);
        setError('Failed to load discussion history');
      } finally {
        setLoading(false);
      }
    };

    fetchAllMarkers();
  }, [incidentId, isOpen]);

  // Group markers by roomName (call session)
  const groupedMarkers: GroupedMarkers[] = React.useMemo(() => {
    const groups: Record<string, GroupedMarkers> = {};
    
    markers.forEach(marker => {
      if (!groups[marker.roomName]) {
        groups[marker.roomName] = {
          roomName: marker.roomName,
          date: new Date(marker.timestamp),
          markers: []
        };
      }
      groups[marker.roomName].markers.push(marker);
      // Update date to earliest marker in session
      const markerDate = new Date(marker.timestamp);
      if (markerDate < groups[marker.roomName].date) {
        groups[marker.roomName].date = markerDate;
      }
    });

    // Sort by date (most recent first)
    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [markers]);

  const toggleSession = (roomName: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roomName)) {
        newSet.delete(roomName);
      } else {
        newSet.add(roomName);
      }
      return newSet;
    });
  };

  const getEvidenceIcon = (type?: string) => {
    switch (type) {
      case 'PHOTO': return ImageIcon;
      case 'VIDEO': return Video;
      default: return FileText;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <History className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Discussion History</h2>
              <p className="text-sm text-gray-400">
                All markers from past team call sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <span className="ml-3 text-gray-400">Loading discussion history...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400">{error}</p>
            </div>
          ) : markers.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No discussion markers yet</p>
              <p className="text-gray-500 text-sm mt-1">
                Markers will appear here after team members add them during calls
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{groupedMarkers.length}</div>
                  <div className="text-xs text-gray-400">Call Sessions</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{markers.length}</div>
                  <div className="text-xs text-gray-400">Total Markers</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {markers.filter(m => m.markerType === 'decision_made').length}
                  </div>
                  <div className="text-xs text-gray-400">Decisions Made</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-400">
                    {markers.filter(m => m.markerType === 'action_assigned').length}
                  </div>
                  <div className="text-xs text-gray-400">Actions Assigned</div>
                </div>
              </div>

              {/* Sessions */}
              {groupedMarkers.map((session, sessionIndex) => {
                const isExpanded = expandedSessions.has(session.roomName);
                
                return (
                  <div key={session.roomName} className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                    {/* Session Header */}
                    <button
                      onClick={() => toggleSession(session.roomName)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-700 rounded-lg">
                          <Calendar className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-white font-medium">
                            Call Session #{groupedMarkers.length - sessionIndex}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {formatDate(session.date.toISOString())}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                          {session.markers.length} marker{session.markers.length !== 1 ? 's' : ''}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Session Markers */}
                    {isExpanded && (
                      <div className="border-t border-gray-700 p-4 space-y-3">
                        {session.markers.map((marker) => {
                          const markerConfig = markerTypes.find(m => m.type === marker.markerType);
                          const Icon = markerConfig?.icon || MessageSquare;
                          const EvidenceIcon = getEvidenceIcon(marker.evidence?.type);

                          return (
                            <div
                              key={marker.id}
                              className={`p-3 rounded-lg border border-gray-600 ${markerConfig?.bgColor || 'bg-gray-700/50'}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg bg-gray-800/50`}>
                                  <Icon className={`w-4 h-4 ${markerConfig?.color || 'text-gray-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white font-medium">{marker.title}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${markerConfig?.color} bg-gray-800/50`}>
                                      {markerConfig?.label}
                                    </span>
                                  </div>

                                  {marker.description && (
                                    <p className="text-gray-300 text-sm mt-1">{marker.description}</p>
                                  )}

                                  {marker.evidence && (
                                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                      <EvidenceIcon className="w-3 h-3" />
                                      <span>Related: {marker.evidence.fileName}</span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <div className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      <span>{marker.createdBy.firstName} {marker.createdBy.lastName}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      <span>{formatDateTime(marker.timestamp)}</span>
                                    </div>
                                    {marker.callOffset !== undefined && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-indigo-400">@{formatCallOffset(marker.callOffset)}</span>
                                        <span>into call</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-500 text-center">
            Discussion markers are automatically saved during team calls and can be reviewed here anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
