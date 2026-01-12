'use client';

import { useState, useEffect } from 'react';
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
  LineChart,
  Line,
} from 'recharts';
import { useAuth } from '@/components/providers/AuthProvider';

interface DashboardStats {
  totalIncidents: number;
  openIncidents: number;
  closedIncidents: number;
  inProgressIncidents: number;
  criticalIncidents: number;
  rcaInProgress: number;
  rcaCompleted: number;
  capaOpen: number;
  capaOverdue: number;
  avgResolutionTime: number;
  trendPercentage: number;
  incidentsTrend: { name: string; date?: string; incidents: number; resolved: number }[];
  incidentsByCategory: { name: string; value: number }[];
  incidentsBySeverity: { name: string; value: number; percentage: number; color: string }[];
  weeklyPerformance: { day: string; created: number; resolved: number }[];
  dataScope?: 'organization' | 'user';
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316', 
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

// Format date in browser's timezone
const formatDateLocal = (isoDate: string | undefined, fallbackName: string): string => {
  if (!isoDate) return fallbackName;
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return fallbackName;
  }
};

export default function DashboardMetrics() {
  const { user, getIdToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchDashboardStats();
  }, [timeRange, user]);

  const fetchDashboardStats = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Unable to get authentication token');
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/incidents/dashboard/stats?timeRange=${timeRange}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchDashboardStats}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  // Transform trend data to use browser timezone for date display
  const trendDataWithLocalDates = stats.incidentsTrend.map(item => ({
    ...item,
    name: formatDateLocal(item.date, item.name),
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Time Range Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            Dashboard Overview
          </h3>
          {stats.dataScope && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              stats.dataScope === 'organization' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            }`}>
              {stats.dataScope === 'organization' ? '🏢 Organization' : '👤 My Incidents'}
            </span>
          )}
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Total Incidents"
          value={stats.totalIncidents}
          icon="📊"
          trend={stats.trendPercentage}
          color="blue"
        />
        <MetricCard
          title="Open Incidents"
          value={stats.openIncidents}
          icon="🔓"
          color="yellow"
        />
        <MetricCard
          title="In Progress"
          value={stats.inProgressIncidents}
          icon="⏳"
          color="purple"
        />
        <MetricCard
          title="Critical"
          value={stats.criticalIncidents}
          icon="🚨"
          color="red"
          highlight
        />
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="RCA In Progress"
          value={stats.rcaInProgress}
          icon="🔍"
          color="indigo"
        />
        <MetricCard
          title="RCA Completed"
          value={stats.rcaCompleted}
          icon="✅"
          color="green"
        />
        <MetricCard
          title="CAPA Open"
          value={stats.capaOpen}
          icon="📋"
          color="orange"
        />
        <MetricCard
          title="Avg Resolution"
          value={`${stats.avgResolutionTime}d`}
          icon="⏱️"
          color="teal"
          subtitle="days"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Incidents Trend Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Incident Trend
          </h4>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendDataWithLocalDates}>
                <defs>
                  <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
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
                <Area
                  type="monotone"
                  dataKey="incidents"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorIncidents)"
                  name="Created"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorResolved)"
                  name="Resolved"
                />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Severity Distribution
          </h4>
          <div className="h-48 sm:h-64 flex flex-col sm:flex-row items-center">
            <div className="w-full sm:w-1/2 h-40 sm:h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.incidentsBySeverity.filter(s => s.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {stats.incidentsBySeverity.filter(s => s.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(31, 41, 55, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: number, name: string) => [`${value} incidents`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 flex flex-row sm:flex-col flex-wrap justify-center gap-2 sm:gap-3 pl-0 sm:pl-4 mt-3 sm:mt-0">
              {stats.incidentsBySeverity.map((entry, index) => (
                <div key={index} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div 
                      className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">{entry.value}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({entry.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Category Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Incidents by Category
          </h4>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.incidentsByCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis type="number" tick={{ fill: '#9ca3af' }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {stats.incidentsByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Weekly Performance
          </h4>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weeklyPerformance}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="day" tick={{ fill: '#9ca3af' }} />
                <YAxis tick={{ fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="created"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316', strokeWidth: 2 }}
                  name="Created"
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: '#22c55e', strokeWidth: 2 }}
                  name="Resolved"
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-4 sm:p-6 text-white">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-center">
          <div>
            <p className="text-xl sm:text-3xl font-bold">{Math.round((stats.closedIncidents / stats.totalIncidents) * 100) || 0}%</p>
            <p className="text-xs sm:text-sm text-primary-100">Resolution Rate</p>
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-bold">{stats.capaOverdue}</p>
            <p className="text-xs sm:text-sm text-primary-100">Overdue CAPAs</p>
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-bold">{stats.rcaInProgress + stats.rcaCompleted}</p>
            <p className="text-xs sm:text-sm text-primary-100">Total RCAs</p>
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-bold">{stats.avgResolutionTime}d</p>
            <p className="text-xs sm:text-sm text-primary-100">Avg Resolution</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: number | string;
  icon: string;
  trend?: number;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'orange' | 'teal';
  highlight?: boolean;
  subtitle?: string;
}

function MetricCard({ title, value, icon, trend, color, highlight, subtitle }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    teal: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
  };

  const iconBgClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/40',
    green: 'bg-green-100 dark:bg-green-900/40',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/40',
    red: 'bg-red-100 dark:bg-red-900/40',
    purple: 'bg-purple-100 dark:bg-purple-900/40',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/40',
    orange: 'bg-orange-100 dark:bg-orange-900/40',
    teal: 'bg-teal-100 dark:bg-teal-900/40',
  };

  return (
    <div
      className={`relative p-3 sm:p-4 rounded-xl border ${colorClasses[color]} ${
        highlight ? 'ring-2 ring-red-400 dark:ring-red-500' : ''
      } transition-all hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-1.5 sm:p-2 rounded-lg ${iconBgClasses[color]}`}>
          <span className="text-lg sm:text-xl">{icon}</span>
        </div>
        {trend !== undefined && (
          <span
            className={`text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${
              trend >= 0
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
            }`}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-2 sm:mt-3">
        <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 line-clamp-1">{title}</p>
      </div>
    </div>
  );
}
