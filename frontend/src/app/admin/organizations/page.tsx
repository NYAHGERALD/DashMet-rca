'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import { UserRole } from '@/types/auth';
import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';

interface Organization {
  id: string;
  name: string;
  region: string;
  defaultLanguage: string;
  isPublic: boolean;
  signupCode: string | null;
  _count: {
    facilities: number;
    users: number;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

// Role options for invitations
const INVITE_ROLES = [
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'QA_FOOD_SAFETY', label: 'QA / Food Safety' },
  { value: 'QUALITY_CONTROL_MANAGER', label: 'Quality Control Manager' },
  { value: 'MAINTENANCE_ENGINEERING', label: 'Maintenance / Engineering' },
  { value: 'CI_MANAGER', label: 'CI / Manager' },
  { value: 'SAFETY_SECURITY_MANAGER', label: 'Safety & Security Manager' },
];

function AdminOrganizationsContent() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    region: 'USA',
    defaultLanguage: 'ENGLISH',
    isPublic: false,
    signupCode: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Invite user modal state (within org edit)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('SUPERVISOR');
  const [inviteSending, setInviteSending] = useState(false);

  // Recent invitations for the org being edited
  const [orgInvitations, setOrgInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);

  // Password confirmation modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, [user]);

  const loadOrganizations = async () => {
    try {
      const response = await api.get('/organizations');
      const orgsData = response.data.data?.organizations || response.data.data || [];
      const normalizedOrgs = (Array.isArray(orgsData) ? orgsData : []).map((org: any) => ({
        ...org,
        _count: {
          facilities: org._count?.Facility ?? org._count?.facilities ?? 0,
          users: org._count?.User ?? org._count?.users ?? 0,
        },
      }));
      setOrganizations(normalizedOrgs);
    } catch (err: any) {
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const loadOrgInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const response = await api.get('/invitations');
      const allInvitations = response.data.data || [];
      // Show the most recent 5 invitations
      setOrgInvitations(allInvitations.slice(0, 5));
    } catch (err: any) {
      console.error('Failed to load invitations:', err);
      setOrgInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteSending(true);
    setError('');

    try {
      await api.post('/invitations', {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setMessage(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setShowInviteModal(false);
      loadOrgInvitations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setInviteSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (formData.isPublic && !/^\d{6}$/.test(formData.signupCode)) {
      setError('A valid 6-digit signup code is required when making organization visible');
      return;
    }

    try {
      if (editingId) {
        setShowPasswordModal(true);
      } else {
        await api.post('/organizations', formData);
        setMessage('Organization created successfully');
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: '', region: 'USA', defaultLanguage: 'ENGLISH', isPublic: false, signupCode: '' });
        loadOrganizations();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed');
    }
  };

  const handlePasswordConfirm = async () => {
    if (!password.trim()) {
      setPasswordError('Password is required');
      return;
    }

    setVerifyingPassword(true);
    setPasswordError('');

    try {
      await api.post('/auth/verify-password', { password });

      const updateData: any = {
        name: formData.name,
        region: formData.region,
        defaultLanguage: formData.defaultLanguage,
        isPublic: formData.isPublic,
        password,
      };

      if (formData.isPublic) {
        updateData.signupCode = formData.signupCode;
      }

      await api.patch(`/organizations/${editingId}`, updateData);

      setMessage('Organization updated successfully');
      setShowPasswordModal(false);
      setShowForm(false);
      setEditingId(null);
      setPassword('');
      setFormData({ name: '', region: 'USA', defaultLanguage: 'ENGLISH', isPublic: false, signupCode: '' });
      loadOrganizations();
    } catch (err: any) {
      if (err.response?.data?.error) {
        setPasswordError(err.response.data.error);
      } else {
        setPasswordError('Failed to verify identity. Please try again.');
      }
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleEdit = (org: Organization) => {
    setFormData({
      name: org.name,
      region: org.region,
      defaultLanguage: org.defaultLanguage,
      isPublic: org.isPublic || false,
      signupCode: org.signupCode || '',
    });
    setEditingId(org.id);
    setShowForm(true);
    setError('');
    setMessage('');
    setShowInviteModal(false);
    loadOrgInvitations();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this organization?')) return;

    try {
      await api.delete(`/organizations/${id}`);
      setMessage('Organization deleted successfully');
      loadOrganizations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const canCreateOrg = user?.role === UserRole.SYSTEM_ADMIN;
  const canEditOrg = user?.role === UserRole.ADMIN || user?.role === UserRole.SYSTEM_ADMIN;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="relative mb-8">
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary-200 dark:border-primary-900/50" />
          <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-primary-600 border-r-primary-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading organizations...</p>
        <div className="flex items-center gap-1.5 mt-6">
          <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Password/Identity Confirmation Modal */}
      {showPasswordModal && (() => {
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Confirm Your Identity
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Please enter your password to update the organization
                </p>
              </div>

              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  {passwordError}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordConfirm()}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPassword('');
                    setPasswordError('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordConfirm}
                  disabled={verifyingPassword}
                  className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {verifyingPassword ? 'Verifying...' : 'Confirm Update'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Invite Team Member
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Send an email invitation to join your organization
              </p>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="colleague@company.com"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role *
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {INVITE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  The user will receive an email with a secure link to create their account. The invitation expires in 48 hours.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSending || !inviteEmail.trim()}
                  className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {inviteSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Invitation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Organizations
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Manage companies and regions
              </p>
            </div>
            <div className="flex items-center gap-3">
              {canCreateOrg && (
                <button
                  onClick={() => {
                    setShowForm(!showForm);
                    setEditingId(null);
                    setFormData({ name: '', region: 'USA', defaultLanguage: 'ENGLISH', isPublic: false, signupCode: '' });
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  + New Organization
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {message && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Form */}
        {showForm && (canCreateOrg || editingId) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingId ? 'Edit Organization' : 'New Organization'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Acme Corporation"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Region *
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="USA">🇺🇸 USA</option>
                    <option value="MEXICO">🇲🇽 Mexico</option>
                    <option value="CANADA">🇨🇦 Canada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Language *
                  </label>
                  <select
                    value={formData.defaultLanguage}
                    onChange={(e) => setFormData({ ...formData, defaultLanguage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="ENGLISH">🇬🇧 English</option>
                    <option value="SPANISH">🇪🇸 Spanish</option>
                    <option value="FRENCH">🇫🇷 French</option>
                  </select>
                </div>
              </div>

              {/* Invite Team Members Section - Only show when editing */}
              {editingId && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Invite Team Members
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Send email invitations to add users to your organization. Each user receives a secure link to register.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                      Invite User
                    </button>
                  </div>

                  {/* Recent Invitations Preview */}
                  {loadingInvitations ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                    </div>
                  ) : orgInvitations.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">No invitations sent yet</p>
                      <p className="text-xs mt-1">Click &quot;Invite User&quot; to send email invitations to your team</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Email</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Role</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Sent</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                            {orgInvitations.map((inv) => (
                              <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-3 py-2 text-gray-900 dark:text-white">{inv.email}</td>
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                    {inv.role.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                    inv.status === 'ACCEPTED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                    inv.status === 'EXPIRED' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                  }`}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-300 text-xs">
                                  {formatDate(inv.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="text-right pt-2">
                        <Link
                          href="/admin/invitations"
                          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                        >
                          View all invitations →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingId ? 'Update Organization' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setOrgInvitations([]);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>

              {editingId && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  ⚠️ You will be asked to confirm your password before updating
                </p>
              )}
            </form>
          </div>
        )}

        {/* Organizations List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Language
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Facilities
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Users
                  </th>
                  {canEditOrg && (
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {organizations.map((org, index) => (
                  <tr 
                    key={org.id} 
                    className={`
                      hover:bg-primary-50/50 dark:hover:bg-primary-900/10 
                      transition-colors duration-150 ease-in-out
                      ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'}
                    `}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 flex items-center justify-center shadow-sm">
                          <span className="text-white font-bold text-sm">{org.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {org.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {org.region === 'USA' && '🇺🇸 '}
                        {org.region === 'MEXICO' && '🇲🇽 '}
                        {org.region === 'CANADA' && '🇨🇦 '}
                        {org.region}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {org.defaultLanguage === 'ENGLISH' && '🇬🇧 '}
                        {org.defaultLanguage === 'SPANISH' && '🇪🇸 '}
                        {org.defaultLanguage === 'FRENCH' && '🇫🇷 '}
                        {org.defaultLanguage}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{org._count.facilities}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{org._count.users}</span>
                      </div>
                    </td>
                    {canEditOrg && (
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(org)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 rounded-lg transition-colors duration-150"
                          >
                            Edit
                          </button>
                          {canCreateOrg && (
                            <button
                              onClick={() => handleDelete(org.id)}
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-lg transition-colors duration-150"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrganizationsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SYSTEM_ADMIN]}>
      <AdminOrganizationsContent />
    </ProtectedRoute>
  );
}
