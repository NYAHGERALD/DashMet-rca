'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { formatDate } from '@/lib/dateUtils';
import { 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Activity,
  FileWarning,
  ShieldCheck,
  Timer,
  BarChart3,
  PieChartIcon,
  Calendar
} from 'lucide-react';

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

const CATEGORY_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6'];

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316', 
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

// Format date in browser's timezone using centralized utility
const formatDateLocal = (isoDate: string | undefined, fallbackName: string): string => {
  if (!isoDate) return fallbackName;
  try {
    return formatDate(isoDate, { month: 'short', day: 'numeric' });
  } catch {
    return fallbackName;
  }
};

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 1000, start: boolean = true) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, start]);
  
  return count;
}

export default function DashboardMetrics() {
  const { user, getIdToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Transform trend data to use browser timezone for date display
  const trendDataWithLocalDates = useMemo(() => {
    if (!stats) return [];
    return stats.incidentsTrend.map(item => ({
      ...item,
      name: formatDateLocal(item.date, item.name),
    }));
  }, [stats]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        
        {/* Loading Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
        
        {/* Loading Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-80 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="backdrop-blur-xl bg-red-50/80 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
        <button
          onClick={fetchDashboardStats}
          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg shadow-red-500/25"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Enhanced Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur-lg opacity-50 animate-pulse" />
            <div className="relative p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
              Dashboard Overview
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Real-time quality metrics & insights</p>
          </div>
          {stats.dataScope && (
            <span className={`px-3 py-1 text-xs font-semibold rounded-full backdrop-blur-md ${
              stats.dataScope === 'organization' 
                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20' 
                : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
            }`}>
              {stats.dataScope === 'organization' ? '🏢 Organization' : '👤 My Incidents'}
            </span>
          )}
        </div>
        
        {/* Time Range Selector - Pill Style */}
        <div className="flex p-1 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-gray-700/50">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`relative px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
                timeRange === range
                  ? 'text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {timeRange === range && (
                <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg animate-scale-in" />
              )}
              <span className="relative z-10">
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid - Enhanced with Glassmorphism */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Incidents"
          value={stats.totalIncidents}
          icon={FileWarning}
          trend={stats.trendPercentage}
          color="blue"
          delay={0}
          mounted={mounted}
          subtitle="All time"
        />
        <MetricCard
          title="Open Incidents"
          value={stats.openIncidents}
          icon={AlertCircle}
          color="amber"
          delay={1}
          mounted={mounted}
          subtitle="Require attention"
        />
        <MetricCard
          title="In Progress"
          value={stats.inProgressIncidents}
          icon={Clock}
          color="violet"
          delay={2}
          mounted={mounted}
          subtitle="Being worked on"
        />
        <MetricCard
          title="Critical"
          value={stats.criticalIncidents}
          icon={Activity}
          color="rose"
          delay={3}
          mounted={mounted}
          highlight
          subtitle="High priority"
        />
        <MetricCard
          title="RCA In Progress"
          value={stats.rcaInProgress}
          icon={SearchIcon}
          color="indigo"
          delay={4}
          mounted={mounted}
          subtitle="Under analysis"
        />
        <MetricCard
          title="RCA Completed"
          value={stats.rcaCompleted}
          icon={CheckCircle2}
          color="emerald"
          delay={5}
          mounted={mounted}
          subtitle="Root cause found"
        />
        <MetricCard
          title="CAPA Open"
          value={stats.capaOpen}
          icon={ShieldCheck}
          color="orange"
          delay={6}
          mounted={mounted}
          subtitle="Pending actions"
        />
        <MetricCard
          title="Avg Resolution"
          value={`${stats.avgResolutionTime}d`}
          icon={Timer}
          color="cyan"
          delay={7}
          mounted={mounted}
          subtitle="Days average"
        />
      </div>

      {/* Charts Row 1 - Enhanced */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Incident Trend Chart */}
        <ChartCard 
          title="Incident Trend" 
          icon={TrendingUp}
          subtitle="Created vs Resolved over time"
          delay={0}
          mounted={mounted}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendDataWithLocalDates} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-700" opacity={0.5} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: 'currentColor', fontSize: 11 }} 
                  className="text-gray-400 dark:text-gray-500"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: 'currentColor', fontSize: 11 }} 
                  className="text-gray-400 dark:text-gray-500"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                />
                <Area
                  type="monotone"
                  dataKey="incidents"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorIncidents)"
                  name="Created"
                  animationDuration={1500}
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stroke="#22c55e"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorResolved)"
                  name="Resolved"
                  animationDuration={1500}
                  animationDelay={300}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Severity Distribution */}
        <ChartCard 
          title="Severity Distribution" 
          icon={PieChartIcon}
          subtitle="Breakdown by incident severity"
          delay={1}
          mounted={mounted}
        >
          <div className="h-64 flex flex-col sm:flex-row items-center">
            <div className="w-full sm:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.incidentsBySeverity.filter(s => s.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1200}
                  >
                    {stats.incidentsBySeverity.filter(s => s.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 flex flex-row sm:flex-col flex-wrap justify-center gap-3 pl-0 sm:pl-4 mt-4 sm:mt-0">
              {stats.incidentsBySeverity.map((entry, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors duration-200"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full shadow-lg" 
                      style={{ backgroundColor: entry.color, boxShadow: `0 0 10px ${entry.color}40` }}
                    />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{entry.value}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">({entry.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <ChartCard 
          title="Incidents by Category" 
          icon={BarChart3}
          subtitle="Distribution across categories"
          delay={2}
          mounted={mounted}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.incidentsByCategory} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-700" opacity={0.3} horizontal={false} />
                <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  tick={{ fill: 'currentColor', fontSize: 11 }} 
                  className="text-gray-500 dark:text-gray-400"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} animationDuration={1500}>
                  {stats.incidentsByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Weekly Performance */}
        <ChartCard 
          title="Weekly Performance" 
          icon={Calendar}
          subtitle="Created vs Resolved this week"
          delay={3}
          mounted={mounted}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weeklyPerformance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-700" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="created"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ fill: '#f97316', strokeWidth: 2, r: 4, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  name="Created"
                  animationDuration={1500}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{ fill: '#22c55e', strokeWidth: 2, r: 4, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  name="Resolved"
                  animationDuration={1500}
                  animationDelay={300}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Enhanced Quick Stats Footer */}
      <div 
        className={`relative overflow-hidden rounded-2xl transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{ transitionDelay: '500ms' }}
      >
        {/* Background gradient with animation */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-white/10 to-blue-600/0 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
        
        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-4 left-10 w-2 h-2 bg-white/20 rounded-full animate-float" style={{ animationDelay: '0s' }} />
          <div className="absolute top-8 right-20 w-3 h-3 bg-white/10 rounded-full animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-6 left-1/4 w-2 h-2 bg-white/15 rounded-full animate-float" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="relative px-6 py-6 sm:py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <StatFooterItem 
              value={Math.round((stats.closedIncidents / (stats.totalIncidents || 1)) * 100)}
              label="Resolution Rate"
              suffix="%"
              delay={0}
            />
            <StatFooterItem 
              value={stats.capaOverdue}
              label="Overdue CAPAs"
              suffix=""
              alert={stats.capaOverdue > 0}
              delay={1}
            />
            <StatFooterItem 
              value={stats.rcaInProgress + stats.rcaCompleted}
              label="Total RCAs"
              suffix=""
              delay={2}
            />
            <StatFooterItem 
              value={stats.avgResolutionTime}
              label="Avg Resolution"
              suffix="d"
              delay={3}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Metric Card Component
interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  trend?: number;
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'indigo' | 'orange' | 'cyan';
  highlight?: boolean;
  subtitle?: string;
  delay: number;
  mounted: boolean;
}

function MetricCard({ title, value, icon: Icon, trend, color, highlight, subtitle, delay, mounted }: MetricCardProps) {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  const animatedValue = useAnimatedCounter(isNaN(numericValue) ? 0 : numericValue, 1200, mounted);
  const displayValue = typeof value === 'string' && value.includes('d') 
    ? `${animatedValue}d` 
    : animatedValue;

  const colorThemes = {
    blue: {
      bg: 'from-blue-500/10 via-blue-500/5 to-transparent',
      border: 'border-blue-200/50 dark:border-blue-700/30',
      iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
      glow: 'shadow-blue-500/20',
      gradient: 'from-blue-500 to-cyan-500',
    },
    emerald: {
      bg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
      border: 'border-emerald-200/50 dark:border-emerald-700/30',
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      glow: 'shadow-emerald-500/20',
      gradient: 'from-emerald-500 to-teal-500',
    },
    amber: {
      bg: 'from-amber-500/10 via-amber-500/5 to-transparent',
      border: 'border-amber-200/50 dark:border-amber-700/30',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      glow: 'shadow-amber-500/20',
      gradient: 'from-amber-500 to-orange-500',
    },
    rose: {
      bg: 'from-rose-500/10 via-rose-500/5 to-transparent',
      border: 'border-rose-200/50 dark:border-rose-700/30',
      iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',
      iconColor: 'text-rose-600 dark:text-rose-400',
      glow: 'shadow-rose-500/20',
      gradient: 'from-rose-500 to-pink-500',
    },
    violet: {
      bg: 'from-violet-500/10 via-violet-500/5 to-transparent',
      border: 'border-violet-200/50 dark:border-violet-700/30',
      iconBg: 'bg-violet-500/10 dark:bg-violet-500/20',
      iconColor: 'text-violet-600 dark:text-violet-400',
      glow: 'shadow-violet-500/20',
      gradient: 'from-violet-500 to-purple-500',
    },
    indigo: {
      bg: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
      border: 'border-indigo-200/50 dark:border-indigo-700/30',
      iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      glow: 'shadow-indigo-500/20',
      gradient: 'from-indigo-500 to-blue-500',
    },
    orange: {
      bg: 'from-orange-500/10 via-orange-500/5 to-transparent',
      border: 'border-orange-200/50 dark:border-orange-700/30',
      iconBg: 'bg-orange-500/10 dark:bg-orange-500/20',
      iconColor: 'text-orange-600 dark:text-orange-400',
      glow: 'shadow-orange-500/20',
      gradient: 'from-orange-500 to-red-500',
    },
    cyan: {
      bg: 'from-cyan-500/10 via-cyan-500/5 to-transparent',
      border: 'border-cyan-200/50 dark:border-cyan-700/30',
      iconBg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      glow: 'shadow-cyan-500/20',
      gradient: 'from-cyan-500 to-blue-500',
    },
  };

  const theme = colorThemes[color];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl backdrop-blur-xl bg-gradient-to-br ${theme.bg} border ${theme.border} 
        transition-all duration-500 hover:scale-[1.02] hover:shadow-xl ${theme.glow}
        ${highlight ? 'ring-2 ring-rose-400/50 dark:ring-rose-500/50' : ''}
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay * 75}ms` }}
    >
      {/* Animated gradient border on hover */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm -z-10`} />
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>

      <div className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-xl ${theme.iconBg} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
            <Icon className={`w-5 h-5 ${theme.iconColor}`} />
          </div>
          
          {trend !== undefined && (
            <span
              className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm ${
                trend >= 0
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              {trend >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingUp className="w-3 h-3 rotate-180" />
              )}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        
        <div className="mt-4">
          <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            {displayValue}
          </p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">{title}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Chart Card Component
interface ChartCardProps {
  title: string;
  icon: React.ElementType;
  subtitle?: string;
  children: React.ReactNode;
  delay: number;
  mounted: boolean;
}

function ChartCard({ title, icon: Icon, subtitle, children, delay, mounted }: ChartCardProps) {
  return (
    <div 
      className={`group relative overflow-hidden rounded-2xl backdrop-blur-xl 
        bg-white/70 dark:bg-gray-800/70 
        border border-gray-200/50 dark:border-gray-700/50 
        shadow-sm hover:shadow-xl transition-all duration-500
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay * 100 + 300}ms` }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="relative p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/10">
            <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h4>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// Footer Stat Item
function StatFooterItem({ value, label, suffix, alert, delay }: { 
  value: number; 
  label: string; 
  suffix: string;
  alert?: boolean;
  delay: number;
}) {
  const animatedValue = useAnimatedCounter(value, 1500, true);
  
  return (
    <div 
      className="relative group"
      style={{ animationDelay: `${delay * 100}ms` }}
    >
      <div className={`text-3xl sm:text-4xl font-bold ${alert ? 'text-rose-200' : 'text-white'}`}>
        {animatedValue}{suffix}
      </div>
      <p className="text-xs sm:text-sm text-blue-100 mt-1 font-medium">{label}</p>
      
      {/* Hover glow */}
      <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl" />
    </div>
  );
}

// Custom Tooltip for Charts
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-xl p-4 shadow-2xl">
        <p className="text-gray-300 text-sm mb-2 font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-400 text-sm">{entry.name}:</span>
            <span className="text-white font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// Pie Chart Tooltip
function PieTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-xl p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: data.payload.color }}
          />
          <span className="text-gray-300 text-sm">{data.name}:</span>
          <span className="text-white font-bold">{data.value} incidents</span>
        </div>
      </div>
    );
  }
  return null;
}

// Bar Chart Tooltip
function BarTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-xl p-3 shadow-2xl">
        <p className="text-gray-300 text-sm mb-1">{label}</p>
        <p className="text-white font-bold">{payload[0].value} incidents</p>
      </div>
    );
  }
  return null;
}

// Search Icon Component
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
