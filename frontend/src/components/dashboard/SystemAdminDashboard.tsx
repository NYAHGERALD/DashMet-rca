'use client';

import { useState, useEffect } from 'react';
import LoadingState from '@/components/ui/LoadingState';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import { useSettingsModal } from '@/components/settings/SettingsModalProvider';

interface SystemAdminStats {
  // Platform overview
  totalOrganizations: number;
  activeOrganizations: number;
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  
  // Support
  openSupportRequests: number;
  totalSupportRequests: number;
  avgResponseTime: number;
  
  // Access codes
  totalAccessCodes: number;
  usedAccessCodes: number;
  
  // Trends
  userGrowth: { name: string; users: number; orgs: number }[];
  organizationsByStatus: { name: string; value: number }[];
  supportRequestsByCategory: { name: string; value: number }[];
  usersByRole: { name: string; value: number }[];
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function SystemAdminDashboard() {
  const { user, getIdToken } = useAuth();
  const { openSettings } = useSettingsModal();
  const [stats, setStats] = useState<SystemAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemAdminStats();
  }, [user]);

  const fetchSystemAdminStats = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Unable to get authentication token');
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/system-admin/dashboard/stats`,
        {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) {
        // If endpoint doesn't exist yet, use mock data
        if (response.status === 404) {
          setStats(getMockStats());
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch system admin stats');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        setStats(getMockStats());
      }
    } catch (err) {
      console.error('Error fetching system admin stats:', err);
      // Use mock data on error
      setStats(getMockStats());
    } finally {
      setLoading(false);
    }
  };

  // Mock data for initial implementation
  const getMockStats = (): SystemAdminStats => ({
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalUsers: 0,
    activeUsers: 0,
    newUsersThisMonth: 0,
    openSupportRequests: 0,
    totalSupportRequests: 0,
    avgResponseTime: 0,
    totalAccessCodes: 0,
    usedAccessCodes: 0,
    userGrowth: [],
    organizationsByStatus: [],
    supportRequestsByCategory: [],
    usersByRole: [],
  });

  if (loading) {
    return <LoadingState message="Loading system dashboard..." icon="data" color="purple" fullScreen={false} />;
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchSystemAdminStats}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            🏢 System Administration Dashboard
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Platform-wide overview and management
          </p>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Organizations Card */}
        <Link href="/system-admin" className="block">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Organizations</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.totalOrganizations}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {stats.activeOrganizations} active
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl sm:text-2xl">
                🏢
              </div>
            </div>
          </div>
        </Link>

        {/* Users Card */}
        <Link href="/system-admin" className="block">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.totalUsers}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  +{stats.newUsersThisMonth} this month
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xl sm:text-2xl">
                👥
              </div>
            </div>
          </div>
        </Link>

        {/* Support Requests Card */}
        <Link href="/admin/support" className="block">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Support Requests</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.openSupportRequests}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  open requests
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xl sm:text-2xl">
                📨
              </div>
            </div>
          </div>
        </Link>

        {/* Access Codes Card */}
        <Link href="/system-admin" className="block">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Access Codes</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.totalAccessCodes}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  {stats.usedAccessCodes} used
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xl sm:text-2xl">
                🔑
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* User Growth Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Platform Growth Trend
          </h4>
          <div className="h-48 sm:h-64">
            {stats.userGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.userGrowth}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOrgs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fill: '#9ca3af' }} />
                  <YAxis className="text-xs" tick={{ fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(31, 41, 55, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorUsers)"
                    name="Users"
                  />
                  <Area
                    type="monotone"
                    dataKey="orgs"
                    stroke="#22c55e"
                    fillOpacity={1}
                    fill="url(#colorOrgs)"
                    name="Organizations"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <span className="text-4xl mb-2 block">📊</span>
                  <p className="text-sm">Growth data will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Users by Role Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Users by Role Distribution
          </h4>
          <div className="h-48 sm:h-64">
            {stats.usersByRole.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.usersByRole}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.usersByRole.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(31, 41, 55, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <span className="text-4xl mb-2 block">👥</span>
                  <p className="text-sm">Role distribution will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Support Requests by Category */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Support Requests by Category
          </h4>
          <div className="h-48 sm:h-64">
            {stats.supportRequestsByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.supportRequestsByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis type="number" className="text-xs" tick={{ fill: '#9ca3af' }} />
                  <YAxis dataKey="name" type="category" className="text-xs" tick={{ fill: '#9ca3af' }} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(31, 41, 55, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <span className="text-4xl mb-2 block">📨</span>
                  <p className="text-sm">Support requests will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Organizations by Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Organizations by Status
          </h4>
          <div className="h-48 sm:h-64">
            {stats.organizationsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.organizationsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {stats.organizationsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(31, 41, 55, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <span className="text-4xl mb-2 block">🏢</span>
                  <p className="text-sm">Organization status will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
          Quick Actions
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/system-admin"
            className="flex flex-col items-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <span className="text-2xl mb-2">🏢</span>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Manage Organizations</span>
          </Link>
          <Link
            href="/admin/support"
            className="flex flex-col items-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <span className="text-2xl mb-2">📨</span>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">View Support Requests</span>
          </Link>
          <Link
            href="/admin/policies"
            className="flex flex-col items-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
          >
            <span className="text-2xl mb-2">📄</span>
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Manage Policies</span>
          </Link>
          <button
            onClick={() => openSettings()}
            className="flex flex-col items-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-2xl mb-2">⚙️</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">System Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
