'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatDate } from '@/lib/dateUtils';
import api from '@/lib/api';
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
  Calendar,
  ClipboardList,
  Wrench,
  Mic,
  HardHat,
  Users,
  Target,
  Sparkles,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface IncidentStats {
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

interface CapaStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
  effectiveness?: { reviewed: number; effective: number; rate: number; avgScore: number };
}

interface AggregatedData {
  incidents: IncidentStats | null;
  capa: CapaStats | null;
  myTasks: { total: number; overdue: number; dueToday: number; dueThisWeek: number; completed: number; byStatus: { name: string; value: number; color: string }[]; byPriority: { name: string; value: number; color: string }[] } | null;
  workOrders: { total: number; byStatus: { name: string; value: number; color: string }[]; overdue: number; completedThisMonth: number } | null;
  fmir: { total: number; byStatus: { name: string; value: number; color: string }[]; recent: number } | null;
  safety: { total: number; completed: number; inProgress: number; overdue: number } | null;
  meetings: { total: number; thisWeek: number; upcoming: number; byType: { name: string; value: number }[] } | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6'];

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#3b82f6',
  PENDING: '#f59e0b',
  IN_PROGRESS: '#8b5cf6',
  UNDER_INVESTIGATION: '#8b5cf6',
  SUBMITTED: '#06b6d4',
  COMPLETED: '#22c55e',
  VERIFIED: '#10b981',
  RESOLVED: '#22c55e',
  CLOSED: '#6b7280',
  CANCELLED: '#9ca3af',
  DRAFT: '#94a3b8',
  OVERDUE: '#ef4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
  URGENT: '#dc2626',
};

// =============================================================================
// HELPERS
// =============================================================================

const formatDateLocal = (isoDate: string | undefined, fallbackName: string): string => {
  if (!isoDate) return fallbackName;
  try {
    return formatDate(isoDate, { month: 'short', day: 'numeric' });
  } catch {
    return fallbackName;
  }
};

function useAnimatedCounter(end: number, duration: number = 1000, start: boolean = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    let frame: number;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(eased * end));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [end, duration, start]);
  return count;
}

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// =============================================================================
// AGGREGATORS (client-side)
// =============================================================================

function aggregateTasks(tasks: any[], userId: string) {
  const now = new Date();
  const today = startOfDay(now);
  const endOfWeek = addDays(today, 7);

  const mine = tasks.filter((t) => {
    if (t.ownerId === userId || t.assigneeId === userId) return true;
    if (Array.isArray(t.assignees) && t.assignees.some((a: any) => a.userId === userId)) return true;
    return false;
  });

  const statusCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  let overdue = 0;
  let dueToday = 0;
  let dueThisWeek = 0;
  let completed = 0;

  mine.forEach((t) => {
    const status = String(t.status || 'PENDING').toUpperCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    const priority = String(t.priority || 'MEDIUM').toUpperCase();
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

    const isDone = ['COMPLETED', 'DONE', 'CLOSED', 'VERIFIED'].includes(status);
    if (isDone) completed += 1;

    if (t.dueDate && !isDone) {
      const due = new Date(t.dueDate);
      if (due < today) overdue += 1;
      else if (due < addDays(today, 1)) dueToday += 1;
      else if (due < endOfWeek) dueThisWeek += 1;
    }
  });

  const byStatus = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
    color: STATUS_COLORS[name] || '#6366f1',
  }));
  const byPriority = Object.entries(priorityCounts).map(([name, value]) => ({
    name,
    value,
    color: PRIORITY_COLORS[name] || '#6366f1',
  }));

  return { total: mine.length, overdue, dueToday, dueThisWeek, completed, byStatus, byPriority };
}

function aggregateWorkOrders(list: any[]) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const statusCounts: Record<string, number> = {};
  let overdue = 0;
  let completedThisMonth = 0;

  list.forEach((w) => {
    const status = String(w.status || 'PENDING').toUpperCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    const isDone = status === 'COMPLETED' || status === 'CLOSED';
    if (!isDone && w.dueDate && new Date(w.dueDate) < now) overdue += 1;
    if (isDone && w.completedAt && new Date(w.completedAt) >= firstOfMonth) completedThisMonth += 1;
  });

  const byStatus = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
    color: STATUS_COLORS[name] || '#6366f1',
  }));

  return { total: list.length, byStatus, overdue, completedThisMonth };
}

function aggregateFmir(list: any[]) {
  const now = new Date();
  const recentCutoff = addDays(now, -30);
  const statusCounts: Record<string, number> = {};
  let recent = 0;

  list.forEach((f) => {
    const status = String(f.status || 'DRAFT').toUpperCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    if (f.createdAt && new Date(f.createdAt) >= recentCutoff) recent += 1;
  });

  const byStatus = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
    color: STATUS_COLORS[name] || '#6366f1',
  }));

  return { total: list.length, byStatus, recent };
}

function aggregateSafety(list: any[]) {
  const now = new Date();
  let completed = 0;
  let inProgress = 0;
  let overdue = 0;

  list.forEach((a) => {
    const status = String(a.status || '').toUpperCase();
    if (status === 'COMPLETED' || status === 'APPROVED') completed += 1;
    else if (status === 'IN_PROGRESS' || status === 'DRAFT') inProgress += 1;
    if (a.dueDate && new Date(a.dueDate) < now && status !== 'COMPLETED') overdue += 1;
  });

  return { total: list.length, completed, inProgress, overdue };
}

function aggregateMeetings(list: any[]) {
  const now = new Date();
  const weekAgo = addDays(now, -7);
  const typeCounts: Record<string, number> = {};
  let thisWeek = 0;
  let upcoming = 0;

  list.forEach((m) => {
    const type = String(m.meetingType || 'GENERAL').replace(/_/g, ' ');
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    if (m.createdAt && new Date(m.createdAt) >= weekAgo) thisWeek += 1;
    if (m.scheduledAt && new Date(m.scheduledAt) > now) upcoming += 1;
  });

  const byType = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  return { total: list.length, thisWeek, upcoming, byType };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DashboardMetrics() {
  const { user } = useAuth();
  const [data, setData] = useState<AggregatedData>({
    incidents: null,
    capa: null,
    myTasks: null,
    workOrders: null,
    fmir: null,
    safety: null,
    meetings: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const orgId = (user as any).organizationId;
    const userId = user.id;

    // Fire all requests in parallel; tolerate individual failures
    const results = await Promise.allSettled([
      api.get(`/incidents/dashboard/stats?timeRange=${timeRange}`),
      orgId ? api.get(`/capa/stats?organizationId=${orgId}`) : Promise.reject('no orgId'),
      api.get(`/mobile/tasks?userId=${userId}&filter=assigned`),
      api.get(`/work-orders`),
      api.get(`/fmir?limit=200`),
      api.get(`/workplace-safety`),
      api.get(`/mobile/meetings?userId=${userId}&limit=100`),
    ]);

    const getData = (r: PromiseSettledResult<any>): any =>
      r.status === 'fulfilled' ? r.value?.data?.data ?? r.value?.data : null;

    // Incidents (primary - show error only if this fails)
    const incidentsRaw = getData(results[0]);
    if (results[0].status === 'rejected') {
      setError('Unable to load dashboard. Please try again.');
      setLoading(false);
      return;
    }

    const capa = getData(results[1]) as CapaStats | null;

    // Tasks
    const tasksResp = results[2].status === 'fulfilled' ? results[2].value?.data : null;
    const tasksList: any[] = tasksResp?.tasks || tasksResp?.data || [];
    const myTasks = aggregateTasks(tasksList, userId);

    // Work orders
    const woList: any[] = getData(results[3]) || [];
    const workOrders = aggregateWorkOrders(Array.isArray(woList) ? woList : []);

    // FMIR — response may be { data: [...] } or { data: { reports: [...] } }
    const fmirRaw = getData(results[4]);
    const fmirList: any[] = Array.isArray(fmirRaw)
      ? fmirRaw
      : fmirRaw?.reports || fmirRaw?.items || [];
    const fmir = aggregateFmir(fmirList);

    // Safety
    const safetyRaw = getData(results[5]);
    const safetyList: any[] = Array.isArray(safetyRaw)
      ? safetyRaw
      : safetyRaw?.assessments || safetyRaw?.items || [];
    const safety = aggregateSafety(safetyList);

    // Meetings
    const meetingsResp = results[6].status === 'fulfilled' ? results[6].value?.data : null;
    const meetingsList: any[] = meetingsResp?.meetings || meetingsResp?.data || [];
    const meetings = aggregateMeetings(meetingsList);

    setData({
      incidents: incidentsRaw as IncidentStats,
      capa,
      myTasks,
      workOrders,
      fmir,
      safety,
      meetings,
    });
    setLoading(false);
  }, [user, timeRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const trendDataWithLocalDates = useMemo(() => {
    if (!data.incidents) return [];
    return data.incidents.incidentsTrend.map((item) => ({
      ...item,
      name: formatDateLocal(item.date, item.name),
    }));
  }, [data.incidents]);

  const capaStatusChartData = useMemo(() => {
    if (!data.capa?.byStatus) return [];
    return Object.entries(data.capa.byStatus).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value: value as number,
      color: STATUS_COLORS[name] || '#6366f1',
    }));
  }, [data.capa]);

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
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
          onClick={fetchAll}
          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg shadow-red-500/25"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data.incidents) return null;

  const stats = data.incidents;
  const myTasks = data.myTasks;
  const wo = data.workOrders;
  const fmir = data.fmir;
  const safety = data.safety;
  const meetings = data.meetings;
  const capa = data.capa;

  // Personal LSW-style progress: completed / total of my tasks
  const myCompletionPct = myTasks && myTasks.total > 0
    ? Math.round((myTasks.completed / myTasks.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ============== HEADER ============== */}
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
              Operations Dashboard
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Your personal workspace + organization-wide insights</p>
          </div>
          {stats.dataScope && (
            <span className={`px-3 py-1 text-xs font-semibold rounded-full backdrop-blur-md ${
              stats.dataScope === 'organization'
                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
            }`}>
              {stats.dataScope === 'organization' ? 'Organization' : 'My Scope'}
            </span>
          )}
        </div>

        <div className="flex p-1 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-gray-700/50">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`relative px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
                timeRange === range ? 'text-white shadow-lg' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
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

      {/* ============== PERSONAL SNAPSHOT (top tier) ============== */}
      <SectionLabel icon={Sparkles} label="Your Snapshot" accent="from-violet-500 to-fuchsia-500" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PersonalTile
          title="My Action Items"
          value={myTasks?.total ?? 0}
          icon={ClipboardList}
          color="violet"
          primary={{ label: 'Overdue', value: myTasks?.overdue ?? 0, alert: (myTasks?.overdue ?? 0) > 0 }}
          secondary={{ label: 'Due today', value: myTasks?.dueToday ?? 0 }}
          mounted={mounted}
          delay={0}
        />
        <ProgressRingTile
          title="My Completion"
          pct={myCompletionPct}
          done={myTasks?.completed ?? 0}
          total={myTasks?.total ?? 0}
          mounted={mounted}
          delay={1}
        />
        <PersonalTile
          title="My Meetings"
          value={meetings?.total ?? 0}
          icon={Mic}
          color="cyan"
          primary={{ label: 'This week', value: meetings?.thisWeek ?? 0 }}
          secondary={{ label: 'Upcoming', value: meetings?.upcoming ?? 0 }}
          mounted={mounted}
          delay={2}
        />
        <PersonalTile
          title="Critical Incidents"
          value={stats.criticalIncidents}
          icon={AlertCircle}
          color="rose"
          primary={{ label: 'Open', value: stats.openIncidents, alert: stats.openIncidents > 0 }}
          secondary={{ label: 'In progress', value: stats.inProgressIncidents }}
          mounted={mounted}
          delay={3}
        />
      </div>

      {/* ============== INCIDENT ACTIVITY ============== */}
      <SectionLabel icon={Activity} label="Incident Activity" accent="from-blue-500 to-indigo-500" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <ChartCard title="Incident Trend" icon={TrendingUp} subtitle="Created vs Resolved over time" delay={0} mounted={mounted}>
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
                  <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="incidents" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorIncidents)" name="Created" animationDuration={1500} />
                  <Area type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorResolved)" name="Resolved" animationDuration={1500} animationDelay={300} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <ChartCard title="Severity Breakdown" icon={PieChartIcon} subtitle="By incident severity" delay={1} mounted={mounted}>
          <div className="h-64 flex flex-col items-center justify-center">
            <div className="w-full h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.incidentsBySeverity.filter((s) => s.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1200}
                  >
                    {stats.incidentsBySeverity.filter((s) => s.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full grid grid-cols-2 gap-2 mt-2 px-2">
              {stats.incidentsBySeverity.map((entry, index) => (
                <div key={index} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}40` }} />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">{entry.name}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Category + Weekly row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Incidents by Category" icon={BarChart3} subtitle="Distribution across categories" delay={0} mounted={mounted}>
          <div className="h-64">
            {stats.incidentsByCategory.length === 0 ? (
              <EmptyChart message="No category data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.incidentsByCategory} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-700" opacity={0.3} horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-500 dark:text-gray-400" axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltipIncidents />} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} animationDuration={1500}>
                    {stats.incidentsByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Weekly Performance" icon={Calendar} subtitle="Created vs Resolved this week" delay={1} mounted={mounted}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weeklyPerformance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-700" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="created" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', strokeWidth: 2, r: 4, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Created" animationDuration={1500} />
                <Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={3} dot={{ fill: '#22c55e', strokeWidth: 2, r: 4, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Resolved" animationDuration={1500} animationDelay={300} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* ============== QUALITY (CAPA + RCA + FMIR) ============== */}
      <SectionLabel icon={ShieldCheck} label="Quality & Compliance" accent="from-emerald-500 to-teal-500" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="CAPA by Status" icon={Target} subtitle={capa ? `${capa.overdue} overdue • ${capa.total} total` : 'No data'} delay={0} mounted={mounted}>
          <div className="h-64">
            {capaStatusChartData.length === 0 ? (
              <EmptyChart message="No CAPA data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={capaStatusChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-700" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 10 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<BarTooltipActions />} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={1200}>
                    {capaStatusChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="RCA Progress" icon={Activity} subtitle={`${stats.rcaInProgress + stats.rcaCompleted} total analyses`} delay={1} mounted={mounted}>
          <div className="h-64 flex flex-col items-center justify-center">
            <div className="w-full h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Completed', value: stats.rcaCompleted, color: '#22c55e' },
                      { name: 'In Progress', value: stats.rcaInProgress, color: '#8b5cf6' },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={1200}
                  >
                    {[
                      { name: 'Completed', value: stats.rcaCompleted, color: '#22c55e' },
                      { name: 'In Progress', value: stats.rcaInProgress, color: '#8b5cf6' },
                    ].filter((d) => d.value > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full grid grid-cols-2 gap-2 mt-2 px-2">
              <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Completed</span>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">{stats.rcaCompleted}</span>
              </div>
              <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-900/20">
                <span className="text-xs font-medium text-violet-700 dark:text-violet-300">In Progress</span>
                <span className="text-xs font-bold text-violet-900 dark:text-violet-200">{stats.rcaInProgress}</span>
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="FMIR by Status" icon={FileWarning} subtitle={fmir ? `${fmir.total} reports • ${fmir.recent} this month` : 'No data'} delay={2} mounted={mounted}>
          <div className="h-64">
            {!fmir || fmir.byStatus.length === 0 ? (
              <EmptyChart message="No FMIR reports" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fmir.byStatus} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-700" opacity={0.3} horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fill: 'currentColor', fontSize: 10 }} className="text-gray-500 dark:text-gray-400" axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltipReports />} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} animationDuration={1200}>
                    {fmir.byStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>

      {/* ============== OPERATIONS (Work Orders + Safety + Meetings) ============== */}
      <SectionLabel icon={Wrench} label="Operations & Safety" accent="from-orange-500 to-amber-500" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Work Orders" icon={Wrench} subtitle={wo ? `${wo.overdue} overdue • ${wo.completedThisMonth} done this month` : 'No data'} delay={0} mounted={mounted}>
          <div className="h-64 flex items-center justify-center">
            {!wo || wo.byStatus.length === 0 ? (
              <EmptyChart message="No work orders" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={wo.byStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={(entry) => `${entry.value}`}
                    labelLine={false}
                    animationDuration={1200}
                  >
                    {wo.byStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip labelSuffix="work orders" />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Safety Assessments" icon={HardHat} subtitle={safety ? `${safety.completed} completed • ${safety.inProgress} in progress` : 'No data'} delay={1} mounted={mounted}>
          <div className="h-64 flex flex-col items-center justify-center gap-4 px-4">
            {!safety || safety.total === 0 ? (
              <EmptyChart message="No assessments" />
            ) : (
              <>
                <div className="w-32 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="65%"
                      outerRadius="100%"
                      data={[{
                        name: 'Completed',
                        value: safety.total > 0 ? Math.round((safety.completed / safety.total) * 100) : 0,
                        fill: '#22c55e',
                      }]}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar background dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold bg-gradient-to-br from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    {safety.total > 0 ? Math.round((safety.completed / safety.total) * 100) : 0}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">% complete</span>
                </div>
                <div className="grid grid-cols-3 gap-2 w-full text-center">
                  <SafetyMini label="Done" value={safety.completed} color="emerald" />
                  <SafetyMini label="Active" value={safety.inProgress} color="violet" />
                  <SafetyMini label="Overdue" value={safety.overdue} color="rose" />
                </div>
              </>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Meetings by Type" icon={Users} subtitle={meetings ? `${meetings.total} total • ${meetings.thisWeek} this week` : 'No data'} delay={2} mounted={mounted}>
          <div className="h-64">
            {!meetings || meetings.byType.length === 0 ? (
              <EmptyChart message="No meetings" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meetings.byType} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-700" opacity={0.3} horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 11 }} className="text-gray-400 dark:text-gray-500" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'currentColor', fontSize: 10 }} className="text-gray-500 dark:text-gray-400" axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltipMeetings />} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} animationDuration={1200}>
                    {meetings.byType.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SectionLabel({ icon: Icon, label, accent }: { icon: React.ElementType; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className={`h-px flex-1 bg-gradient-to-r ${accent} opacity-30`} />
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50">
        <Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          {label}
        </span>
      </div>
      <div className={`h-px flex-1 bg-gradient-to-l ${accent} opacity-30`} />
    </div>
  );
}

interface PersonalTileProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'indigo' | 'orange' | 'cyan';
  primary: { label: string; value: number; alert?: boolean };
  secondary?: { label: string; value: number };
  mounted: boolean;
  delay: number;
}

const COLOR_THEMES: Record<string, { bg: string; border: string; iconBg: string; iconColor: string; glow: string; gradient: string }> = {
  blue: { bg: 'from-blue-500/10 via-blue-500/5 to-transparent', border: 'border-blue-200/50 dark:border-blue-700/30', iconBg: 'bg-blue-500/10 dark:bg-blue-500/20', iconColor: 'text-blue-600 dark:text-blue-400', glow: 'shadow-blue-500/20', gradient: 'from-blue-500 to-cyan-500' },
  emerald: { bg: 'from-emerald-500/10 via-emerald-500/5 to-transparent', border: 'border-emerald-200/50 dark:border-emerald-700/30', iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20', iconColor: 'text-emerald-600 dark:text-emerald-400', glow: 'shadow-emerald-500/20', gradient: 'from-emerald-500 to-teal-500' },
  amber: { bg: 'from-amber-500/10 via-amber-500/5 to-transparent', border: 'border-amber-200/50 dark:border-amber-700/30', iconBg: 'bg-amber-500/10 dark:bg-amber-500/20', iconColor: 'text-amber-600 dark:text-amber-400', glow: 'shadow-amber-500/20', gradient: 'from-amber-500 to-orange-500' },
  rose: { bg: 'from-rose-500/10 via-rose-500/5 to-transparent', border: 'border-rose-200/50 dark:border-rose-700/30', iconBg: 'bg-rose-500/10 dark:bg-rose-500/20', iconColor: 'text-rose-600 dark:text-rose-400', glow: 'shadow-rose-500/20', gradient: 'from-rose-500 to-pink-500' },
  violet: { bg: 'from-violet-500/10 via-violet-500/5 to-transparent', border: 'border-violet-200/50 dark:border-violet-700/30', iconBg: 'bg-violet-500/10 dark:bg-violet-500/20', iconColor: 'text-violet-600 dark:text-violet-400', glow: 'shadow-violet-500/20', gradient: 'from-violet-500 to-purple-500' },
  indigo: { bg: 'from-indigo-500/10 via-indigo-500/5 to-transparent', border: 'border-indigo-200/50 dark:border-indigo-700/30', iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20', iconColor: 'text-indigo-600 dark:text-indigo-400', glow: 'shadow-indigo-500/20', gradient: 'from-indigo-500 to-blue-500' },
  orange: { bg: 'from-orange-500/10 via-orange-500/5 to-transparent', border: 'border-orange-200/50 dark:border-orange-700/30', iconBg: 'bg-orange-500/10 dark:bg-orange-500/20', iconColor: 'text-orange-600 dark:text-orange-400', glow: 'shadow-orange-500/20', gradient: 'from-orange-500 to-red-500' },
  cyan: { bg: 'from-cyan-500/10 via-cyan-500/5 to-transparent', border: 'border-cyan-200/50 dark:border-cyan-700/30', iconBg: 'bg-cyan-500/10 dark:bg-cyan-500/20', iconColor: 'text-cyan-600 dark:text-cyan-400', glow: 'shadow-cyan-500/20', gradient: 'from-cyan-500 to-blue-500' },
};

function PersonalTile({ title, value, icon: Icon, color, primary, secondary, mounted, delay }: PersonalTileProps) {
  const theme = COLOR_THEMES[color];
  const animatedValue = useAnimatedCounter(value, 1200, mounted);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl backdrop-blur-xl
        bg-white/70 dark:bg-gray-800/70
        border border-gray-200/50 dark:border-gray-700/50
        shadow-sm transition-all duration-300 ease-out
        hover:-translate-y-1 hover:scale-[1.03] hover:shadow-2xl ${theme.glow}
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay * 75}ms` }}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${theme.gradient} opacity-70 group-hover:opacity-100 transition-opacity duration-300`} />
      {/* Subtle hover wash */}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
      <div className="relative p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-xl ${theme.iconBg} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
            <Icon className={`w-4 h-4 ${theme.iconColor}`} />
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent leading-none">
              {animatedValue}
            </p>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mt-1">{title}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200/40 dark:border-gray-700/40 grid grid-cols-2 gap-2">
          <div>
            <p className={`text-lg font-bold ${primary.alert ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
              {primary.value}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{primary.label}</p>
          </div>
          {secondary && (
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{secondary.value}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{secondary.label}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressRingTile({ title, pct, done, total, mounted, delay }: { title: string; pct: number; done: number; total: number; mounted: boolean; delay: number }) {
  const theme = COLOR_THEMES.emerald;
  const animatedPct = useAnimatedCounter(pct, 1400, mounted);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl backdrop-blur-xl
        bg-white/70 dark:bg-gray-800/70
        border border-gray-200/50 dark:border-gray-700/50
        shadow-sm transition-all duration-300 ease-out
        hover:-translate-y-1 hover:scale-[1.03] hover:shadow-2xl ${theme.glow}
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay * 75}ms` }}
    >
      <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${theme.gradient} opacity-70 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
      <div className="relative p-4 flex items-center gap-4">
        <div className="relative w-20 h-20 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              data={[{ name: 'done', value: animatedPct, fill: '#10b981' }]}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: '#d1fae5' }} dataKey="value" cornerRadius={10} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{animatedPct}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {done} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ {total}</span>
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            tasks completed
          </p>
        </div>
      </div>
    </div>
  );
}

function SafetyMini({ label, value, color }: { label: string; value: number; color: 'emerald' | 'violet' | 'rose' }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300',
  };
  return (
    <div className={`px-2 py-1 rounded-lg ${colors[color]}`}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-[10px] mt-0.5">{label}</p>
    </div>
  );
}

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
        shadow-sm transition-all duration-300 ease-out h-full
        hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay * 100 + 300}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/10">
            <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{title}</h4>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
      {message}
    </div>
  );
}

// Tooltips
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-xl p-4 shadow-2xl">
        <p className="text-gray-300 text-sm mb-2 font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-400 text-sm">{entry.name}:</span>
            <span className="text-white font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function PieTooltip({ active, payload, labelSuffix = 'incidents' }: any) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-xl p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.payload.color || data.payload.fill }} />
          <span className="text-gray-300 text-sm">{data.name}:</span>
          <span className="text-white font-bold">{data.value} {labelSuffix}</span>
        </div>
      </div>
    );
  }
  return null;
}

function makeBarTooltip(suffix: string) {
  const Tip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-xl p-3 shadow-2xl">
          <p className="text-gray-300 text-sm mb-1">{label}</p>
          <p className="text-white font-bold">{payload[0].value} {suffix}</p>
        </div>
      );
    }
    return null;
  };
  return Tip;
}
const BarTooltipIncidents = makeBarTooltip('incidents');
const BarTooltipActions = makeBarTooltip('actions');
const BarTooltipReports = makeBarTooltip('reports');
const BarTooltipMeetings = makeBarTooltip('meetings');
