'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import Image from 'next/image';
import {
  Mail,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  UserPlus,
  Shield,
  Copy,
  AlertTriangle,
  Search,
  Filter,
  ChevronDown,
  MailOpen,
  Ban,
} from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  facilityId: string | null;
  Organization: { name: string };
  InvitedBy: { id: string; firstName: string; lastName: string; email: string } | null;
  AcceptedUser: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface Facility {
  id: string;
  name: string;
}

function normalizeFacilities(rawData: any): Facility[] {
  const rawFacilities = rawData?.Facility || rawData?.facilities || rawData;
  if (!Array.isArray(rawFacilities)) return [];

  return rawFacilities
    .map((facility: any) => ({
      id: facility.id,
      name: facility.name,
    }))
    .filter((facility: Facility) => facility.id && facility.name);
}

const INVITABLE_ROLES = [
  { value: 'OPERATOR', label: 'Operator' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'QA_FOOD_SAFETY', label: 'QA / Food Safety' },
  { value: 'MAINTENANCE_ENGINEERING', label: 'Maintenance / Engineering' },
  { value: 'CI_MANAGER', label: 'CI / Manager' },
  { value: 'SAFETY_SECURITY_MANAGER', label: 'Safety & Security Manager' },
  { value: 'QUALITY_CONTROL_MANAGER', label: 'Quality Control Manager' },
  { value: 'ADMIN', label: 'Admin' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: {
    label: 'Pending',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: <Clock size={14} />,
  },
  ACCEPTED: {
    label: 'Accepted',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: <CheckCircle2 size={14} />,
  },
  EXPIRED: {
    label: 'Expired',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    icon: <AlertTriangle size={14} />,
  },
  REVOKED: {
    label: 'Revoked',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    icon: <XCircle size={14} />,
  },
};

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeUntilExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function InvitationsContent() {
  const { user } = useAuth();
  const router = useRouter();

  // State
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Send invite form
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sendRole, setSendRole] = useState('');
  const [sendFacilityId, setSendFacilityId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState<Invitation | null>(null);

  useEffect(() => {
    if (user?.role === 'SYSTEM_ADMIN') {
      router.replace('/system-admin');
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invRes, facRes] = await Promise.all([
        api.get('/invitations'),
        api.get('/facilities'),
      ]);
      setInvitations(invRes.data.data || []);
      setFacilities(normalizeFacilities(facRes.data.data));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError('');

    if (!sendEmail.trim() || !sendRole) {
      setSendError('Email and role are required');
      return;
    }

    try {
      setSending(true);
      const payload: any = {
        email: sendEmail.trim().toLowerCase(),
        role: sendRole,
      };
      if (sendFacilityId) {
        payload.facilityId = sendFacilityId;
      }

      const res = await api.post('/invitations', payload);
      const data = res.data.data;

      setSuccessMessage(
        data.emailSent
          ? `Invitation sent to ${data.email}`
          : `Invitation created for ${data.email} (email delivery pending)`
      );
      setSendEmail('');
      setSendRole('');
      setSendFacilityId('');
      setShowSendForm(false);
      await loadData();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setSendError(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (invitation: Invitation) => {
    try {
      setActionLoading(invitation.id);
      await api.patch(`/invitations/${invitation.id}/revoke`);
      setShowRevokeConfirm(null);
      setSuccessMessage(`Invitation to ${invitation.email} has been revoked`);
      await loadData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to revoke invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (invitation: Invitation) => {
    try {
      setActionLoading(invitation.id);
      await api.post(`/invitations/resend/${invitation.id}`);
      setSuccessMessage(`Invitation re-sent to ${invitation.email}`);
      await loadData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to resend invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const copyInviteLink = (invitation: Invitation) => {
    // The invitation link is built from the frontend URL
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/accept-invite?token=${(invitation as any).token || ''}`;
    // If token not in response, show a message
    if (!(invitation as any).token) {
      alert('Invite link is only available at time of creation. Resend the invitation instead.');
      return;
    }
    navigator.clipboard.writeText(link);
    setSuccessMessage('Invite link copied to clipboard');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Filter invitations
  const filteredInvitations = invitations.filter((inv) => {
    if (statusFilter && inv.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inv.email.toLowerCase().includes(q) ||
        formatRole(inv.role).toLowerCase().includes(q) ||
        inv.InvitedBy?.firstName?.toLowerCase().includes(q) ||
        inv.InvitedBy?.lastName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: invitations.length,
    pending: invitations.filter((i) => i.status === 'PENDING').length,
    accepted: invitations.filter((i) => i.status === 'ACCEPTED').length,
    expired: invitations.filter((i) => i.status === 'EXPIRED').length,
    revoked: invitations.filter((i) => i.status === 'REVOKED').length,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="relative mb-8">
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary-200 dark:border-primary-900/50" />
          <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-primary-600 border-r-primary-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary-600 animate-pulse" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Loading Invitations...</h3>
        <div className="flex items-center gap-1.5 mt-4">
          <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="relative w-8 h-8">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invitation Management</h1>
            </div>
            <div className="flex items-center space-x-3">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-danger-100 text-danger-800 dark:bg-danger-900 dark:text-danger-200">
                ADMIN ACCESS
              </span>
              <button
                onClick={() => setShowSendForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <UserPlus size={18} />
                <span className="hidden sm:inline">Invite Employee</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-6 px-4 sm:px-6 lg:px-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0" size={20} />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
            <p className="text-sm text-danger-800 dark:text-danger-200">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{stats.total}</p>
          </div>
          <button
            onClick={() => setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING')}
            className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-left transition-all ${statusFilter === 'PENDING' ? 'ring-2 ring-amber-500' : 'hover:shadow-md'}`}
          >
            <h3 className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Pending</h3>
            <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">{stats.pending}</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'ACCEPTED' ? '' : 'ACCEPTED')}
            className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-left transition-all ${statusFilter === 'ACCEPTED' ? 'ring-2 ring-emerald-500' : 'hover:shadow-md'}`}
          >
            <h3 className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Accepted</h3>
            <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{stats.accepted}</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'EXPIRED' ? '' : 'EXPIRED')}
            className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-left transition-all ${statusFilter === 'EXPIRED' ? 'ring-2 ring-gray-500' : 'hover:shadow-md'}`}
          >
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Expired</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-500 dark:text-gray-400">{stats.expired}</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'REVOKED' ? '' : 'REVOKED')}
            className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-left transition-all ${statusFilter === 'REVOKED' ? 'ring-2 ring-red-500' : 'hover:shadow-md'}`}
          >
            <h3 className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Revoked</h3>
            <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">{stats.revoked}</p>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email, role, or inviter..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
            />
          </div>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors dark:text-white"
            >
              <XCircle size={16} />
              Clear filter: {statusFilter}
            </button>
          )}
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors dark:text-white"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Invitations Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {filteredInvitations.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="mx-auto mb-4 text-gray-300 dark:text-gray-600" size={48} />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                {invitations.length === 0 ? 'No invitations yet' : 'No matching invitations'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {invitations.length === 0
                  ? 'Send your first invitation to start building your team.'
                  : 'Try adjusting your search or filters.'}
              </p>
              {invitations.length === 0 && (
                <button
                  onClick={() => setShowSendForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  <UserPlus size={18} />
                  Invite First Employee
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      Invited By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      Sent / Expires
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredInvitations.map((inv) => {
                    const statusCfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.PENDING;
                    const isPending = inv.status === 'PENDING';
                    const isExpired = inv.status === 'EXPIRED';
                    const isLoading = actionLoading === inv.id;

                    return (
                      <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                              <Mail size={14} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{inv.email}</p>
                              {inv.AcceptedUser && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  → {inv.AcceptedUser.firstName} {inv.AcceptedUser.lastName}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                            <Shield size={12} />
                            {formatRole(inv.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusCfg.color}`}>
                            {statusCfg.icon}
                            {statusCfg.label}
                          </span>
                          {isPending && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              {timeUntilExpiry(inv.expiresAt)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {inv.InvitedBy ? (
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {inv.InvitedBy.firstName} {inv.InvitedBy.lastName}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400">—</p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(inv.createdAt)}</p>
                          {isPending && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              Expires: {formatDate(inv.expiresAt)}
                            </p>
                          )}
                          {inv.acceptedAt && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              Accepted: {formatDate(inv.acceptedAt)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleResend(inv)}
                                  disabled={isLoading}
                                  title="Resend invitation email"
                                  className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {isLoading ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                  ) : (
                                    <MailOpen size={16} />
                                  )}
                                </button>
                                <button
                                  onClick={() => setShowRevokeConfirm(inv)}
                                  disabled={isLoading}
                                  title="Revoke invitation"
                                  className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  <Ban size={16} />
                                </button>
                              </>
                            )}
                            {isExpired && (
                              <button
                                onClick={() => handleResend(inv)}
                                disabled={isLoading}
                                title="Resend with new token"
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {isLoading ? (
                                  <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                  <RefreshCw size={16} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">Invitation Security</h4>
              <ul className="mt-1 text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                <li>• Each invitation uses a cryptographically secure 256-bit token</li>
                <li>• Invitations expire automatically after 48 hours</li>
                <li>• Only the invited email address can accept the invitation</li>
                <li>• Self-registration is disabled — all users must be invited</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* ── Send Invitation Modal ── */}
      {showSendForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSendForm(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus size={20} />
                Invite Employee
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                Send a secure invitation to join your organization
              </p>
            </div>

            <form onSubmit={handleSendInvitation} className="p-6 space-y-5">
              {sendError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{sendError}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Employee Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    required
                    value={sendEmail}
                    onChange={(e) => setSendEmail(e.target.value)}
                    placeholder="employee@company.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    autoFocus
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Role <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    required
                    value={sendRole}
                    onChange={(e) => setSendRole(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="">Select a role...</option>
                    {INVITABLE_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  This role will be assigned automatically when the employee accepts
                </p>
              </div>

              {/* Facility (Optional) */}
              {facilities.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Facility <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={sendFacilityId}
                    onChange={(e) => setSendFacilityId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="">All facilities / Not specified</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSendForm(false);
                    setSendError('');
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Send Invitation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Revoke Confirmation Modal ── */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRevokeConfirm(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30">
                <Ban className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                Revoke Invitation?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                This will permanently revoke the invitation for{' '}
                <span className="font-medium text-gray-900 dark:text-white">{showRevokeConfirm.email}</span>.
                They will no longer be able to use this link to register.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRevokeConfirm(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRevoke(showRevokeConfirm)}
                  disabled={actionLoading === showRevokeConfirm.id}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === showRevokeConfirm.id ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Ban size={16} />
                  )}
                  Revoke
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvitationsPage() {
  return (
    <ProtectedRoute requiredRole="ADMIN">
      <InvitationsContent />
    </ProtectedRoute>
  );
}
