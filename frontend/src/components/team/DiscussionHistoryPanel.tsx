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

interface DiscussionHistoryPanelProps {
  incidentId: string;
}

const markerTypes = [
  { type: 'evidence_discussed', label: 'Evidence Discussed', icon: Eye, color: 'text-blue-500 dark:text-blue-400', bgColor: 'bg-blue-500/10 dark:bg-blue-500/20' },
  { type: 'decision_made', label: 'Decision Made', icon: CheckCircle, color: 'text-green-500 dark:text-green-400', bgColor: 'bg-green-500/10 dark:bg-green-500/20' },
  { type: 'action_assigned', label: 'Action Assigned', icon: Target, color: 'text-orange-500 dark:text-orange-400', bgColor: 'bg-orange-500/10 dark:bg-orange-500/20' },
  { type: 'root_cause_identified', label: 'Root Cause Found', icon: Flag, color: 'text-red-500 dark:text-red-400', bgColor: 'bg-red-500/10 dark:bg-red-500/20' },
  { type: 'custom', label: 'Note', icon: MessageSquare, color: 'text-purple-500 dark:text-purple-400', bgColor: 'bg-purple-500/10 dark:bg-purple-500/20' },
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

export default function DiscussionHistoryPanel({ incidentId }: DiscussionHistoryPanelProps) {
  const [markers, setMarkers] = useState<DiscussionMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(['all'])); // Expand all by default

  useEffect(() => {
    fetchMarkers();
  }, [incidentId]);

  const fetchMarkers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/evidence/markers/incident/${incidentId}`);
      // API returns array directly, or wrapped in { success, data } or { success, markers }
      const data = response.data;
      if (Array.isArray(data)) {
        setMarkers(data);
      } else if (data.success) {
        setMarkers(data.data || data.markers || []);
      } else {
        setMarkers([]);
      }
    } catch (err: any) {
      console.error('Error fetching discussion history:', err);
      // If 404, it means no markers yet - not an error
      if (err.response?.status === 404) {
        setMarkers([]);
      } else {
        setError('Failed to load discussion history');
      }
    } finally {
      setLoading(false);
    }
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

  const getMarkerTypeInfo = (type: string) => {
    return markerTypes.find(mt => mt.type === type) || markerTypes[markerTypes.length - 1];
  };

  const getEvidenceIcon = (type?: string) => {
    switch (type) {
      case 'image': return ImageIcon;
      case 'video': return Video;
      default: return FileText;
    }
  };

  // Group markers by session (roomName)
  const groupedMarkers = React.useMemo(() => {
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
      const markerDate = new Date(marker.timestamp);
      if (markerDate < groups[marker.roomName].date) {
        groups[marker.roomName].date = markerDate;
      }
    });

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [markers]);

  // Calculate stats
  const totalSessions = groupedMarkers.length;
  const totalMarkers = markers.length;
  const decisionsCount = markers.filter(m => m.markerType === 'decision_made').length;
  const actionsCount = markers.filter(m => m.markerType === 'action_assigned').length;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-800">
      {/* Header Stats */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-lg">
            <History className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Discussion History</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">All markers from past team call sessions</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalSessions}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Sessions</div>
          </div>
          <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{totalMarkers}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Markers</div>
          </div>
          <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">{decisionsCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Decisions</div>
          </div>
          <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{actionsCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Actions</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="ml-3 text-gray-500 dark:text-gray-400">Loading discussion history...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400">{error}</p>
            <button
              onClick={fetchMarkers}
              className="mt-3 px-4 py-2 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : markers.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Discussion Markers Yet</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Start a team call and add discussion markers to see them here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedMarkers.map((session, sessionIdx) => (
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
                        Call Session #{groupedMarkers.length - sessionIdx}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(session.date.toISOString())}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
                      {session.markers.length} marker{session.markers.length !== 1 ? 's' : ''}
                    </span>
                    {expandedSessions.has(session.roomName) ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Session Markers */}
                {expandedSessions.has(session.roomName) && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {session.markers.map(marker => {
                      const typeInfo = getMarkerTypeInfo(marker.markerType);
                      const IconComponent = typeInfo.icon;
                      
                      return (
                        <div key={marker.id} className={`p-3 border-l-4 ${
                          marker.markerType === 'evidence_discussed' ? 'border-l-blue-500' :
                          marker.markerType === 'decision_made' ? 'border-l-green-500' :
                          marker.markerType === 'action_assigned' ? 'border-l-orange-500' :
                          marker.markerType === 'root_cause_identified' ? 'border-l-red-500' :
                          'border-l-purple-500'
                        }`}>
                          <div className="flex items-start gap-3">
                            {/* Marker Icon */}
                            <div className={`flex-shrink-0 p-2 rounded-lg ${typeInfo.bgColor}`}>
                              <IconComponent className={`w-4 h-4 ${typeInfo.color}`} />
                            </div>

                            {/* Marker Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-900 dark:text-white text-sm">
                                  {marker.title}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${typeInfo.bgColor} ${typeInfo.color}`}>
                                  {typeInfo.label}
                                </span>
                              </div>
                              
                              {marker.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {marker.description}
                                </p>
                              )}

                              {/* Evidence Badge */}
                              {marker.evidence && (
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                                  {React.createElement(getEvidenceIcon(marker.evidence.type), { className: 'w-3 h-3' })}
                                  <span>{marker.evidence.fileName}</span>
                                </div>
                              )}

                              {/* Meta Info */}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {marker.createdBy.firstName} {marker.createdBy.lastName}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDateTime(marker.timestamp)}
                                </span>
                                {marker.callOffset !== undefined && (
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    @{formatCallOffset(marker.callOffset)} into call
                                  </span>
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
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-none p-3 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Discussion markers are automatically saved during team calls and can be reviewed here anytime.
        </p>
      </div>
    </div>
  );
}
