'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: { role: string; count: number }[];
}

const AVAILABLE_ROLES = [
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'QA_FOOD_SAFETY', label: 'QA / Food Safety' },
  { value: 'MAINTENANCE_ENGINEERING', label: 'Maintenance / Engineering' },
  { value: 'CI_MANAGER', label: 'CI / Manager' },
  { value: 'SAFETY_SECURITY_MANAGER', label: 'Safety & Security Manager' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SYSTEM_ADMIN', label: 'System Admin' },
];

function AdminContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingRole, setChangingRole] = useState<string | null>(null);

  useEffect(() => {
    // Redirect SYSTEM_ADMIN to their dedicated portal
    if (user?.role === 'SYSTEM_ADMIN') {
      router.replace('/system-admin');
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/stats'),
      ]);
      setUsers(usersRes.data.data.users);
      setStats(statsRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.patch(`/users/${userId}/activate`, { isActive: !currentStatus });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user status');
    }
  };

  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      setChangingRole(userId);
      await api.patch(`/users/${userId}/role`, { role: newRole });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to change user role');
    } finally {
      setChangingRole(null);
    }
  };

  // Get available roles based on current user's role
  const getAvailableRoles = () => {
    if (user?.role === 'SYSTEM_ADMIN') {
      return AVAILABLE_ROLES;
    }
    // ADMIN can assign all roles except SYSTEM_ADMIN
    return AVAILABLE_ROLES.filter(r => r.value !== 'SYSTEM_ADMIN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="relative w-8 h-8">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <Link href="/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                ← Back
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Admin Panel
              </h1>
            </div>
            <div className="flex items-center">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-danger-100 text-danger-800 dark:bg-danger-900 dark:text-danger-200">
                ADMIN ACCESS
              </span>
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

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active</h3>
              <p className="mt-2 text-3xl font-semibold text-success-600 dark:text-success-400">{stats.active}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Inactive</h3>
              <p className="mt-2 text-3xl font-semibold text-danger-600 dark:text-danger-400">{stats.inactive}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">By Role</h3>
              <div className="space-y-1">
                {stats.byRole.map((r) => (
                  <div key={r.role} className="text-xs text-gray-600 dark:text-gray-400">
                    {r.role}: <span className="font-semibold">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {user?.role === 'SYSTEM_ADMIN' 
                ? 'Manage all users across all organizations' 
                : 'Manage users in your organization'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {u.id !== user?.id && (u.role !== 'SYSTEM_ADMIN' || user?.role === 'SYSTEM_ADMIN') ? (
                        <select
                          value={u.role}
                          onChange={(e) => changeUserRole(u.id, e.target.value)}
                          disabled={changingRole === u.id}
                          className="px-2 py-1 text-xs font-medium rounded-lg bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 border-0 cursor-pointer hover:bg-primary-200 dark:hover:bg-primary-800 focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-wait"
                        >
                          {getAvailableRoles().map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                          {AVAILABLE_ROLES.find(r => r.value === u.role)?.label || u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        u.isActive 
                          ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200'
                          : 'bg-danger-100 text-danger-800 dark:bg-danger-900 dark:text-danger-200'
                      }`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {u.id !== user?.id && (
                        <button
                          onClick={() => toggleUserStatus(u.id, u.isActive)}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute requireAuth={true} allowedRoles={['ADMIN', 'SYSTEM_ADMIN']}>
      <AdminContent />
    </ProtectedRoute>
  );
}
