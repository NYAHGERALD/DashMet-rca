'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWebSocket } from '@/lib/websocket';
import api from '@/lib/api';
import { SupportRequest, SupportRequestStatus } from '@/types/support';
import { 
  MessageSquare, 
  Inbox, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  User,
  Calendar,
  Tag,
  ChevronRight,
  RefreshCw,
  X,
  Image as ImageIcon,
  Loader2,
  Bell,
  ArrowLeft
} from 'lucide-react';

interface SupportStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusColors: Record<SupportRequestStatus, { bg: string; text: string; icon: React.ReactNode }> = {
  OPEN: { 
    bg: 'bg-blue-100 dark:bg-blue-900/30', 
    text: 'text-blue-700 dark:text-blue-300',
    icon: <AlertCircle className="w-4 h-4" />
  },
  IN_PROGRESS: { 
    bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
    text: 'text-yellow-700 dark:text-yellow-300',
    icon: <Clock className="w-4 h-4" />
  },
  RESOLVED: { 
    bg: 'bg-green-100 dark:bg-green-900/30', 
    text: 'text-green-700 dark:text-green-300',
    icon: <CheckCircle className="w-4 h-4" />
  },
  CLOSED: { 
    bg: 'bg-gray-100 dark:bg-gray-700', 
    text: 'text-gray-700 dark:text-gray-300',
    icon: <X className="w-4 h-4" />
  },
};

const categoryLabels: Record<string, string> = {
  GENERAL_INQUIRY: 'General Inquiry',
  TECHNICAL_ISSUE: 'Technical Issue',
  BILLING_QUESTION: 'Billing Question',
  FEATURE_REQUEST: 'Feature Request',
  BUG_REPORT: 'Bug Report',
  ACCOUNT_ASSISTANCE: 'Account Assistance',
  OTHER: 'Other',
};

export default function SupportInboxPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { onSupportNewRequest, isConnected, connect } = useWebSocket();
  
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SupportRequestStatus | 'ALL'>('ALL');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [updating, setUpdating] = useState(false);
  const [newRequestAlert, setNewRequestAlert] = useState(false);
  
  // Check if user has access to this page
  const hasAccess = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN' || user?.role === 'QUALITY_CONTROL_MANAGER';
  
  // Auto-connect WebSocket
  useEffect(() => {
    if (user && !isConnected) {
      connect(user.id, user.organizationId);
    }
  }, [user, isConnected, connect]);
  
  // Listen for new support requests via WebSocket
  useEffect(() => {
    if (!user || !hasAccess) return;
    
    const unsubscribe = onSupportNewRequest((data) => {
      console.log('📬 SupportInbox: New request received via WebSocket:', data);
      
      // Check if this request should be shown to this user
      const shouldShow = 
        !data.recipientRole ||
        (data.recipientRole === 'ADMIN' && (user.role === 'ADMIN' || user.role === 'SYSTEM_ADMIN')) ||
        (data.recipientRole === 'QUALITY_CONTROL_MANAGER' && user.role === 'QUALITY_CONTROL_MANAGER');
      
      if (!shouldShow) return;
      
      // Show new request alert indicator
      setNewRequestAlert(true);
      
      // Auto-refresh the list to include the new request
      fetchRequests(1);
    });
    
    return unsubscribe;
  }, [user, hasAccess, onSupportNewRequest]);
  
  // Handle view parameter from URL (for direct navigation from alert)
  useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && requests.length > 0) {
      const request = requests.find(r => r.id === viewId);
      if (request) {
        setSelectedRequest(request);
      }
    }
  }, [searchParams, requests]);
  
  const fetchRequests = useCallback(async (page = 1) => {
    if (!hasAccess) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      
      const response = await api.get(`/support/my-inbox?${params.toString()}`);
      
      if (response.data.success) {
        setRequests(response.data.data);
        setStats(response.data.stats);
        setPagination(response.data.pagination);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch support requests');
    } finally {
      setLoading(false);
    }
  }, [hasAccess, statusFilter]);
  
  useEffect(() => {
    if (!user) return;
    
    if (!hasAccess) {
      router.push('/dashboard');
      return;
    }
    
    fetchRequests();
  }, [user, hasAccess, router, fetchRequests]);
  
  const handleStatusChange = async (requestId: string, newStatus: SupportRequestStatus) => {
    setUpdating(true);
    
    try {
      const response = await api.patch(`/support/inbox/${requestId}`, {
        status: newStatus,
      });
      
      if (response.data.success) {
        // Update the request in the list
        setRequests(prev => 
          prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r)
        );
        
        // Update selected request if it's the same
        if (selectedRequest?.id === requestId) {
          setSelectedRequest(prev => prev ? { ...prev, status: newStatus } : null);
        }
        
        // Refresh stats
        fetchRequests(pagination?.page || 1);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  if (!user) {
    return null;
  }
  
  if (!hasAccess) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Logged in as <span className="font-medium text-gray-700 dark:text-gray-300">{user.firstName} {user.lastName}</span>
              </span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                {user.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Inbox className="w-7 h-7 text-emerald-600" />
                Support Inbox
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {user.role === 'QUALITY_CONTROL_MANAGER' 
                  ? 'Messages from team members directed to QC Manager'
                  : 'Messages from team members directed to Admin'}
              </p>
            </div>
            <button
              onClick={() => {
                setNewRequestAlert(false);
                fetchRequests(pagination?.page || 1);
              }}
              disabled={loading}
              className={`relative flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 ${
                newRequestAlert ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-gray-900' : ''
              }`}
            >
              {newRequestAlert && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              )}
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {newRequestAlert ? 'New Request!' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === 'ALL'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
            </button>
            <button
              onClick={() => setStatusFilter('OPEN')}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === 'OPEN'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.open}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Open</div>
            </button>
            <button
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === 'IN_PROGRESS'
                  ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.inProgress}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">In Progress</div>
            </button>
            <button
              onClick={() => setStatusFilter('RESOLVED')}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === 'RESOLVED'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Resolved</div>
            </button>
            <button
              onClick={() => setStatusFilter('CLOSED')}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === 'CLOSED'
                  ? 'border-gray-500 bg-gray-100 dark:bg-gray-700'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.closed}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Closed</div>
            </button>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Request List */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Messages</h2>
            </div>
            
            {loading && requests.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
                <div className="relative mb-6">
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-emerald-200 dark:border-emerald-900/50" />
                  <div className="w-16 h-16 rounded-full border-4 border-transparent border-t-emerald-600 border-r-emerald-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-emerald-600 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
                <p className="text-gray-500 dark:text-gray-400 text-center text-sm">Loading messages...</p>
                <div className="flex items-center gap-1.5 mt-4">
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No support requests</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                {requests.map((request) => (
                  <button
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      selectedRequest?.id === request.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[request.status].bg} ${statusColors[request.status].text}`}>
                            {statusColors[request.status].icon}
                            {request.status.replace('_', ' ')}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {request.subject}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {request.submittedByUser 
                            ? `${request.submittedByUser.firstName} ${request.submittedByUser.lastName}`
                            : request.submittedByUserEmail || 'Unknown'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          {formatDate(request.createdAt)}
                        </span>
                        {request.attachments && request.attachments.length > 0 && (
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => fetchRequests(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchRequests(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
          
          {/* Request Detail */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {selectedRequest ? (
              <div className="h-full flex flex-col">
                {/* Detail Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedRequest.subject}
                      </h2>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {selectedRequest.submittedByUser 
                            ? `${selectedRequest.submittedByUser.firstName} ${selectedRequest.submittedByUser.lastName}`
                            : selectedRequest.submittedByUserEmail || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(selectedRequest.createdAt).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag className="w-4 h-4" />
                          {categoryLabels[selectedRequest.category] || selectedRequest.category}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedRequest(null)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Detail Body */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedRequest.description}
                    </p>
                  </div>
                  
                  {/* Attachments */}
                  {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Attachments ({selectedRequest.attachments.length})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedRequest.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-emerald-500 transition-colors"
                          >
                            {attachment.mimeType.startsWith('image/') ? (
                              <img
                                src={attachment.url}
                                alt={attachment.originalName}
                                className="w-full h-32 object-cover"
                              />
                            ) : (
                              <div className="w-full h-32 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                                <ImageIcon className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            <div className="p-2 bg-gray-50 dark:bg-gray-900">
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {attachment.originalName}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Detail Footer - Status Actions */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${statusColors[selectedRequest.status].bg} ${statusColors[selectedRequest.status].text}`}>
                        {statusColors[selectedRequest.status].icon}
                        {selectedRequest.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {selectedRequest.status === 'OPEN' && (
                        <button
                          onClick={() => handleStatusChange(selectedRequest.id, 'IN_PROGRESS')}
                          disabled={updating}
                          className="px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Mark In Progress
                        </button>
                      )}
                      {(selectedRequest.status === 'OPEN' || selectedRequest.status === 'IN_PROGRESS') && (
                        <button
                          onClick={() => handleStatusChange(selectedRequest.id, 'RESOLVED')}
                          disabled={updating}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Mark Resolved
                        </button>
                      )}
                      {selectedRequest.status === 'RESOLVED' && (
                        <button
                          onClick={() => handleStatusChange(selectedRequest.id, 'CLOSED')}
                          disabled={updating}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Close Request
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                  <ChevronRight className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Select a message to view details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
