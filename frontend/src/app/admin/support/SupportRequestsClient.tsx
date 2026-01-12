'use client';

import { useState, useEffect } from 'react';
import { SupportRequest, SupportRequestStatus, SupportCategory } from '@/types/support';
import api from '@/lib/api';
import { format } from 'date-fns';

const statusColors: { [key in SupportRequestStatus]: string } = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const categoryColors: { [key in SupportCategory]: string } = {
  GENERAL_INQUIRY: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  TECHNICAL_ISSUE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  BILLING_QUESTION: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  FEATURE_REQUEST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  BUG_REPORT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  ACCOUNT_ASSISTANCE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

interface Organization {
  id: string;
  name: string;
}

export default function SupportRequestsClient() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState<SupportRequestStatus | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<SupportCategory | 'ALL'>('ALL');
  const [filterOrganization, setFilterOrganization] = useState<string>('ALL');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Internal notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/support');
      setRequests(response.data.data || []);
      setOrganizations(response.data.organizations || []);
      if (response.data.stats) {
        setStats(response.data.stats);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load support requests');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: SupportRequestStatus) => {
    try {
      const response = await api.put(`/support/${id}`, { status });
      const updatedRequest = response.data.data;
      setRequests(requests.map((req) => (req.id === id ? updatedRequest : req)));
      if (selectedRequest?.id === id) {
        setSelectedRequest(updatedRequest);
      }
      // Update stats
      fetchRequests();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert('Failed to update status');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedRequest) return;
    
    try {
      setSavingNotes(true);
      const response = await api.put(`/support/${selectedRequest.id}`, { 
        internalNotes 
      });
      const updatedRequest = response.data.data;
      setRequests(requests.map((req) => (req.id === selectedRequest.id ? updatedRequest : req)));
      setSelectedRequest(updatedRequest);
      setEditingNotes(false);
    } catch (err: any) {
      console.error('Failed to save notes:', err);
      alert('Failed to save internal notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const openRequestDetails = (request: SupportRequest) => {
    setSelectedRequest(request);
    setInternalNotes(request.internalNotes || '');
    setEditingNotes(false);
  };

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    // Status filter
    if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;
    
    // Category filter
    if (filterCategory !== 'ALL' && req.category !== filterCategory) return false;
    
    // Organization filter
    if (filterOrganization !== 'ALL') {
      if (filterOrganization === '' && req.organizationId) return false;
      if (filterOrganization !== '' && req.organizationId !== filterOrganization) return false;
    }
    
    // Date range filter
    if (filterStartDate) {
      const requestDate = new Date(req.createdAt);
      const startDate = new Date(filterStartDate);
      startDate.setHours(0, 0, 0, 0);
      if (requestDate < startDate) return false;
    }
    
    if (filterEndDate) {
      const requestDate = new Date(req.createdAt);
      const endDate = new Date(filterEndDate);
      endDate.setHours(23, 59, 59, 999);
      if (requestDate > endDate) return false;
    }
    
    // Search query (search in ID, subject, description, email)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesId = req.id.toLowerCase().includes(query);
      const matchesSubject = req.subject?.toLowerCase().includes(query);
      const matchesDescription = req.description?.toLowerCase().includes(query);
      const matchesEmail = req.submittedByUserEmail?.toLowerCase().includes(query);
      const matchesUserName = req.submittedByUser 
        ? `${req.submittedByUser.firstName} ${req.submittedByUser.lastName}`.toLowerCase().includes(query)
        : false;
      
      if (!matchesId && !matchesSubject && !matchesDescription && !matchesEmail && !matchesUserName) {
        return false;
      }
    }
    
    return true;
  });

  const clearFilters = () => {
    setFilterStatus('ALL');
    setFilterCategory('ALL');
    setFilterOrganization('ALL');
    setFilterStartDate('');
    setFilterEndDate('');
    setSearchQuery('');
  };

  const hasActiveFilters = filterStatus !== 'ALL' || filterCategory !== 'ALL' || 
    filterOrganization !== 'ALL' || filterStartDate || filterEndDate || searchQuery;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
        <h3 className="font-semibold">Error</h3>
        <p>{error}</p>
        <button 
          onClick={fetchRequests}
          className="mt-2 text-sm underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Open</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.open}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">In Progress</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{stats.inProgress}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Resolved</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.resolved}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Closed</div>
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400 mt-1">{stats.closed}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, subject, description, or user..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as SupportRequestStatus | 'ALL')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as SupportCategory | 'ALL')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="ALL">All Categories</option>
              <option value="GENERAL_INQUIRY">General Inquiry</option>
              <option value="TECHNICAL_ISSUE">Technical Issue</option>
              <option value="BILLING_QUESTION">Billing Question</option>
              <option value="FEATURE_REQUEST">Feature Request</option>
              <option value="BUG_REPORT">Bug Report</option>
              <option value="ACCOUNT_ASSISTANCE">Account Assistance</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Organization
            </label>
            <select
              value={filterOrganization}
              onChange={(e) => setFilterOrganization(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="ALL">All Organizations</option>
              <option value="">No Organization (Visitors)</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>

          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            All Support Requests
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage all support requests across all organizations from the System Admin Portal
          </p>
          {hasActiveFilters && (
            <p className="text-sm text-primary-600 dark:text-primary-400 mt-2">
              Showing {filteredRequests.length} of {requests.length} requests
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No support requests</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {hasActiveFilters 
                  ? 'No requests match your filters' 
                  : 'No support requests have been submitted yet'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Request ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Submitted By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRequests.map((request) => (
                  <tr 
                    key={request.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => openRequestDetails(request)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {request.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      <div className="max-w-xs truncate">{request.subject}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {request.submittedByUser ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {request.submittedByUser.firstName} {request.submittedByUser.lastName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {request.submittedByUser.email}
                          </div>
                          {request.submittedByUser.role && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 mt-1">
                              {request.submittedByUser.role.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Visitor</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {request.submittedByUserEmail}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {request.organization?.name || (
                        <span className="text-gray-400 italic">No Organization</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[request.category]}`}>
                        {request.category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {format(new Date(request.createdAt), 'MMM d, yyyy')}
                      <div className="text-xs text-gray-400">
                        {format(new Date(request.createdAt), 'h:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[request.status]}`}>
                        {request.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <select
                        value={request.status}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleStatusUpdate(request.id, e.target.value as SupportRequestStatus);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      ID: {selectedRequest.id}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedRequest.subject}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedRequest.status]}`}>
                      {selectedRequest.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[selectedRequest.category]}`}>
                      {selectedRequest.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Submitter Info */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Submitted By</h4>
                {selectedRequest.submittedByUser ? (
                  <div className="text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {selectedRequest.submittedByUser.firstName} {selectedRequest.submittedByUser.lastName}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">{selectedRequest.submittedByUser.email}</div>
                    {selectedRequest.submittedByUser.role && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          {selectedRequest.submittedByUser.role.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm">
                    <div className="text-gray-500 dark:text-gray-400">Visitor (Not Registered)</div>
                    <div className="text-gray-500 dark:text-gray-400">{selectedRequest.submittedByUserEmail}</div>
                  </div>
                )}
              </div>

              {/* Organization */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Organization</h4>
                <div className="text-sm text-gray-900 dark:text-white">
                  {selectedRequest.organization?.name || (
                    <span className="text-gray-400 italic">No Organization (Visitor)</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  {selectedRequest.description}
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Internal Notes
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(Only visible to System Admins)</span>
                  </h4>
                  {!editingNotes && (
                    <button
                      onClick={() => setEditingNotes(true)}
                      className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      {selectedRequest.internalNotes ? 'Edit' : 'Add Notes'}
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="Add internal notes about this request..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
                      >
                        {savingNotes ? 'Saving...' : 'Save Notes'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingNotes(false);
                          setInternalNotes(selectedRequest.internalNotes || '');
                        }}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    {selectedRequest.internalNotes || (
                      <span className="text-gray-400 italic">No internal notes yet</span>
                    )}
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Created</div>
                  <div className="text-gray-900 dark:text-white">
                    {format(new Date(selectedRequest.createdAt), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                {selectedRequest.resolvedAt && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Resolved</div>
                    <div className="text-gray-900 dark:text-white">
                      {format(new Date(selectedRequest.resolvedAt), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                )}
              </div>

              {selectedRequest.resolvedByUser && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resolved By</h4>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {selectedRequest.resolvedByUser.firstName} {selectedRequest.resolvedByUser.lastName}
                  </div>
                </div>
              )}

              {/* Status Update */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Update Status</h4>
                <select
                  value={selectedRequest.status}
                  onChange={(e) => handleStatusUpdate(selectedRequest.id, e.target.value as SupportRequestStatus)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
