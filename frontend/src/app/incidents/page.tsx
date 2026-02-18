'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/lib/websocket';
import { usePrivileges, INCIDENTS_PRIVILEGES } from '@/lib/usePrivileges';
import { useAccessDeniedModal } from '@/components/modals/AccessDeniedModal';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import InvitationModal, { Invitation } from '@/components/team/InvitationModal';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/dateUtils';

interface Incident {
  id: string;
  incidentNumber: string;
  type: 'FOOD_SAFETY' | 'MACHINE_EQUIPMENT';
  status: string;
  severity: string;
  description: string;
  aiSummary?: string;
  occurredAt: string;
  createdAt: string;
  isPrivate?: boolean;
  createdById?: string; // ID of the user who created the incident
  // Backend returns this as User_Incident_createdByIdToUser (Prisma relation naming)
  User_Incident_createdByIdToUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  // Backend returns with capital letters (Prisma convention)
  Category?: {
    id: string;
    name: string;
    parent?: {
      name: string;
    };
  };
  Facility?: {
    id: string;
    name: string;
  };
  Area?: {
    id: string;
    name: string;
  };
  Line?: {
    id: string;
    name: string;
  };
  reporter?: {
    id: string;
    name: string;
    email: string;
  };
}

export default function IncidentsPage() {
  const { user } = useAuth();
  const { socket, isConnected, connect, onInvitationReceived } = useWebSocket();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterType = searchParams.get('filter') || 'my';

  // Privilege enforcement - include version for real-time updates
  const { hasPrivilege, loading: privilegesLoading, version: privilegeVersion } = usePrivileges();
  const { modal: accessDeniedModal, showAccessDenied } = useAccessDeniedModal({
    onContactSupport: () => router.push('/support'),
  });
  const canViewIncident = hasPrivilege(INCIDENTS_PRIVILEGES.VIEW);
  const canCreateIncident = hasPrivilege(INCIDENTS_PRIVILEGES.CREATE);
  const canDeleteIncident = hasPrivilege(INCIDENTS_PRIVILEGES.DELETE);

  // Handler for creating new incident with privilege check
  const handleCreateIncident = useCallback(() => {
    if (!canCreateIncident) {
      showAccessDenied('Create Incident Report', INCIDENTS_PRIVILEGES.CREATE);
      return;
    }
    router.push('/incidents/new');
  }, [canCreateIncident, showAccessDenied, router]);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Invitation state
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [currentInvitationIndex, setCurrentInvitationIndex] = useState(0);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [invitationLoading, setInvitationLoading] = useState(false);

  // Connect WebSocket when user is available
  useEffect(() => {
    if (user && !isConnected) {
      connect(user.id, user.organizationId);
    }
  }, [user, isConnected, connect]);

  // Load pending invitations - memoized with useCallback
  const loadPendingInvitations = useCallback(async () => {
    try {
      const response = await api.get('/participants/invitations/pending');
      const invitations = response.data.data || [];
      setPendingInvitations(invitations);
      if (invitations.length > 0) {
        setCurrentInvitationIndex(0);
        setShowInvitationModal(true);
      }
    } catch (err) {
      console.error('Failed to load pending invitations:', err);
    }
  }, []);

  // Handle accept invitation
  const handleAcceptInvitation = async (incidentId: string) => {
    setInvitationLoading(true);
    try {
      await api.post(`/participants/invitations/${incidentId}/accept`);
      // Remove from pending list
      const updatedInvitations = pendingInvitations.filter(inv => inv.incidentId !== incidentId);
      setPendingInvitations(updatedInvitations);
      // Show next invitation or close modal
      if (updatedInvitations.length > 0) {
        setCurrentInvitationIndex(0);
      } else {
        setShowInvitationModal(false);
      }
      // After accepting a team invitation, redirect to Team Incidents page to show the newly accessible incident
      // Team invitations are for TEAM visibility incidents, so they should appear in Team Incidents
      if (filterType !== 'team') {
        router.push('/incidents?filter=team');
      } else {
        // Reload incidents to show newly accessible incident
        loadIncidents();
      }
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      alert(err.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setInvitationLoading(false);
    }
  };

  // Handle decline invitation
  const handleDeclineInvitation = async (incidentId: string) => {
    setInvitationLoading(true);
    try {
      await api.post(`/participants/invitations/${incidentId}/decline`);
      // Remove from pending list
      const updatedInvitations = pendingInvitations.filter(inv => inv.incidentId !== incidentId);
      setPendingInvitations(updatedInvitations);
      // Show next invitation or close modal
      if (updatedInvitations.length > 0) {
        setCurrentInvitationIndex(0);
      } else {
        setShowInvitationModal(false);
      }
    } catch (err: any) {
      console.error('Failed to decline invitation:', err);
      alert(err.response?.data?.error || 'Failed to decline invitation');
    } finally {
      setInvitationLoading(false);
    }
  };

  // Handle cancel (decide later)
  const handleCancelInvitation = () => {
    // Move to next invitation or close modal
    if (currentInvitationIndex < pendingInvitations.length - 1) {
      setCurrentInvitationIndex(currentInvitationIndex + 1);
    } else {
      setShowInvitationModal(false);
    }
  };

  useEffect(() => {
    loadPendingInvitations();
  }, [loadPendingInvitations]);

  // Listen for real-time invitation notifications via WebSocket callback
  useEffect(() => {
    const unsubscribe = onInvitationReceived((data) => {
      console.log('🔔 Invitation received on incidents page:', data);
      // Reload pending invitations when a new one is received
      loadPendingInvitations();
    });

    return () => {
      unsubscribe();
    };
  }, [onInvitationReceived, loadPendingInvitations]);

  useEffect(() => {
    loadIncidents();
  }, [filterType, statusFilter, typeFilter]);

  const loadIncidents = async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/incidents?';
      
      // Add scope filter based on filterType
      // 'my' = private incidents only, 'team' = team incidents, 'public' = public incidents
      if (filterType === 'team') {
        url += 'scope=team&';
      } else if (filterType === 'public') {
        url += 'scope=public&';
      } else {
        // Default 'my' - only private incidents
        url += 'scope=my&';
      }
      
      // Add status filter
      if (statusFilter !== 'all') {
        url += `status=${statusFilter}&`;
      }
      
      // Add type filter
      if (typeFilter !== 'all') {
        url += `type=${typeFilter}&`;
      }

      const response = await api.get(url);
      setIncidents(response.data.data.incidents || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load incidents');
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'SUBMITTED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'IN_TRIAGE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'UNDER_INVESTIGATION': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'RCA_IN_PROGRESS': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'PENDING_CAPA': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
      case 'CAPA_IN_PROGRESS': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'CLOSED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (incidentId: string, incidentNumber: string) => {
    if (!confirm(`Are you sure you want to delete incident ${incidentNumber}? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(incidentId);
    try {
      await api.delete(`/incidents/${incidentId}`);
      setIncidents(incidents.filter(i => i.id !== incidentId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete incident');
    } finally {
      setDeletingId(null);
    }
  };

  // Check if user can delete a specific incident
  // - Admins can delete any incident
  // - Users can delete incidents they created
  const canDeleteSpecificIncident = (incident: Incident) => {
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN';
    const isOwner = incident.createdById === user?.id || incident.User_Incident_createdByIdToUser?.id === user?.id;
    return isAdmin || isOwner;
  };

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-3 sm:p-4 lg:p-8">
        {/* Invitation Modal */}
        <InvitationModal
          isOpen={showInvitationModal}
          invitation={pendingInvitations[currentInvitationIndex] || null}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
          onCancel={handleCancelInvitation}
          isLoading={invitationLoading}
        />

        <div className="w-full">
          {/* Header */}
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3">
              <div className="relative w-10 h-10 flex-shrink-0">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <div>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center text-sm sm:text-base text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-2"
                >
                  ← Back to Dashboard
                </Link>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                  {filterType === 'team' ? '👥 Team Incidents' : filterType === 'public' ? '🌐 Public Incidents' : '📋 My Incidents'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
                  {filterType === 'team' 
                    ? 'Team-based incidents where you are the owner or an active participant'
                    : filterType === 'public'
                    ? 'All public incidents shared within your organization'
                    : 'Your private incidents - only visible to you'
                  }
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Pending Invitations Badge */}
              {pendingInvitations.length > 0 && (
                <button
                  onClick={() => {
                    setCurrentInvitationIndex(0);
                    setShowInvitationModal(true);
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span className="font-medium">
                    <span className="hidden sm:inline">{pendingInvitations.length} Pending </span>
                    <span className="sm:hidden">{pendingInvitations.length} </span>
                    Invite{pendingInvitations.length !== 1 ? 's' : ''}
                  </span>
                </button>
              )}
              <button
                onClick={handleCreateIncident}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base whitespace-nowrap"
              >
                <span className="sm:hidden">+ New</span>
                <span className="hidden sm:inline">+ Create Incident</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="IN_TRIAGE">In Triage</option>
                  <option value="UNDER_INVESTIGATION">Under Investigation</option>
                  <option value="RCA_IN_PROGRESS">RCA In Progress</option>
                  <option value="PENDING_CAPA">Pending CAPA</option>
                  <option value="CAPA_IN_PROGRESS">CAPA In Progress</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="FOOD_SAFETY">Food Safety</option>
                  <option value="MACHINE_EQUIPMENT">Machine & Equipment</option>
                  <option value="WORKPLACE_SAFETY">Workplace Safety</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={loadIncidents}
                  className="w-full sm:w-auto px-4 py-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
              <p className="text-danger-800 dark:text-danger-200">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
              <div className="relative mb-8">
                <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary-200 dark:border-primary-900/50" />
                <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-primary-600 border-r-primary-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
              <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">We're fetching your incidents...</p>
              <div className="flex items-center gap-1.5 mt-6">
                <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Incidents List */}
          {!loading && incidents.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 sm:p-12 text-center border border-gray-200 dark:border-slate-700">
              <div className="text-4xl sm:text-6xl mb-4">📋</div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No incidents found
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
                {filterType === 'team' 
                  ? 'No team incidents match your filters'
                  : filterType === 'public'
                  ? 'No public incidents available in your organization'
                  : 'You haven\'t created any private incidents yet'
                }
              </p>
              <button
                onClick={handleCreateIncident}
                className="inline-flex px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                + Create Your First Incident
              </button>
            </div>
          )}

          {!loading && incidents.length > 0 && (
            <>
              {/* Responsive Table with Horizontal Scroll */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              {/* Table Container with Horizontal Scroll */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[180px]">
                        Incident
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">
                        Type / Category
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                        Location
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                        Status
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                        Severity
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">
                        Date
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {incidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <td className="px-3 sm:px-4 py-3 sm:py-4 min-w-[180px]">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {incident.incidentNumber}
                              </p>
                              {incident.isPrivate && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded" title="Private incident - only visible to you">
                                  🔒
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                              {incident.aiSummary || incident.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 min-w-[120px]">
                          <div>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${
                              incident.type === 'FOOD_SAFETY' 
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                              {incident.type === 'FOOD_SAFETY' ? '🍽️ Food Safety' : '⚙️ Machine'}
                            </span>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {incident.Category?.parent?.name || incident.Category?.name || 'N/A'}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">
                          <p>{incident.Facility?.name || 'N/A'}</p>
                          {incident.Area && (
                            <p className="text-xs">{incident.Area.name}</p>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 min-w-[100px]">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${getStatusColor(incident.status)}`}>
                            {formatStatus(incident.status)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 min-w-[80px]">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 min-w-[120px] whitespace-nowrap">
                          {formatDateTime(incident.occurredAt)}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 min-w-[80px]">
                          <div className="flex items-center gap-2">
                            {canViewIncident ? (
                              <Link
                                href={`/incidents/${incident.id}`}
                                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium whitespace-nowrap"
                              >
                                View →
                              </Link>
                            ) : (
                              <button
                                onClick={() => showAccessDenied('View Incident Report', INCIDENTS_PRIVILEGES.VIEW)}
                                className="text-gray-400 dark:text-gray-500 text-sm font-medium whitespace-nowrap cursor-not-allowed opacity-60"
                                title="You don't have permission to view incidents"
                              >
                                View →
                              </button>
                            )}
                            {canDeleteSpecificIncident(incident) && (
                              <button
                                onClick={() => handleDelete(incident.id, incident.incidentNumber)}
                                disabled={deletingId === incident.id}
                                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium disabled:opacity-50"
                                title="Delete incident"
                              >
                                {deletingId === incident.id ? (
                                  <span className="inline-block w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></span>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Summary */}
              <div className="px-3 sm:px-4 py-3 bg-gray-50 dark:bg-slate-700 border-t border-gray-200 dark:border-slate-600">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Showing {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
                </p>
              </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Access Denied Modal */}
      {accessDeniedModal}
    </ProtectedRoute>
  );
}
