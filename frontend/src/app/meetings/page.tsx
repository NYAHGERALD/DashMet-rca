'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Mic,
  Calendar,
  Clock,
  User,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  FileText,
  Loader2,
  AlertCircle,
  RefreshCw,
  Play,
  CheckCircle,
  XCircle,
  Upload,
  ArrowLeft,
  GripVertical,
} from 'lucide-react';

interface Meeting {
  id: string;
  title: string | null;
  meetingType: string;
  status: string;
  location: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  duration: number | null;
  recordingUrl: string | null;
  hasTranscript: boolean;
  hasAISummary: boolean;
  createdAt: string;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count: {
    actionItems: number;
  };
}

const meetingTypeLabels: Record<string, string> = {
  GENERAL: 'General',
  STANDUP: 'Standup',
  PLANNING: 'Planning',
  RETROSPECTIVE: 'Retrospective',
  ONE_ON_ONE: '1:1',
  BRAINSTORM: 'Brainstorm',
  REVIEW: 'Review',
  TRAINING: 'Training',
  INTERVIEW: 'Interview',
  CLIENT: 'Client',
  INCIDENT_REVIEW: 'Incident Review',
  SAFETY_BRIEFING: 'Safety Briefing',
};

// Helper to get display title matching iOS behavior
const getDisplayTitle = (meeting: Meeting): string => {
  if (meeting.title && meeting.title.trim()) {
    return meeting.title;
  }
  const typeName = meetingTypeLabels[meeting.meetingType] || 'General';
  return `${typeName} Meeting`;
};

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  DRAFT: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <FileText className="w-3 h-3" /> },
  RECORDING: { color: 'text-red-600', bg: 'bg-red-100', icon: <Mic className="w-3 h-3 animate-pulse" /> },
  PROCESSING: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  COMPLETED: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" /> },
  CANCELLED: { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-3 h-3" /> },
};

function MeetingsContent() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [paginationPosition, setPaginationPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [useCustomPosition, setUseCustomPosition] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setUseCustomPosition(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (dragRef.current) {
      const rect = dragRef.current.getBoundingClientRect();
      dragStartRef.current = {
        x: clientX,
        y: clientY,
        initialX: rect.left,
        initialY: rect.top
      };
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      
      const newX = dragStartRef.current.initialX + deltaX;
      const newY = dragStartRef.current.initialY + deltaY;
      
      const maxX = window.innerWidth - (dragRef.current?.offsetWidth || 0) - 10;
      const maxY = window.innerHeight - (dragRef.current?.offsetHeight || 0) - 10;
      
      setPaginationPosition({
        x: Math.max(10, Math.min(maxX, newX)),
        y: Math.max(10, Math.min(maxY, newY))
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  const fetchMeetings = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        userId: user.id,
        limit: '100',
      });
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      const response = await api.get(`/mobile/meetings?${params.toString()}`);
      
      if (response.data.success) {
        setMeetings(response.data.meetings || []);
      } else {
        setError(response.data.error || 'Failed to fetch meetings');
      }
    } catch (err: any) {
      console.error('Error fetching meetings:', err);
      setError(err.response?.data?.error || 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch =
      !searchQuery ||
      meeting.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.meetingType.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || meeting.meetingType === typeFilter;
    
    return matchesSearch && matchesType;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredMeetings.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMeetings = filteredMeetings.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, pageSize]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Link
                href="/dashboard"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-indigo-900 dark:from-white dark:to-indigo-200 bg-clip-text text-transparent">
                  Meeting Intelligence
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Record, transcribe, and analyze your meetings with AI
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Link
                href="/meetings/upload"
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Audio</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="RECORDING">Recording</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Types</option>
            {Object.entries(meetingTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          
          {/* Refresh */}
          <button
            onClick={fetchMeetings}
            disabled={loading}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pb-8">
        {loading && meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[60vh]">
            <div className="relative mb-8">
              <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-900/50" />
              <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-purple-600 border-r-purple-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Mic className="w-8 h-8 text-purple-600 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">We're fetching your meetings...</p>
            <div className="flex items-center gap-1.5 mt-6">
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchMeetings}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
              <Mic className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No meetings found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'No meetings match your filters. Try adjusting your search criteria.'
                : 'Create meetings on the mobile app, or upload audio files to get AI-powered transcripts and summaries.'}
            </p>
            <Link
              href="/meetings/upload"
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25 transition-all"
            >
              <Upload className="w-5 h-5" />
              <span>Upload Audio</span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 pb-20">
            {paginatedMeetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                className="group block bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-600/50 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusConfig[meeting.status]?.bg || 'bg-gray-100'
                        } ${statusConfig[meeting.status]?.color || 'text-gray-600'}`}
                      >
                        {statusConfig[meeting.status]?.icon}
                        <span>{meeting.status}</span>
                      </span>
                      
                      {/* Type Badge */}
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                        {meetingTypeLabels[meeting.meetingType] || meeting.meetingType}
                      </span>
                      
                      {/* AI Summary Badge */}
                      {meeting.hasAISummary && (
                        <span className="px-2 py-0.5 bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                          ✨ AI Summary
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      {getDisplayTitle(meeting)}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(meeting.startedAt || meeting.scheduledAt || meeting.createdAt)}</span>
                      </div>
                      
                      {meeting.startedAt && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatTime(meeting.startedAt)}</span>
                        </div>
                      )}
                      
                      {meeting.duration && (
                        <div className="flex items-center space-x-1">
                          <Play className="w-4 h-4" />
                          <span>{formatDuration(meeting.duration)}</span>
                        </div>
                      )}
                      
                      {meeting._count?.actionItems > 0 && (
                        <div className="flex items-center space-x-1">
                          <FileText className="w-4 h-4" />
                          <span>{meeting._count.actionItems} action items</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Draggable Pagination Footer */}
      {!loading && !error && filteredMeetings.length > 0 && (
        <div
          ref={dragRef}
          className={`fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl z-40 select-none ${
            isDragging ? 'cursor-grabbing' : ''
          }`}
          style={{
            ...(useCustomPosition
              ? { left: paginationPosition.x, top: paginationPosition.y, right: 'auto', bottom: 'auto', transform: 'none' }
              : { bottom: '24px', left: '50%', transform: 'translateX(-50%)' }),
            transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
            boxShadow: isDragging ? '0 25px 50px -12px rgba(0, 0, 0, 0.35)' : undefined,
          }}
        >
          <div className="px-4 py-3 flex items-center gap-4">
            {/* Drag Handle */}
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              onDoubleClick={() => setUseCustomPosition(false)}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Drag to move • Double-click to reset"
            >
              <GripVertical className="w-5 h-5 text-gray-400" />
            </div>
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Page Info */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredMeetings.length)} of {filteredMeetings.length} meetings
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="First page"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Last page"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <ProtectedRoute>
      <MeetingsContent />
    </ProtectedRoute>
  );
}
