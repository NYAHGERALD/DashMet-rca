'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import { UserRole } from '@/types/auth';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

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

interface AccessCode {
  id: string;
  code: string;
  role: string;
  isActive: boolean;
  usedCount: number;
  maxUses: number;
  createdAt: string;
}

function AdminOrganizationsContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'organizations' | 'accessCodes'>('organizations');
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

  // Access Code Management States
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [loadingAccessCodes, setLoadingAccessCodes] = useState(false);
  const [showAccessCodeForm, setShowAccessCodeForm] = useState(false);
  const [accessCodeFormData, setAccessCodeFormData] = useState({
    role: 'ADMIN' as UserRole,
    maxUses: 1000,
  });

  // Password confirmation modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  useEffect(() => {
    loadOrganizations();
    if (user?.role === UserRole.SYSTEM_ADMIN) {
      loadAccessCodes();
    }
  }, [user]);

  const loadOrganizations = async () => {
    try {
      const response = await api.get('/organizations');
      // Normalize PascalCase to camelCase for _count fields
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

  const loadAccessCodes = async () => {
    setLoadingAccessCodes(true);
    try {
      const response = await api.get('/access-codes');
      setAccessCodes(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to load access codes:', err);
    } finally {
      setLoadingAccessCodes(false);
    }
  };

  const handleGenerateAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/access-codes', accessCodeFormData);
      setMessage('Access code generated successfully');
      setShowAccessCodeForm(false);
      setAccessCodeFormData({ role: 'ADMIN' as UserRole, maxUses: 1000 });
      loadAccessCodes();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate access code');
    }
  };

  const handleToggleAccessCode = async (id: string) => {
    try {
      await api.patch(`/access-codes/${id}/toggle`);
      setMessage('Access code status updated');
      loadAccessCodes();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update access code');
    }
  };

  const handleDeleteAccessCode = async (id: string) => {
    if (!confirm('Are you sure you want to delete this access code?')) return;

    try {
      await api.delete(`/access-codes/${id}`);
      setMessage('Access code deleted successfully');
      loadAccessCodes();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete access code');
    }
  };

  const generateRandomCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setFormData({ ...formData, signupCode: code });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validate signup code if public
    if (formData.isPublic && !/^\d{6}$/.test(formData.signupCode)) {
      setError('A valid 6-digit signup code is required when making organization visible');
      return;
    }

    try {
      if (editingId) {
        // For editing, show password confirmation modal
        setShowPasswordModal(true);
      } else {
        // For creating new org (SYSTEM_ADMIN only)
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
      // Verify password with Firebase
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('Not authenticated');
      }

      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);

      // Password verified, now update the organization
      const updateData: any = {
        name: formData.name,
        region: formData.region,
        defaultLanguage: formData.defaultLanguage,
        isPublic: formData.isPublic,
        password: password,
      };

      // Only include signupCode if making public
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
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPasswordError('Incorrect password. Please try again.');
      } else if (err.response?.data?.error) {
        setPasswordError(err.response.data.error);
      } else {
        setPasswordError('Failed to verify password. Please try again.');
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Password Confirmation Modal */}
      {showPasswordModal && (
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
                className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {verifyingPassword ? 'Verifying...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <Link
                href="/dashboard"
                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 mb-2 inline-block"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Organizations
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Manage companies and regions
              </p>
            </div>
            {activeTab === 'organizations' && canCreateOrg && (
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
            {activeTab === 'accessCodes' && user?.role === UserRole.SYSTEM_ADMIN && (
              <button
                onClick={() => setShowAccessCodeForm(!showAccessCodeForm)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                + Generate Access Code
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation - Only visible for SYSTEM_ADMIN */}
        {user?.role === UserRole.SYSTEM_ADMIN && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => {
                  setActiveTab('organizations');
                  setShowForm(false);
                  setShowAccessCodeForm(false);
                  setError('');
                  setMessage('');
                }}
                className={`
                  py-4 px-6 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === 'organizations'
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                Organizations
              </button>
              <button
                onClick={() => {
                  setActiveTab('accessCodes');
                  setShowForm(false);
                  setShowAccessCodeForm(false);
                  setError('');
                  setMessage('');
                }}
                className={`
                  py-4 px-6 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === 'accessCodes'
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                Access Codes
              </button>
            </nav>
          </div>
        )}
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

        {/* Access Codes Tab Content */}
        {activeTab === 'accessCodes' && user?.role === UserRole.SYSTEM_ADMIN && (
          <>
            {/* Access Code Generation Form */}
            {showAccessCodeForm && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Generate New Access Code
                </h2>
                <form onSubmit={handleGenerateAccessCode} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Role *
                      </label>
                      <select
                        value={accessCodeFormData.role}
                        onChange={(e) => setAccessCodeFormData({ ...accessCodeFormData, role: e.target.value as UserRole })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="SUPERVISOR">Supervisor</option>
                        <option value="QA_FOOD_SAFETY">QA Food Safety</option>
                        <option value="MAINTENANCE_ENGINEERING">Maintenance Engineering</option>
                        <option value="CI_MANAGER">CI Manager</option>
                        <option value="SAFETY_SECURITY_MANAGER">Safety & Security Manager</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SYSTEM_ADMIN">System Admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Max Uses *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={accessCodeFormData.maxUses}
                        onChange={(e) => setAccessCodeFormData({ ...accessCodeFormData, maxUses: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="1000"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Number of times this code can be used
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                    >
                      Generate Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAccessCodeForm(false)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Access Codes List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              {loadingAccessCodes ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : accessCodes.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No access codes</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by generating a new access code.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Code
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Usage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {accessCodes.map((accessCode) => (
                        <tr key={accessCode.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-mono text-lg font-semibold text-gray-900 dark:text-white tracking-wider">
                              {accessCode.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {accessCode.role.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                            {accessCode.usedCount} / {accessCode.maxUses}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {accessCode.isActive ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                            {new Date(accessCode.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleToggleAccessCode(accessCode.id)}
                              className="text-primary-600 hover:text-primary-900 dark:text-primary-400 mr-4"
                            >
                              {accessCode.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteAccessCode(accessCode.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Organizations Tab Content */}
        {activeTab === 'organizations' && (
          <>
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

              {/* Public Visibility Section */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={formData.isPublic}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setFormData({ 
                        ...formData, 
                        isPublic: isChecked,
                        signupCode: isChecked && !formData.signupCode ? '' : formData.signupCode
                      });
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="isPublic" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Make organization visible for user signup
                  </label>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 ml-8">
                  When enabled, non-admin users can join this organization using a signup code during profile creation
                </p>

                {formData.isPublic && (
                  <div className="mt-4 ml-8">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      6-Digit Signup Code *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.signupCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setFormData({ ...formData, signupCode: value });
                        }}
                        maxLength={6}
                        pattern="\d{6}"
                        required={formData.isPublic}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-lg tracking-widest"
                        placeholder="000000"
                      />
                      <button
                        type="button"
                        onClick={generateRandomCode}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 text-sm"
                      >
                        Generate
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Share this code with users who need to join your organization
                    </p>
                  </div>
                )}
              </div>

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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Language
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Facilities
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Users
                  </th>
                  {canEditOrg && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {org.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {org.region}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {org.defaultLanguage}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {org.isPublic ? (
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            Public
                          </span>
                          {org.signupCode && (
                            <span className="ml-2 text-xs font-mono text-gray-500 dark:text-gray-400">
                              Code: {org.signupCode}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          Private
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {org._count.facilities}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {org._count.users}
                    </td>
                    {canEditOrg && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(org)}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 mr-4"
                        >
                          Edit
                        </button>
                        {canCreateOrg && (
                          <button
                            onClick={() => handleDelete(org.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
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
