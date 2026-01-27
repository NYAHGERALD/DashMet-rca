'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import { UserRole } from '@/types/auth';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import { formatDate } from '@/lib/dateUtils';
import { EmailAuthProvider, reauthenticateWithCredential, GoogleAuthProvider, OAuthProvider, reauthenticateWithPopup } from 'firebase/auth';

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

interface OrganizationAccessCode {
  id: string;
  code: string;
  role: string;
  isActive: boolean;
  usedCount: number;
  maxUses: number;
  createdAt: string;
  CreatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

// Role options for organization access codes (excludes Admin and System Admin)
const ORG_ACCESS_CODE_ROLES = [
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'QA_FOOD_SAFETY', label: 'QA / Food Safety' },
  { value: 'QUALITY_CONTROL_MANAGER', label: 'Quality Control Manager' },
  { value: 'MAINTENANCE_ENGINEERING', label: 'Maintenance / Engineering' },
  { value: 'CI_MANAGER', label: 'CI / Manager' },
  { value: 'SAFETY_SECURITY_MANAGER', label: 'Safety & Security Manager' },
];

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

  // System-wide Access Code Management States (SYSTEM_ADMIN only)
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [loadingAccessCodes, setLoadingAccessCodes] = useState(false);
  const [showAccessCodeForm, setShowAccessCodeForm] = useState(false);
  const [accessCodeFormData, setAccessCodeFormData] = useState({
    role: 'ADMIN' as UserRole,
    maxUses: 1000,
  });

  // Organization-specific Access Code Management States
  const [orgAccessCodes, setOrgAccessCodes] = useState<OrganizationAccessCode[]>([]);
  const [loadingOrgAccessCodes, setLoadingOrgAccessCodes] = useState(false);
  const [showOrgAccessCodeForm, setShowOrgAccessCodeForm] = useState(false);
  const [orgAccessCodeFormData, setOrgAccessCodeFormData] = useState({
    role: 'SUPERVISOR',
    maxUses: 100,
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

  // Organization-specific access code handlers
  const loadOrgAccessCodes = async (orgId: string) => {
    setLoadingOrgAccessCodes(true);
    try {
      const response = await api.get(`/organizations/${orgId}/access-codes`);
      setOrgAccessCodes(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to load organization access codes:', err);
      setOrgAccessCodes([]);
    } finally {
      setLoadingOrgAccessCodes(false);
    }
  };

  const handleGenerateOrgAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    
    setError('');
    setMessage('');

    try {
      await api.post(`/organizations/${editingId}/access-codes`, orgAccessCodeFormData);
      setMessage('Role-specific access code generated successfully');
      setShowOrgAccessCodeForm(false);
      setOrgAccessCodeFormData({ role: 'SUPERVISOR', maxUses: 100 });
      loadOrgAccessCodes(editingId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate access code');
    }
  };

  const handleToggleOrgAccessCode = async (codeId: string) => {
    if (!editingId) return;
    
    try {
      await api.patch(`/organizations/${editingId}/access-codes/${codeId}/toggle`);
      setMessage('Access code status updated');
      loadOrgAccessCodes(editingId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update access code');
    }
  };

  const handleDeleteOrgAccessCode = async (codeId: string) => {
    if (!editingId) return;
    if (!confirm('Are you sure you want to delete this access code?')) return;

    try {
      await api.delete(`/organizations/${editingId}/access-codes/${codeId}`);
      setMessage('Access code deleted successfully');
      loadOrgAccessCodes(editingId);
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
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setPasswordError('Not authenticated');
      return;
    }

    // Check if user signed in with SSO (Google or Microsoft)
    const providerData = currentUser.providerData;
    const isGoogleUser = providerData.some(p => p.providerId === 'google.com');
    const isMicrosoftUser = providerData.some(p => p.providerId === 'microsoft.com');
    const isSSOUser = isGoogleUser || isMicrosoftUser;

    // For password users, validate password is provided
    if (!isSSOUser && !password.trim()) {
      setPasswordError('Password is required');
      return;
    }

    setVerifyingPassword(true);
    setPasswordError('');

    try {
      // Reauthenticate based on provider type
      if (isGoogleUser) {
        const googleProvider = new GoogleAuthProvider();
        await reauthenticateWithPopup(currentUser, googleProvider);
      } else if (isMicrosoftUser) {
        const microsoftProvider = new OAuthProvider('microsoft.com');
        await reauthenticateWithPopup(currentUser, microsoftProvider);
      } else {
        // Email/password user
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
      }

      // Identity verified, now update the organization
      const updateData: any = {
        name: formData.name,
        region: formData.region,
        defaultLanguage: formData.defaultLanguage,
        isPublic: formData.isPublic,
        // For SSO users, send ssoVerified flag; for password users, send password
        ...(isSSOUser ? { ssoVerified: true } : { password: password }),
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
      } else if (err.code === 'auth/popup-closed-by-user') {
        setPasswordError('Authentication cancelled. Please try again.');
      } else if (err.code === 'auth/user-mismatch') {
        setPasswordError('You must sign in with the same account.');
      } else if (err.response?.data?.error) {
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
    setShowOrgAccessCodeForm(false);
    setOrgAccessCodeFormData({ role: 'SUPERVISOR', maxUses: 100 });
    // Load organization's access codes
    loadOrgAccessCodes(org.id);
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
      {/* Password/Identity Confirmation Modal */}
      {showPasswordModal && (() => {
        const currentUser = auth.currentUser;
        const providerData = currentUser?.providerData || [];
        const isGoogleUser = providerData.some(p => p.providerId === 'google.com');
        const isMicrosoftUser = providerData.some(p => p.providerId === 'microsoft.com');
        const isSSOUser = isGoogleUser || isMicrosoftUser;
        const ssoProvider = isGoogleUser ? 'Google' : isMicrosoftUser ? 'Microsoft' : '';

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 ${isSSOUser ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-amber-100 dark:bg-amber-900/30'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  {isSSOUser ? (
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Confirm Your Identity
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {isSSOUser 
                    ? `Click below to verify with your ${ssoProvider} account`
                    : 'Please enter your password to update the organization'
                  }
                </p>
              </div>

              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  {passwordError}
                </div>
              )}

              {!isSSOUser && (
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
              )}

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
                  className={`flex-1 px-4 py-3 ${isSSOUser ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary-600 hover:bg-primary-700'} text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2`}
                >
                  {verifyingPassword ? 'Verifying...' : isSSOUser ? (
                    <>
                      {isGoogleUser && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      {isMicrosoftUser && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
                        </svg>
                      )}
                      Verify with {ssoProvider}
                    </>
                  ) : 'Confirm Update'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                            {formatDate(accessCode.createdAt)}
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

              {/* Role-Specific Access Codes Section - Only show when editing */}
              {editingId && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Role-Specific Access Codes
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Generate unique 6-digit codes for each role. Users joining with a code will be automatically assigned that role.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOrgAccessCodeForm(!showOrgAccessCodeForm)}
                      className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
                    >
                      + Generate Code
                    </button>
                  </div>

                  {/* Generate New Code Form */}
                  {showOrgAccessCodeForm && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Role *
                          </label>
                          <select
                            value={orgAccessCodeFormData.role}
                            onChange={(e) => setOrgAccessCodeFormData({ ...orgAccessCodeFormData, role: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          >
                            {ORG_ACCESS_CODE_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Max Uses
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={orgAccessCodeFormData.maxUses}
                            onChange={(e) => setOrgAccessCodeFormData({ ...orgAccessCodeFormData, maxUses: parseInt(e.target.value) || 1 })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <button
                            type="button"
                            onClick={handleGenerateOrgAccessCode}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            Generate
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowOrgAccessCodeForm(false)}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Access Codes List */}
                  {loadingOrgAccessCodes ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                    </div>
                  ) : orgAccessCodes.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <p className="text-sm">No access codes generated yet</p>
                      <p className="text-xs mt-1">Click &quot;Generate Code&quot; to create role-specific access codes</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Code</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Role</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Usage</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                          {orgAccessCodes.map((code) => (
                            <tr key={code.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="px-3 py-2">
                                <span className="font-mono font-semibold text-gray-900 dark:text-white tracking-wider">
                                  {code.code}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  {ORG_ACCESS_CODE_ROLES.find(r => r.value === code.role)?.label || code.role.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                                {code.usedCount} / {code.maxUses}
                              </td>
                              <td className="px-3 py-2">
                                {code.isActive ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                    Inactive
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleToggleOrgAccessCode(code.id)}
                                  className="text-primary-600 hover:text-primary-900 dark:text-primary-400 mr-3 text-xs"
                                >
                                  {code.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOrgAccessCode(code.id)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 text-xs"
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
                    setOrgAccessCodes([]);
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
