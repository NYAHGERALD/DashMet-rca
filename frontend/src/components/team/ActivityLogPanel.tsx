'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
  Clipboard,
  ClipboardCheck,
  Sparkles,
  FileUp,
  History,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: string;
  category: 'incident' | 'team' | 'rca' | 'capa' | 'evidence';
  action: string;
  description: string;
  timestamp: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  details?: Record<string, any>;
}

interface ActivityLogPanelProps {
  incidentId: string;
  className?: string;
  versionHistory?: VersionHistoryItem[];
}

interface VersionHistoryItem {
  id: string;
  versionNumber: number | string;
  createdAt: string;
  changeReason?: string | null;
  createdBy?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  incident: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  team: { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  rca: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  capa: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  evidence: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700' },
  version: { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
};

const getActivityIcon = (type: string, category: string) => {
  switch (type) {
    case 'INCIDENT_CREATED':
      return <FileText className="w-4 h-4" />;
    case 'INCIDENT_SUBMITTED':
      return <Send className="w-4 h-4" />;
    case 'INCIDENT_STATUS_CHANGED':
      return <RefreshCw className="w-4 h-4" />;
    case 'INCIDENT_DESCRIPTION_UPDATED':
    case 'INCIDENT_UPDATED':
      return <FileText className="w-4 h-4" />;
    case 'TEAM_MEMBER_INVITED':
      return <UserPlus className="w-4 h-4" />;
    case 'TEAM_MEMBER_ACCEPTED':
      return <UserCheck className="w-4 h-4" />;
    case 'TEAM_MEMBER_DECLINED':
      return <XCircle className="w-4 h-4" />;
    case 'TEAM_MEMBER_LEFT':
      return <UserMinus className="w-4 h-4" />;
    case 'RCA_CREATED':
      return <Sparkles className="w-4 h-4" />;
    case 'RCA_UPDATED':
      return <RefreshCw className="w-4 h-4" />;
    case 'RCA_VALIDATED':
      return <Shield className="w-4 h-4" />;
    case 'CAPA_CREATED':
      return <Clipboard className="w-4 h-4" />;
    case 'CAPA_COMPLETED':
      return <CheckCircle className="w-4 h-4" />;
    case 'CAPA_VERIFIED':
      return <ClipboardCheck className="w-4 h-4" />;
    case 'EVIDENCE_ADDED':
      return <FileUp className="w-4 h-4" />;
    default:
      return <MessageSquare className="w-4 h-4" />;
  }
};

export default function ActivityLogPanel({ incidentId, className = '', versionHistory = [] }: ActivityLogPanelProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidentNumber, setIncidentNumber] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    fetchActivities();
  }, [incidentId]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/incidents/${incidentId}/activity-timeline`);
      if (response.data?.success) {
        setActivities(response.data.data.activities);
        setIncidentNumber(response.data.data.incidentNumber);
      } else {
        throw new Error(response.data?.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const activityCategories = ['all', 'incident', 'team', 'rca', 'capa', 'evidence', 'version'];
  const isVersionFilter = filterCategory === 'version';
  const filteredActivities = filterCategory === 'all'
    ? activities
    : isVersionFilter
      ? []
      : activities.filter(a => a.category === filterCategory);
  const versionColors = categoryColors.version;

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'MMM d, yyyy h:mm a');
  };

  const formatRelativeTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading activity timeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-4">
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        <button
          onClick={fetchActivities}
          className="mt-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with filter */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Activity Timeline</h3>
          <button
            onClick={fetchActivities}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {activityCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                filterCategory === cat
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 font-medium'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat === 'all' ? 'All' : cat === 'version' ? 'Version' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isVersionFilter ? (
          versionHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
              <History className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm">No version history found</p>
              <button
                onClick={() => setFilterCategory('all')}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Show all activities
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-4">
                {versionHistory.map((version) => {
                  const authorName = [
                    version.createdBy?.firstName,
                    version.createdBy?.lastName,
                  ].filter(Boolean).join(' ');

                  return (
                    <div key={version.id} className="relative pl-8">
                      <div className={`absolute left-1 w-5 h-5 rounded-full flex items-center justify-center ${versionColors.bg} ${versionColors.border} border-2`}>
                        <span className={versionColors.text}>
                          <History className="w-4 h-4" />
                        </span>
                      </div>
                      <div className={`bg-white dark:bg-gray-800 rounded-lg border ${versionColors.border} p-3 shadow-sm hover:shadow-md transition-shadow`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-tight">
                              Version v{version.versionNumber}
                            </p>
                            {version.changeReason && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {version.changeReason}
                              </p>
                            )}
                            {authorName && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                by {authorName}
                              </p>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${versionColors.bg} ${versionColors.text} whitespace-nowrap`}>
                            VERSION
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span title={formatTimestamp(version.createdAt)}>
                            {formatRelativeTime(version.createdAt)}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">•</span>
                          <span>{formatTimestamp(version.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <Clock className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">No activities found</p>
            {filterCategory !== 'all' && (
              <button
                onClick={() => setFilterCategory('all')}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Show all activities
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

            {/* Activities */}
            <div className="space-y-4">
              {filteredActivities.map((activity, index) => {
                const colors = categoryColors[activity.category] || categoryColors.incident;
                const isFirst = index === 0;
                const isLast = index === filteredActivities.length - 1;

                return (
                  <div key={activity.id} className="relative pl-8">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-1 w-5 h-5 rounded-full flex items-center justify-center ${colors.bg} ${colors.border} border-2`}
                    >
                      <span className={colors.text}>
                        {getActivityIcon(activity.type, activity.category)}
                      </span>
                    </div>

                    {/* Activity card */}
                    <div
                      className={`bg-white dark:bg-gray-800 rounded-lg border ${colors.border} p-3 shadow-sm hover:shadow-md transition-shadow`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-tight">
                            {activity.description}
                          </p>
                          {activity.userName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              by {activity.userName}
                            </p>
                          )}
                          {activity.details && Object.keys(activity.details).length > 0 && (
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {activity.details.invitedUserName && (
                                <span className="block">
                                  Invited: {activity.details.invitedUserName}
                                </span>
                              )}
                              {activity.details.role && (
                                <span className="block">
                                  Role: {activity.details.role}
                                </span>
                              )}
                              {activity.details.method && (
                                <span className="block">
                                  Method: {activity.details.method?.replace(/_/g, ' ')}
                                </span>
                              )}
                              {activity.details.title && activity.type.startsWith('CAPA') && (
                                <span className="block truncate">
                                  Action: {activity.details.title}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${colors.bg} ${colors.text} whitespace-nowrap`}
                        >
                          {activity.category.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span title={formatTimestamp(activity.timestamp)}>
                          {formatRelativeTime(activity.timestamp)}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span>{formatTimestamp(activity.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer with stats */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {isVersionFilter
              ? `${versionHistory.length} version${versionHistory.length !== 1 ? 's' : ''}`
              : `${filteredActivities.length} activities`}
          </span>
          {isVersionFilter && versionHistory.length > 0 ? (
            <span>
              Latest {formatRelativeTime(versionHistory[0].createdAt)}
            </span>
          ) : activities.length > 0 && (
            <span>
              Started {formatRelativeTime(activities[0].timestamp)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
