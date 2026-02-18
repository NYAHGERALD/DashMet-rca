'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';
import Link from 'next/link';
import Image from 'next/image';
import SlidingSidebar from '@/components/ui/SlidingSidebar';

interface Organization {
  id: string;
  name: string;
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

interface AccessCode {
  id: string;
  code: string;
  role: string;
  isActive: boolean;
  usedCount: number;
  maxUses: number;
  createdAt: string;
}

function SystemAdminContent() {
  const { user, logout } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [editingMaxUses, setEditingMaxUses] = useState<string | null>(null);
  const [newMaxUses, setNewMaxUses] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [orgsRes, statsRes, codesRes] = await Promise.all([
        api.get('/organizations'),
        api.get('/organizations/stats'),
        api.get('/access-codes'),
      ]);
      setOrganizations(orgsRes.data.data.organizations);
      setStats(statsRes.data.data);
      setAccessCodes(codesRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const generateAccessCode = async () => {
    try {
      setGeneratingCode(true);
      setGeneratedCode(null);
      const response = await api.post('/access-codes', {
        role: 'ADMIN',
        maxUses: 1000,
      });
      setGeneratedCode(response.data.data.code);
      // Reload access codes list
      const codesRes = await api.get('/access-codes');
      setAccessCodes(codesRes.data.data || []);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate access code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const toggleAccessCode = async (id: string) => {
    try {
      await api.patch(`/access-codes/${id}/toggle`);
      const codesRes = await api.get('/access-codes');
      setAccessCodes(codesRes.data.data || []);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to toggle access code');
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Access code ${code} copied to clipboard!`);
  };

  const startEditingMaxUses = (code: AccessCode) => {
    setEditingMaxUses(code.id);
    setNewMaxUses(code.maxUses.toString());
  };

  const cancelEditingMaxUses = () => {
    setEditingMaxUses(null);
    setNewMaxUses('');
  };

  const saveMaxUses = async (id: string) => {
    try {
      const parsedValue = parseInt(newMaxUses);
      if (isNaN(parsedValue) || parsedValue < 1) {
        alert('Please enter a valid positive number');
        return;
      }
      await api.patch(`/access-codes/${id}/max-uses`, { maxUses: parsedValue });
      const codesRes = await api.get('/access-codes');
      setAccessCodes(codesRes.data.data || []);
      setEditingMaxUses(null);
      setNewMaxUses('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update max uses');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="relative mb-8">
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary-200 dark:border-primary-900/50" />
          <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-primary-600 border-r-primary-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading system admin...</p>
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
      {/* Left Sidebar - Quick Navigation */}
      <SlidingSidebar
        title="Quick Navigation"
        position="left"
        links={[
          { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
          { href: '/system-admin', icon: '🏢', label: 'System Admin Portal' },
          { href: '/settings', icon: '⚙️', label: 'Settings' },
        ]}
      />

      {/* Right Sidebar - System Management */}
      <SlidingSidebar
        title="System Management"
        position="right"
        links={[
          { href: '/admin/policies', icon: '📄', label: 'Policies Management' },
          { href: '/admin/support', icon: '📨', label: 'Support Requests' },
          { href: '/support-inbox', icon: '📬', label: 'Support Inbox' },
        ]}
      />

      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="relative w-8 h-8">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                System Administration
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                SYSTEM ADMIN ACCESS
              </span>
              <button
                onClick={() => logout('/dashmet-control/login')}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
            <p className="text-sm text-danger-800 dark:text-danger-200">{error}</p>
          </div>
        )}

        {/* Security Notice */}
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start">
            <span className="text-amber-500 text-xl mr-3">🔒</span>
            <div>
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Security Notice</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                As a System Admin, you can view and manage organizations. For security reasons, you cannot access individual user data, incidents, or RCA analyses within organizations.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Organizations</h3>
              <p className="mt-2 text-3xl font-semibold text-purple-600 dark:text-purple-400">{stats.totalOrganizations}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{stats.totalUsers}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Aggregated count only</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Facilities</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{stats.totalFacilities}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Incidents</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{stats.totalIncidents}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Aggregated count only</p>
            </div>
          </div>
        )}

        {/* Access Code Generator Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">🔑 Access Code Generator</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Generate 6-digit access codes for new Admin users
                </p>
              </div>
              <button
                onClick={generateAccessCode}
                disabled={generatingCode}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait transition-colors flex items-center gap-2"
              >
                {generatingCode ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <span>🎲</span>
                    Generate Admin Code
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Code Display */}
          {generatedCode && (
            <div className="px-6 py-4 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">✅ New Access Code Generated!</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-3xl font-mono font-bold text-green-700 dark:text-green-300 tracking-wider">
                      {generatedCode}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                      ADMIN
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(generatedCode)}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  📋 Copy Code
                </button>
              </div>
            </div>
          )}

          {/* Access Codes Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {accessCodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No access codes yet. Click "Generate Admin Code" to create one.
                    </td>
                  </tr>
                ) : (
                  accessCodes.map((code) => (
                    <tr key={code.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-lg font-semibold text-gray-900 dark:text-white tracking-wider">
                          {code.code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(code.code)}
                          className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Copy code"
                        >
                          📋
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          code.role === 'SYSTEM_ADMIN' 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200'
                        }`}>
                          {code.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          code.isActive 
                            ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200'
                            : 'bg-danger-100 text-danger-800 dark:bg-danger-900 dark:text-danger-200'
                        }`}>
                          {code.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {editingMaxUses === code.id ? (
                          <div className="flex items-center gap-2">
                            <span>{code.usedCount} /</span>
                            <input
                              type="number"
                              min="1"
                              value={newMaxUses}
                              onChange={(e) => setNewMaxUses(e.target.value)}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              autoFocus
                            />
                            <button
                              onClick={() => saveMaxUses(code.id)}
                              className="text-success-600 hover:text-success-800 dark:text-success-400"
                              title="Save"
                            >
                              ✓
                            </button>
                            <button
                              onClick={cancelEditingMaxUses}
                              className="text-danger-600 hover:text-danger-800 dark:text-danger-400"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{code.usedCount} / {code.maxUses}</span>
                            <button
                              onClick={() => startEditingMaxUses(code)}
                              className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                              title="Edit max uses"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(code.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {code.role !== 'SYSTEM_ADMIN' && (
                          <button
                            onClick={() => toggleAccessCode(code.id)}
                            className={`text-sm font-medium ${
                              code.isActive 
                                ? 'text-danger-600 hover:text-danger-900 dark:text-danger-400'
                                : 'text-success-600 hover:text-success-900 dark:text-success-400'
                            }`}
                          >
                            {code.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        {code.role === 'SYSTEM_ADMIN' && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Protected</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Organizations Table */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Organizations</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              View and manage all registered organizations in the system
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Facilities</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Incidents</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {organizations.map((org) => (
                  <tr key={org.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{org.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">ID: {org.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">{org._count.User}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">{org._count.Facility}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">{org._count.Incident}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(org.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Restricted Actions Notice */}
        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Restricted Actions for Security</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• User management is handled by organization admins</li>
            <li>• Incident creation and RCA analysis are organization-level features</li>
            <li>• User personal data and incident details are protected</li>
          </ul>
        </div>
      </main>
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
