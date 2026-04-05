'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';
import {
  Building2,
  UserPlus,
  Send,
  Mail,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronDown,
  Ban,
  MailOpen,
  Users,
  Factory,
  FileWarning,
  Plus,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  region?: string;
  isActive?: boolean;
  createdAt: string;
  _count: {
    User: number;
    Facility: number;
    Incident: number;
  };
}

interface SystemStats {
  totalOrganizations: number;
  totalUsers: number;
  totalFacilities: number;
  totalIncidents: number;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  Organization: { name: string };
  InvitedBy: { id: string; firstName: string; lastName: string; email: string } | null;
  AcceptedUser: { id: string; firstName: string; lastName: string; email: string } | null;
}

const INVITABLE_ROLES = [
  { value: 'ADMIN', label: 'Admin (Organization Owner)' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'QA_FOOD_SAFETY', label: 'QA / Food Safety' },
  { value: 'QUALITY_CONTROL_MANAGER', label: 'Quality Control Manager' },
  { value: 'MAINTENANCE_ENGINEERING', label: 'Maintenance / Engineering' },
  { value: 'CI_MANAGER', label: 'CI / Manager' },
  { value: 'SAFETY_SECURITY_MANAGER', label: 'Safety & Security Manager' },
  { value: 'OPERATOR', label: 'Operator' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: <Clock size={14} /> },
  ACCEPTED: { label: 'Accepted', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: <CheckCircle2 size={14} /> },
  EXPIRED: { label: 'Expired', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: <AlertTriangle size={14} /> },
  REVOKED: { label: 'Revoked', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: <XCircle size={14} /> },
};

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeUntilExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function SystemAdminContent() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'organizations' | 'invitations'>('organizations');

  // Create Org form
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgRegion, setOrgRegion] = useState('USA');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createOrgError, setCreateOrgError] = useState('');

  // Invite Admin form
  const [showInviteAdmin, setShowInviteAdmin] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('ADMIN');
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Quick invite from org row
  const [quickInviteOrgId, setQuickInviteOrgId] = useState<string | null>(null);
  const [quickInviteOrgName, setQuickInviteOrgName] = useState('');

  // Revoke
  const [showRevokeConfirm, setShowRevokeConfirm] = useState<Invitation | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [orgsRes, statsRes, invRes] = await Promise.all([
        api.get('/organizations'),
        api.get('/organizations/stats'),
        api.get('/invitations'),
      ]);
      setOrganizations(orgsRes.data.data.organizations || []);
      setStats(statsRes.data.data);
      setInvitations(invRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ── Create Organization ──
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateOrgError('');
    if (!orgName.trim()) {
      setCreateOrgError('Organization name is required');
      return;
    }
    try {
      setCreatingOrg(true);
      const res = await api.post('/organizations', {
        name: orgName.trim(),
        region: orgRegion,
      });
      const newOrg = res.data.data;
      setSuccessMessage(`Organization "${newOrg.name}" created successfully`);
      setOrgName('');
      setOrgRegion('USA');
      setShowCreateOrg(false);
      await loadData();
      // Prompt to invite first admin
      setQuickInviteOrgId(newOrg.id);
      setQuickInviteOrgName(newOrg.name);
      setInviteOrgId(newOrg.id);
      setInviteRole('ADMIN');
      setShowInviteAdmin(true);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setCreateOrgError(err.response?.data?.error || 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  };

  // ── Send Invitation ──
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    if (!inviteEmail.trim() || !inviteRole || !inviteOrgId) {
      setInviteError('Email, role, and organization are required');
      return;
    }
    try {
      setSendingInvite(true);
      const res = await api.post('/invitations', {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        organizationId: inviteOrgId,
      });
      const data = res.data.data;
      setSuccessMessage(
        data.emailSent
          ? `Invitation sent to ${data.email} for ${data.organizationName}`
          : `Invitation created for ${data.email} (email delivery pending)`
      );
      setInviteEmail('');
      setInviteRole('ADMIN');
      setInviteOrgId('');
      setShowInviteAdmin(false);
      setQuickInviteOrgId(null);
      setQuickInviteOrgName('');
      await loadData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  // ── Revoke Invitation ──
  const handleRevoke = async (inv: Invitation) => {
    try {
      setActionLoading(inv.id);
      await api.patch(`/invitations/${inv.id}/revoke`);
      setShowRevokeConfirm(null);
      setSuccessMessage(`Invitation to ${inv.email} revoked`);
      await loadData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to revoke');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Resend Invitation ──
  const handleResend = async (inv: Invitation) => {
    try {
      setActionLoading(inv.id);
      await api.post(`/invitations/resend/${inv.id}`);
      setSuccessMessage(`Invitation re-sent to ${inv.email}`);
      await loadData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to resend');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Open invite modal for a specific org ──
  const openInviteForOrg = (org: Organization) => {
    setInviteOrgId(org.id);
    setQuickInviteOrgId(org.id);
    setQuickInviteOrgName(org.name);
    setInviteRole('ADMIN');
    setInviteEmail('');
    setInviteError('');
    setShowInviteAdmin(true);
  };

  // Filter invitations
  const filteredInvitations = invitations.filter((inv) => {
    if (statusFilter && inv.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inv.email.toLowerCase().includes(q) ||
        formatRole(inv.role).toLowerCase().includes(q) ||
        inv.Organization?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const inviteStats = {
    total: invitations.length,
    pending: invitations.filter(i => i.status === 'PENDING').length,
    accepted: invitations.filter(i => i.status === 'ACCEPTED').length,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="relative mb-8">
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary-200 dark:border-primary-900/50" />
          <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-primary-600 border-r-primary-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary-600 animate-pulse" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading System Admin portal...</p>
        <div className="flex items-center gap-1.5 mt-6">
          <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0" size={20} />
          <p className="text-sm text-emerald-800 dark:text-emerald-200">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
          <p className="text-sm text-danger-800 dark:text-danger-200">{error}</p>
        </div>
      )}

      {/* Security Notice */}
      <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-sm font-medium text-purple-800 dark:text-purple-200">DashMet System Administration</h3>
            <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
              Create organizations and invite their first admin. Organization admins then invite their own employees.  
              Self-registration is disabled — all users join through secure, role-assigned invitations.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Building2 className="text-purple-600 dark:text-purple-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Organizations</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalOrganizations}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="text-blue-600 dark:text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Factory className="text-emerald-600 dark:text-emerald-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Facilities</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalFacilities}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <FileWarning className="text-amber-600 dark:text-amber-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Incidents</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalIncidents}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 bg-white dark:bg-gray-800 rounded-lg p-1 shadow">
        <button
          onClick={() => setActiveTab('organizations')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'organizations'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Building2 size={16} />
          Organizations ({organizations.length})
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'invitations'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Mail size={16} />
          Invitations ({inviteStats.total})
          {inviteStats.pending > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 rounded-full">
              {inviteStats.pending}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ORGANIZATIONS TAB                                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'organizations' && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Organizations</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Create organizations and invite their first administrator
                </p>
              </div>
              <button
                onClick={() => { setShowCreateOrg(true); setCreateOrgError(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">New Organization</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Facilities</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Incidents</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Building2 className="mx-auto mb-3 text-gray-300 dark:text-gray-600" size={40} />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No organizations yet</p>
                      <button
                        onClick={() => setShowCreateOrg(true)}
                        className="mt-3 inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium"
                      >
                        <Plus size={16} /> Create your first organization
                      </button>
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                            <Building2 size={18} className="text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{org.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">ID: {org.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{org._count.User}</span>
                        {org._count.User === 0 && (
                          <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">No admin yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{org._count.Facility}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{org._count.Incident}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">{formatDate(org.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openInviteForOrg(org)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 dark:text-purple-300 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
                          title={`Invite admin for ${org.name}`}
                        >
                          <UserPlus size={14} />
                          Invite Admin
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* INVITATIONS TAB                                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'invitations' && (
        <>
          {/* Invite Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <button
              onClick={() => setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING')}
              className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-left transition-all ${statusFilter === 'PENDING' ? 'ring-2 ring-amber-500' : 'hover:shadow-md'}`}
            >
              <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide font-medium">Pending</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{inviteStats.pending}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'ACCEPTED' ? '' : 'ACCEPTED')}
              className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-left transition-all ${statusFilter === 'ACCEPTED' ? 'ring-2 ring-emerald-500' : 'hover:shadow-md'}`}
            >
              <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide font-medium">Accepted</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{inviteStats.accepted}</p>
            </button>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Total Sent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{inviteStats.total}</p>
            </div>
          </div>

          {/* Search + Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by email, role, or organization..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:text-white"
              />
            </div>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter('')}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-white"
              >
                <XCircle size={16} /> Clear: {statusFilter}
              </button>
            )}
            <button
              onClick={() => { setInviteOrgId(''); setInviteEmail(''); setInviteRole('ADMIN'); setInviteError(''); setQuickInviteOrgId(null); setQuickInviteOrgName(''); setShowInviteAdmin(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              <UserPlus size={16} /> Send Invitation
            </button>
          </div>

          {/* Invitations Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {filteredInvitations.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="mx-auto mb-4 text-gray-300 dark:text-gray-600" size={48} />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  {invitations.length === 0 ? 'No invitations sent yet' : 'No matching invitations'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {invitations.length === 0 ? 'Create an organization first, then invite its admin.' : 'Try adjusting your search.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Organization</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Sent</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
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
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{inv.email}</p>
                            {inv.AcceptedUser && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                → {inv.AcceptedUser.firstName} {inv.AcceptedUser.lastName}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{inv.Organization?.name || '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                              <Shield size={12} />
                              {formatRole(inv.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusCfg.color}`}>
                              {statusCfg.icon} {statusCfg.label}
                            </span>
                            {isPending && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{timeUntilExpiry(inv.expiresAt)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(inv.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isPending && (
                                <>
                                  <button onClick={() => handleResend(inv)} disabled={isLoading} title="Resend" className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-50">
                                    {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <MailOpen size={16} />}
                                  </button>
                                  <button onClick={() => setShowRevokeConfirm(inv)} disabled={isLoading} title="Revoke" className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50">
                                    <Ban size={16} />
                                  </button>
                                </>
                              )}
                              {isExpired && (
                                <button onClick={() => handleResend(inv)} disabled={isLoading} title="Resend with new token" className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-50">
                                  {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
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
        </>
      )}

      {/* Restricted Actions Notice */}
      <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">How It Works</h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>1. Create an organization for your client company</li>
          <li>2. Invite their first Admin — they receive a secure email link</li>
          <li>3. The Admin registers and is automatically assigned to the organization</li>
          <li>4. That Admin then invites their own employees with role-specific invitations</li>
          <li>5. No access codes needed — everything flows through secure, time-limited tokens</li>
        </ul>
      </div>

      {/* ── Create Organization Modal ── */}
      {showCreateOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateOrg(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 size={20} />
                Create Organization
              </h2>
              <p className="text-sm text-purple-100 mt-1">Set up a new client organization</p>
            </div>
            <form onSubmit={handleCreateOrg} className="p-6 space-y-5">
              {createOrgError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-600 shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{createOrgError}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g., Sigma Foods Inc."
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:text-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Region</label>
                <select
                  value={orgRegion}
                  onChange={(e) => setOrgRegion(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:text-white appearance-none cursor-pointer"
                >
                  <option value="USA">USA</option>
                  <option value="MEXICO">Mexico</option>
                  <option value="CANADA">Canada</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateOrg(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creatingOrg} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {creatingOrg ? <><RefreshCw size={16} className="animate-spin" /> Creating...</> : <><Plus size={16} /> Create</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Send Invitation Modal ── */}
      {showInviteAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowInviteAdmin(false); setQuickInviteOrgId(null); }} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus size={20} />
                {quickInviteOrgName ? `Invite Admin for ${quickInviteOrgName}` : 'Send Invitation'}
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                Invite a user to join an organization with a specific role
              </p>
            </div>
            <form onSubmit={handleSendInvite} className="p-6 space-y-5">
              {inviteError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-600 shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{inviteError}</p>
                </div>
              )}

              {/* Organization */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Organization <span className="text-red-500">*</span>
                </label>
                {quickInviteOrgId ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <Building2 size={16} className="text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-200">{quickInviteOrgName}</span>
                  </div>
                ) : (
                  <select
                    required
                    value={inviteOrgId}
                    onChange={(e) => setInviteOrgId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="">Select an organization...</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
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
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:text-white appearance-none cursor-pointer"
                  >
                    {INVITABLE_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  For new organizations, invite an Admin first — they can then invite their own team
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowInviteAdmin(false); setQuickInviteOrgId(null); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={sendingInvite} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {sendingInvite ? <><RefreshCw size={16} className="animate-spin" /> Sending...</> : <><Send size={16} /> Send Invitation</>}
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
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30">
              <Ban className="text-red-600 dark:text-red-400" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Revoke Invitation?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              Revoke the invitation for <span className="font-medium text-gray-900 dark:text-white">{showRevokeConfirm.email}</span> ({showRevokeConfirm.Organization?.name})?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowRevokeConfirm(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleRevoke(showRevokeConfirm)} disabled={actionLoading === showRevokeConfirm.id} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {actionLoading === showRevokeConfirm.id ? <RefreshCw size={16} className="animate-spin" /> : <Ban size={16} />} Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SystemAdminPage() {
  return (
    <ProtectedRoute 
      requireAuth={true} 
      allowedRoles={['SYSTEM_ADMIN']}
      loginRedirect="/dashmet-control/login"
    >
      <SystemAdminContent />
    </ProtectedRoute>
  );
}
