'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Mic,
  Calendar,
  Clock,
  User,
  ArrowLeft,
  ArrowRight,
  FileText,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Sparkles,
  Download,
  Volume2,
  Copy,
  Check,
  MapPin,
  Users,
  Target,
  ListChecks,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
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
  objective: string | null;
  agendaItems: string[];
  tags: string[];
  hasTranscript: boolean;
  hasAISummary: boolean;
  rawTranscript: string | null;
  createdAt: string;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  participants: Array<{
    id: string;
    name: string | null;
    email: string | null;
    userId: string | null;
  }>;
  bookmarks: Array<{
    id: string;
    timestamp: number;
    label: string | null;
    createdAt: string;
  }>;
  actionItems: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: string | null;
    isAiExtracted: boolean;
    sourceText: string | null;
    createdAt: string;
    owner: { id: string; firstName: string; lastName: string; email: string } | null;
    assignee: { id: string; firstName: string; lastName: string; email: string } | null;
  }>;
}

interface AISummary {
  id: string;
  meetingId: string;
  narrative: string | null;
  briefSummary: string | null;
  tone: string | null;
  objectives: string[] | null;
  keyDiscussions: string[] | null;
  takeaways: string[] | null;
  audioUrl: string | null;
  audioVoice: string | null;
  audioDuration: number | null;
  generatedAt: string | null;
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
  DRAFT: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <FileText className="w-4 h-4" /> },
  RECORDING: { color: 'text-red-600', bg: 'bg-red-100', icon: <Mic className="w-4 h-4 animate-pulse" /> },
  PROCESSING: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  COMPLETED: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-4 h-4" /> },
  CANCELLED: { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-4 h-4" /> },
};

function MeetingDetailContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const meetingId = params?.id as string;
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [aiSummary, setAISummary] = useState<AISummary | null>(null);
  const [processedTranscript, setProcessedTranscript] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['keyPoints', 'actionItems']));
  
  // Audio player state for recording
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  
  // Summary audio player state
  const summaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isSummaryAudioPlaying, setIsSummaryAudioPlaying] = useState(false);
  const [summaryAudioProgress, setSummaryAudioProgress] = useState(0);
  const [summaryAudioDuration, setSummaryAudioDuration] = useState(0);
  
  // Extract action items state
  const [extractingActions, setExtractingActions] = useState(false);

  // Navigate to action item detail page
  const openActionItemDetail = useCallback((item: Meeting['actionItems'][0]) => {
    router.push(`/meetings/${meetingId}/actions/${item.id}`);
  }, [router, meetingId]);

  const fetchMeeting = useCallback(async () => {
    if (!meetingId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/mobile/meetings/${meetingId}`);
      
      if (response.data.success) {
        setMeeting(response.data.meeting);
      } else {
        setError(response.data.error || 'Failed to fetch meeting');
      }
    } catch (err: any) {
      console.error('Error fetching meeting:', err);
      setError(err.response?.data?.error || 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  const fetchAISummary = useCallback(async () => {
    if (!meetingId) return;
    
    try {
      const response = await api.get(`/transcripts/ai-summary/${meetingId}`);
      if (response.data?.summary) {
        setAISummary(response.data.summary);
      }
    } catch (err: any) {
      // Not an error if summary doesn't exist yet
      console.log('No AI summary found');
    }
  }, [meetingId]);

  const fetchProcessedTranscript = useCallback(async () => {
    if (!meetingId) return;
    
    try {
      const response = await api.get(`/transcripts/processed/${meetingId}`);
      if (response.data?.transcript) {
        // Extract the actual transcript string from the response object
        const transcriptData = response.data.transcript;
        setProcessedTranscript(transcriptData.processedTranscript || transcriptData.rawTranscript || '');
      }
    } catch (err: any) {
      console.log('No processed transcript found');
    }
  }, [meetingId]);

  useEffect(() => {
    fetchMeeting();
    fetchAISummary();
    fetchProcessedTranscript();
  }, [fetchMeeting, fetchAISummary, fetchProcessedTranscript]);

  const generateAISummary = async () => {
    if (!meeting?.rawTranscript && !processedTranscript) {
      return;
    }
    
    setGeneratingSummary(true);
    
    try {
      const transcript = processedTranscript || meeting?.rawTranscript || '';
      
      const response = await api.post('/transcripts/narrative-summary', {
        transcript,
        meetingId,
        meetingType: meeting?.meetingType,
        title: meeting?.title,
      });
      
      if (response.data?.summary) {
        // Save the summary
        await api.post('/transcripts/save-ai-summary', {
          meetingId,
          summary: response.data.summary,
          keyPoints: response.data.keyPoints || [],
          actionItems: response.data.actionItems || [],
          decisions: response.data.decisions || [],
          nextSteps: response.data.nextSteps || [],
        });
        
        // Refresh summary
        await fetchAISummary();
      }
    } catch (err: any) {
      console.error('Error generating summary:', err);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const extractActionItems = async () => {
    if (!meeting || !user) return;
    
    const transcript = processedTranscript || meeting.rawTranscript;
    if (!transcript) return;
    
    setExtractingActions(true);
    
    try {
      const response = await api.post('/mobile/tasks/extract-from-transcript', {
        meetingId,
        transcript,
        ownerId: user.id,
        organizationId: user.organizationId,
      });
      
      if (response.data?.success) {
        // Refresh meeting to get new action items
        await fetchMeeting();
        // Switch to Actions tab to show extracted items (matching iOS behavior)
        setActiveTab('actions');
      }
    } catch (err: any) {
      console.error('Error extracting action items:', err);
    } finally {
      setExtractingActions(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const toggleAudioPlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleSummaryAudioPlayback = () => {
    if (!summaryAudioRef.current) return;
    
    if (isSummaryAudioPlaying) {
      summaryAudioRef.current.pause();
    } else {
      summaryAudioRef.current.play();
    }
    setIsSummaryAudioPlaying(!isSummaryAudioPlaying);
  };

  const handleSummaryAudioTimeUpdate = () => {
    if (summaryAudioRef.current) {
      setSummaryAudioProgress(summaryAudioRef.current.currentTime);
    }
  };

  const handleSummaryAudioLoadedMetadata = () => {
    if (summaryAudioRef.current) {
      setSummaryAudioDuration(summaryAudioRef.current.duration);
    }
  };

  const handleSummaryAudioEnded = () => {
    setIsSummaryAudioPlaying(false);
    setSummaryAudioProgress(0);
    if (summaryAudioRef.current) {
      summaryAudioRef.current.currentTime = 0;
    }
  };

  const seekSummaryAudio = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!summaryAudioRef.current || !summaryAudioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * summaryAudioDuration;
    summaryAudioRef.current.currentTime = newTime;
    setSummaryAudioProgress(newTime);
  };

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-purple-600 border-r-purple-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Mic className="w-8 h-8 text-purple-600 animate-pulse" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading meeting details...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'Meeting not found'}</p>
          <Link
            href="/meetings"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Meetings</span>
          </Link>
        </div>
      </div>
    );
  }

  const transcript = processedTranscript || meeting.rawTranscript;
  const hasTranscript = !!transcript;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link
              href="/meetings"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span
                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    statusConfig[meeting.status]?.bg || 'bg-gray-100'
                  } ${statusConfig[meeting.status]?.color || 'text-gray-600'}`}
                >
                  {statusConfig[meeting.status]?.icon}
                  <span>{meeting.status}</span>
                </span>
                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                  {meetingTypeLabels[meeting.meetingType] || meeting.meetingType}
                </span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {getDisplayTitle(meeting)}
              </h1>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex space-x-1 mt-4 overflow-x-auto">
            {[
              { id: 'transcript', label: 'Transcript', icon: <MessageSquare className="w-4 h-4" /> },
              { id: 'summary', label: 'Summary', icon: <Sparkles className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'transcript' && (
          <div className="space-y-6">
            {/* Meeting Details */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Date:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDate(meeting.startedAt || meeting.scheduledAt || meeting.createdAt)}
                  </span>
                </div>
                {meeting.startedAt && (
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Time:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatTime(meeting.startedAt)}
                      {meeting.endedAt && ` - ${formatTime(meeting.endedAt)}`}
                    </span>
                  </div>
                )}
                {meeting.duration && (
                  <div className="flex items-center space-x-2">
                    <Play className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Duration:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatDuration(meeting.duration)}
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Organizer:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {meeting.creator.firstName} {meeting.creator.lastName}
                  </span>
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>Transcript</span>
                </h2>
                <div className="flex items-center space-x-2">
                  {hasTranscript && (
                    <button
                      onClick={() => copyToClipboard(transcript || '')}
                      className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>
              
              {hasTranscript ? (
              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                  {transcript}
                </pre>
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No transcript available for this meeting.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Transcripts are generated after recording is completed.
                </p>
              </div>
            )}
              
              {/* Extract Action Items Button - matching iOS style - only show if no action items exist */}
              {hasTranscript && meeting && meeting.actionItems.length === 0 && (
                <button
                  onClick={extractActionItems}
                  disabled={extractingActions}
                  className="w-full mt-4 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center space-x-2">
                    {extractingActions ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    <span className="font-medium">
                      {extractingActions ? 'Extracting Action Items...' : 'Extract Action Items'}
                    </span>
                  </div>
                  {!extractingActions && <ArrowRight className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-6">
            {!aiSummary && !generatingSummary && (
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6 text-center">
                <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No Summary Yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {hasTranscript
                    ? 'Generate an intelligent summary of this meeting.'
                    : 'A transcript is required to generate a summary.'}
                </p>
                {hasTranscript && (
                  <button
                    onClick={generateAISummary}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25 transition-all"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>Generate Summary</span>
                  </button>
                )}
              </div>
            )}
            
            {generatingSummary && (
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6 text-center">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Generating summary...</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  This may take a minute for longer meetings.
                </p>
              </div>
            )}
            
            {aiSummary && (
              <>
                {/* Audio Summary Player */}
                {aiSummary.audioUrl && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-700/50 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800/50 rounded-full flex items-center justify-center">
                          <Volume2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            Listen to Summary
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Audio narration available{aiSummary.audioVoice ? ` • ${aiSummary.audioVoice}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={toggleSummaryAudioPlayback}
                        className="w-12 h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
                      >
                        {isSummaryAudioPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" />
                        )}
                      </button>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div 
                        className="h-2 bg-purple-200 dark:bg-purple-800/50 rounded-full cursor-pointer overflow-hidden"
                        onClick={seekSummaryAudio}
                      >
                        <div 
                          className="h-full bg-purple-600 dark:bg-purple-500 rounded-full transition-all duration-100"
                          style={{ width: `${summaryAudioDuration ? (summaryAudioProgress / summaryAudioDuration) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatAudioTime(summaryAudioProgress)}</span>
                        <span>{formatAudioTime(summaryAudioDuration || aiSummary.audioDuration || 0)}</span>
                      </div>
                    </div>
                    
                    {/* Hidden Audio Element */}
                    <audio
                      ref={summaryAudioRef}
                      src={aiSummary.audioUrl}
                      onTimeUpdate={handleSummaryAudioTimeUpdate}
                      onLoadedMetadata={handleSummaryAudioLoadedMetadata}
                      onEnded={handleSummaryAudioEnded}
                    />
                  </div>
                )}

                {/* Summary */}
                <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <span>Summary</span>
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {aiSummary.narrative || aiSummary.briefSummary || 'No summary available'}
                  </p>
                </div>

                {/* Objectives */}
                {aiSummary.objectives && aiSummary.objectives.length > 0 && (
                  <CollapsibleSection
                    title="Objectives"
                    items={aiSummary.objectives}
                    isExpanded={expandedSections.has('keyPoints')}
                    onToggle={() => toggleSection('keyPoints')}
                    icon={<Target className="w-5 h-5 text-blue-500" />}
                  />
                )}

                {/* Key Discussions */}
                {aiSummary.keyDiscussions && aiSummary.keyDiscussions.length > 0 && (
                  <CollapsibleSection
                    title="Key Discussions"
                    items={aiSummary.keyDiscussions}
                    isExpanded={expandedSections.has('actionItems')}
                    onToggle={() => toggleSection('actionItems')}
                    icon={<ListChecks className="w-5 h-5 text-green-500" />}
                  />
                )}

                {/* Takeaways */}
                {aiSummary.takeaways && aiSummary.takeaways.length > 0 && (
                  <CollapsibleSection
                    title="Key Takeaways"
                    items={aiSummary.takeaways}
                    isExpanded={expandedSections.has('decisions')}
                    onToggle={() => toggleSection('decisions')}
                    icon={<CheckCircle className="w-5 h-5 text-purple-500" />}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

function CollapsibleSection({
  title,
  items,
  isExpanded,
  onToggle,
  icon,
}: {
  title: string;
  items: string[];
  isExpanded: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          {icon}
          <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
          <span className="text-sm text-gray-500">({items.length})</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-start space-x-2 text-gray-700 dark:text-gray-300">
                <span className="text-purple-500 mt-1">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function MeetingDetailPage() {
  return (
    <ProtectedRoute>
      <MeetingDetailContent />
    </ProtectedRoute>
  );
}
