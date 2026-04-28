'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';
import {
  Building2,
  UserPlus,
  Send,
  Mail,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Users,
  Factory,
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
  };
}

interface Facility {
  id: string;
  name: string;
  organizationId: string;
}

interface SystemStats {
  totalOrganizations: number;
  totalUsers: number;
  totalFacilities: number;
}

interface OrganizationInvitationSummary {
  organizationName: string;
  region?: string | null;
  createdAt: string;
  userCount: number;
  facilityCount: number;
  invitationCounts: {
    total: number;
    pending: number;
    accepted: number;
    expired: number;
    revoked: number;
  };
}

function normalizeInvitationSummaries(rawData: any): OrganizationInvitationSummary[] {
  if (rawData?.mode === 'ORGANIZATION_SUMMARY' && Array.isArray(rawData.organizations)) {
    return rawData.organizations;
  }

  // Backward compatibility: if old invite rows come back, aggregate client-side
  if (Array.isArray(rawData)) {
    const byOrganization = new Map<string, OrganizationInvitationSummary>();
    for (const invitation of rawData) {
      const orgName = invitation?.Organization?.name || 'Unknown Organization';
      const orgId = invitation?.organizationId || invitation?.Organization?.id || orgName;
      const existing = byOrganization.get(orgId) || {
        organizationName: orgName,
        region: null,
        createdAt: invitation?.createdAt || new Date().toISOString(),
        userCount: 0,
        facilityCount: 0,
        invitationCounts: {
          total: 0,
          pending: 0,
          accepted: 0,
          expired: 0,
          revoked: 0,
        },
      };

      existing.invitationCounts.total += 1;
      if (invitation?.status === 'PENDING') existing.invitationCounts.pending += 1;
      if (invitation?.status === 'ACCEPTED') existing.invitationCounts.accepted += 1;
      if (invitation?.status === 'EXPIRED') existing.invitationCounts.expired += 1;
      if (invitation?.status === 'REVOKED') existing.invitationCounts.revoked += 1;
      byOrganization.set(orgId, existing);
    }

    return Array.from(byOrganization.values()).sort((a, b) =>
      a.organizationName.localeCompare(b.organizationName)
    );
  }

  return [];
}

function getOrganizationSummaryKey(summary: OrganizationInvitationSummary, index: number): string {
  return `${summary.organizationName}::${summary.region || 'none'}::${summary.createdAt}::${index}`;
}

function normalizeFacilities(rawData: any): Facility[] {
  const rawFacilities = rawData?.Facility || rawData?.facilities || rawData;
  if (!Array.isArray(rawFacilities)) return [];

  return rawFacilities
    .map((facility: any) => ({
      id: facility.id,
      name: facility.name,
      organizationId: facility.organizationId || facility.Organization?.id,
    }))
    .filter((facility: Facility) => facility.id && facility.name && facility.organizationId);
}

function SystemAdminContent() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [invitationSummaries, setInvitationSummaries] = useState<OrganizationInvitationSummary[]>([]);
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
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [inviteFacilityId, setInviteFacilityId] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Quick invite from org row
  const [quickInviteOrgId, setQuickInviteOrgId] = useState<string | null>(null);
  const [quickInviteOrgName, setQuickInviteOrgName] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setInviteFacilityId('');
  }, [inviteOrgId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [orgsRes, statsRes, invRes, facRes] = await Promise.all([
        api.get('/organizations'),
        api.get('/organizations/stats'),
        api.get('/invitations'),
        api.get('/facilities'),
      ]);
      setOrganizations(orgsRes.data.data.organizations || []);
      setStats(statsRes.data.data);
      setInvitationSummaries(normalizeInvitationSummaries(invRes.data.data));
      setFacilities(normalizeFacilities(facRes.data.data));
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
    if (!inviteEmail.trim() || !inviteOrgId) {
      setInviteError('Email and organization are required');
      return;
    }
    try {
      setSendingInvite(true);
      const res = await api.post('/invitations', {
        email: inviteEmail.trim().toLowerCase(),
        role: 'ADMIN',
        organizationId: inviteOrgId,
        ...(inviteFacilityId ? { facilityId: inviteFacilityId } : {}),
      });
      const data = res.data.data;
      setSuccessMessage(
        data.emailSent
          ? `Invitation sent to ${data.email} for ${data.organizationName}`
          : `Invitation created for ${data.email} (email delivery pending)`
      );
      setInviteEmail('');
      setInviteOrgId('');
      setInviteFacilityId('');
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

  // ── Open invite modal for a specific org ──
  const openInviteForOrg = (org: Organization) => {
    setInviteOrgId(org.id);
    setQuickInviteOrgId(org.id);
    setQuickInviteOrgName(org.name);
    setInviteFacilityId('');
    setInviteEmail('');
    setInviteError('');
    setShowInviteAdmin(true);
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  // Filter organization-level invitation summaries
  const filteredInvitationSummaries = invitationSummaries.filter((summary) => {
    if (normalizedSearchQuery) {
      return (
        summary.organizationName.toLowerCase().includes(normalizedSearchQuery) ||
        String(summary.region || '').toLowerCase().includes(normalizedSearchQuery)
      );
    }
    return true;
  });

  const calculateInviteStats = (summaries: OrganizationInvitationSummary[]) => ({
    total: summaries.reduce((sum, item) => sum + item.invitationCounts.total, 0),
    pending: summaries.reduce((sum, item) => sum + item.invitationCounts.pending, 0),
    accepted: summaries.reduce((sum, item) => sum + item.invitationCounts.accepted, 0),
    expired: summaries.reduce((sum, item) => sum + item.invitationCounts.expired, 0),
    revoked: summaries.reduce((sum, item) => sum + item.invitationCounts.revoked, 0),
  });

  const globalInviteStats = calculateInviteStats(invitationSummaries);
  const hasInvitationFilter = normalizedSearchQuery.length > 0;
  const visibleInviteStats = hasInvitationFilter
    ? calculateInviteStats(filteredInvitationSummaries)
    : globalInviteStats;
  const selectedInviteFacilities = inviteOrgId
    ? facilities.filter((facility) => facility.organizationId === inviteOrgId)
    : [];

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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
          Invitations ({globalInviteStats.total})
          {globalInviteStats.pending > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 rounded-full">
              {globalInviteStats.pending}
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
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage organizations</p>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
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
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {hasInvitationFilter
              ? `Scope: ${filteredInvitationSummaries.length} of ${invitationSummaries.length} organizations (filtered)`
              : 'Scope: All organizations'}
          </p>

          {/* Invite Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide font-medium">Pending</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{visibleInviteStats.pending}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide font-medium">Accepted</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{visibleInviteStats.accepted}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide font-medium">Revoked</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{visibleInviteStats.revoked}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Expired</p>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{visibleInviteStats.expired}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Total Sent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{visibleInviteStats.total}</p>
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
                placeholder="Search by organization or region..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:text-white"
              />
            </div>
            <button
              onClick={() => { setInviteOrgId(''); setInviteFacilityId(''); setInviteEmail(''); setInviteError(''); setQuickInviteOrgId(null); setQuickInviteOrgName(''); setShowInviteAdmin(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              <UserPlus size={16} /> Invite Organization Admin
            </button>
          </div>

          {/* Organization Summary Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {filteredInvitationSummaries.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="mx-auto mb-4 text-gray-300 dark:text-gray-600" size={48} />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  {invitationSummaries.length === 0 ? 'No organization invitation activity yet' : 'No matching organizations'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {invitationSummaries.length === 0 ? 'Create an organization first, then invite its admin.' : 'Try adjusting your search.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Organization</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Region</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Users</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pending</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Accepted</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Revoked</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expired</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Invites</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredInvitationSummaries.map((summary, index) => (
                      <tr key={getOrganizationSummaryKey(summary, index)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{summary.organizationName}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{summary.region || '—'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{summary.userCount}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            {summary.invitationCounts.pending}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {summary.invitationCounts.accepted}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            {summary.invitationCounts.revoked}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {summary.invitationCounts.expired}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{summary.invitationCounts.total}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 dark:text-gray-400">{formatDate(summary.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </>
      )}

      {/* ── Create Organization Modal ── */}
      {showCreateOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateOrg(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowInviteAdmin(false); setQuickInviteOrgId(null); setInviteFacilityId(''); }} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus size={20} />
                {quickInviteOrgName ? `Invite Admin for ${quickInviteOrgName}` : 'Invite Organization Admin'}
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                Send onboarding invite for the tenant's first admin account
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

              {/* Facility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Facility <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Factory className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    value={inviteFacilityId}
                    onChange={(e) => setInviteFacilityId(e.target.value)}
                    disabled={!inviteOrgId || selectedInviteFacilities.length === 0}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:text-white appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {!inviteOrgId ? (
                      <option value="">Select an organization first</option>
                    ) : selectedInviteFacilities.length === 0 ? (
                      <option value="">No facilities configured for this organization</option>
                    ) : (
                      <>
                        <option value="">All facilities / Not specified</option>
                        {selectedInviteFacilities.map((facility) => (
                          <option key={facility.id} value={facility.id}>{facility.name}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  When selected, this becomes the user&apos;s default facility after registration.
                </p>
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
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  This invitation creates an <span className="font-medium">ADMIN</span> account for the selected organization.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowInviteAdmin(false); setQuickInviteOrgId(null); setInviteFacilityId(''); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={sendingInvite} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {sendingInvite ? <><RefreshCw size={16} className="animate-spin" /> Sending...</> : <><Send size={16} /> Send Admin Invite</>}
                </button>
              </div>
            </form>
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
