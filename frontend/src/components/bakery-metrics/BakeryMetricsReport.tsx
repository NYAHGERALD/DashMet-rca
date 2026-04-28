'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import {
  BarChart3,
  Calendar,
  Clock,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Gauge,
  Package,
  Trash2,
  Trophy,
  X,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Activity,
  CalendarCheck,
  ChevronDown,
  MessageSquare,
  ClipboardX,
  Send,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface KpiTargets {
  oee: { die_cut_1: number; die_cut_2: number; total: number };
  volume: { die_cut_1: number; die_cut_2: number; total: number };
  waste: { die_cut_1: number; die_cut_2: number; total: number };
}

interface MetricsRecord {
  id?: string;
  submission_date?: string;
  week_name?: string;
  day_of_week?: string;
  // First shift
  first_shift_die_cut1_oee?: number;
  first_shift_die_cut2_oee?: number;
  first_shift_oee?: number;
  first_shift_die_cut1_lbs?: number;
  first_shift_die_cut2_lbs?: number;
  first_shift_production?: number;
  first_shift_die_cut1_waste_pct?: number;
  first_shift_die_cut2_waste_pct?: number;
  first_shift_waste_percent?: number;
  // Second shift
  second_shift_die_cut1_oee?: number;
  second_shift_die_cut2_oee?: number;
  second_shift_oee?: number;
  second_shift_die_cut1_lbs?: number;
  second_shift_die_cut2_lbs?: number;
  second_shift_production?: number;
  second_shift_die_cut1_waste_pct?: number;
  second_shift_die_cut2_waste_pct?: number;
  second_shift_waste_percent?: number;
  // Both shifts
  both_shift_die_cut1_oee?: number;
  both_shift_die_cut2_oee?: number;
  total_oee?: number;
  both_shift_die_cut1_lbs?: number;
  both_shift_die_cut2_lbs?: number;
  total_production?: number;
  both_shift_die_cut1_waste_pct?: number;
  both_shift_die_cut2_waste_pct?: number;
  total_waste_percent?: number;
  has_first_shift?: boolean;
  has_second_shift?: boolean;
  [key: string]: any;
}

interface ShiftResolution {
  id: number;
  weekName: string;
  dayOfWeek: string;
  shiftType: string;
  reason: string;
  resolvedBy: string;
  resolvedAt: string;
}

interface DashboardMetrics {
  oeeCurrentValue?: number;
  oeeStatus?: string;
  oeeChange?: string;
  oeeVsTarget?: string;
  wasteCurrentValue?: number;
  wasteStatus?: string;
  wasteChange?: string;
  wasteVsTarget?: string;
  productionCurrentValue?: number;
  productionStatus?: string;
  productionChange?: string;
  productionDailyOutput?: string;
  efficiencyCurrentValue?: number;
  efficiencyStatus?: string;
  efficiencyChange?: string;
  efficiencyPerformanceIndex?: string;
}

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ─── Helper: value color class ──────────────────────────────────────────────────
function getValueColor(value: number | undefined | null, target: number, isReverse = false): string {
  if (value === undefined || value === null || value === 0) return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  if (isReverse) {
    return value <= target
      ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
      : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300';
  }
  return value >= target
    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
    : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300';
}

function getStatusText(value: number | undefined | null, target: number, type: 'oee' | 'volume' | 'waste'): { text: string; good: boolean } {
  if (!value) return { text: '-', good: false };
  if (type === 'waste') {
    return value <= target ? { text: 'BELOW TARGET', good: true } : { text: 'ABOVE TARGET', good: false };
  }
  if (type === 'oee') {
    return value >= target ? { text: 'TARGET MET', good: true } : { text: 'BELOW TARGET', good: false };
  }
  return value >= target ? { text: 'ON TARGET', good: true } : { text: 'BELOW TARGET', good: false };
}

function formatVal(value: number | undefined | null, suffix: string, isInteger = false): string {
  if (value === undefined || value === null || value === 0) return '-';
  if (isInteger) return Math.round(value).toLocaleString() + suffix;
  return value.toFixed(1) + suffix;
}

// ─── Metric Value Cell ──────────────────────────────────────────────────────────
function MetricCell({ value, suffix, target, isReverse = false, isInteger = false, missing = false, onResolve, didNotRun = false, lineName, displayMessage }: {
  value: number | undefined | null;
  suffix: string;
  target: number;
  isReverse?: boolean;
  isInteger?: boolean;
  missing?: boolean;
  onResolve?: () => void;
  didNotRun?: boolean;
  lineName?: string;
  displayMessage?: string | null;
}) {
  const display = formatVal(value, suffix, isInteger);
  const color = getValueColor(value, target, isReverse);
  const [showHint, setShowHint] = useState(false);
  const noProductionMessage = displayMessage || `No Production Run${lineName ? ` on ${lineName}` : ''}`;
  return (
    <div className="relative min-h-[38px] flex items-center">
      <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-bold ${color}`}>
        {display}
      </span>
      {didNotRun && (
        <div className="absolute inset-0 flex items-center justify-between gap-1.5 px-2 bg-slate-100/95 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">
              {noProductionMessage}
            </span>
            <button
              type="button"
              aria-label="Why is this shown?"
              title="All KPI data is missing for this line, indicating that no production occurred on this day."
              onMouseEnter={() => setShowHint(true)}
              onMouseLeave={() => setShowHint(false)}
              onClick={(e) => { e.stopPropagation(); setShowHint((s) => !s); }}
              className="flex-shrink-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <Info className="w-3 h-3" />
            </button>
            {showHint && (
              <div className="absolute left-2 top-full mt-1 z-20 w-56 p-2 text-[10px] font-medium text-white bg-slate-900 dark:bg-slate-700 rounded-md shadow-lg pointer-events-none">
                All KPI data is missing for this line, indicating that no production occurred on this day.
              </div>
            )}
          </div>
          {onResolve && (
            <button
              type="button"
              onClick={onResolve}
              className="flex-shrink-0 px-2 py-1 text-[10px] font-bold text-white bg-slate-600 hover:bg-slate-700 rounded-md transition-colors"
            >
              Resolve
            </button>
          )}
        </div>
      )}
      {!didNotRun && missing && (
        <div className="absolute inset-0 flex items-center justify-between gap-2 px-2 bg-amber-100/90 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 rounded-lg">
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{displayMessage || 'Missing Data?'}</span>
          <button
            type="button"
            onClick={onResolve}
            className="px-2 py-1 text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
          >
            Resolve
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ value, target, type }: {
  value: number | undefined | null;
  target: number;
  type: 'oee' | 'volume' | 'waste';
}) {
  const { text, good } = getStatusText(value, target, type);
  return (
    <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase ${
      text === '-'
        ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
        : good
          ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
          : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
    }`}>
      {text}
    </span>
  );
}

// ─── Performance Card ───────────────────────────────────────────────────────────
function PerfCard({ icon, iconBg, title, value, unit, status, statusGood, change, changeGood, subtext }: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string;
  unit: string;
  status: string;
  statusGood: boolean;
  change: string;
  changeGood: boolean | null;
  subtext: string;
}) {
  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 ${iconBg} rounded-xl shadow-md`}>{icon}</div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
          statusGood
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
        }`}>
          {status}
        </span>
      </div>
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">{title}</h3>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-gray-900 dark:text-white">{value}</span>
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{unit}</span>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${
          changeGood === true
            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            : changeGood === false
              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}>
          {changeGood === true ? <TrendingUp className="w-3 h-3 mr-0.5" /> : changeGood === false ? <TrendingDown className="w-3 h-3 mr-0.5" /> : <Minus className="w-3 h-3 mr-0.5" />}
          {change}
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400">{subtext}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
interface BakeryMetricsReportProps {
  onFilterInfo?: (info: { week: string; day: string; totalRecords: number; isWeekSummary: boolean }) => void;
  triggerAction?: { type: 'refresh' | 'pdf' | 'excel'; ts: number };
  onCongratsChange?: (showCongrats: boolean) => void;
}

export default function BakeryMetricsReport({ onFilterInfo, triggerAction, onCongratsChange }: BakeryMetricsReportProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const currentUserName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown User';

  // ─── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [weekFilter, setWeekFilter] = useState('');
  const [dayFilter, setDayFilter] = useState(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = dayNames[new Date().getDay()];
    if (today === 'Saturday' || today === 'Sunday') return 'Friday';
    return today;
  });
  const [weekOptions, setWeekOptions] = useState<string[]>([]);
  const [recordOptions, setRecordOptions] = useState<{ id: string; label: string }[]>([]);
  const [selectedRecord, setSelectedRecord] = useState('latest');
  const [compactView, setCompactView] = useState(false);

  // Custom dropdown open states
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [recordDropdownOpen, setRecordDropdownOpen] = useState(false);
  const weekDropdownRef = useRef<HTMLDivElement>(null);
  const recordDropdownRef = useRef<HTMLDivElement>(null);
  const [isWeekSummary, setIsWeekSummary] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);

  const [kpiTargets, setKpiTargets] = useState<KpiTargets>({
    oee: { die_cut_1: 70, die_cut_2: 70, total: 70 },
    volume: { die_cut_1: 6000, die_cut_2: 6000, total: 12000 },
    waste: { die_cut_1: 3.75, die_cut_2: 3.75, total: 3.75 },
  });

  const [metricsData, setMetricsData] = useState<MetricsRecord>({});
  const [dashMetrics, setDashMetrics] = useState<DashboardMetrics>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ─── Shift Resolution state ───────────────────────────────────────────
  const [shiftResolutions, setShiftResolutions] = useState<ShiftResolution[]>([]);
  const [resolveModal, setResolveModal] = useState<{ shift: 'first' | 'second' } | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [savingResolve, setSavingResolve] = useState(false);

  const [missingKpiModal, setMissingKpiModal] = useState<{
    shift: 'first' | 'second';
    line: 1 | 2;
    missingFields: Array<'oee' | 'pounds' | 'waste'>;
  } | null>(null);
  const [missingKpiForm, setMissingKpiForm] = useState({ oee: '', pounds: '', waste: '' });
  const [savingMissingKpi, setSavingMissingKpi] = useState(false);
  const [missingModalPos, setMissingModalPos] = useState<{ x: number; y: number } | null>(null);
  const missingDragRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({ active: false, offsetX: 0, offsetY: 0 });

  // ─── Week Summary confirmation state ──────────────────────────────────
  const [weekSummaryConfirm, setWeekSummaryConfirm] = useState<null | {
    missing: Array<{ day: string; shift: string; line: string; kpi: string }>;
  }>(null);
  const [checkingWeekSummary, setCheckingWeekSummary] = useState(false);

  // ─── Email Report state ───────────────────────────────────────────────
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailEligibleUsers, setEmailEligibleUsers] = useState<{ id: string; email: string; firstName: string; lastName: string; role: string }[]>([]);
  const [emailSelectedUsers, setEmailSelectedUsers] = useState<string[]>([]);
  const [emailWeek, setEmailWeek] = useState('');
  const [emailDay, setEmailDay] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailLoadingUsers, setEmailLoadingUsers] = useState(false);
  const [emailCustomMessage, setEmailCustomMessage] = useState('');

  // ─── Overlay positioning refs ──────────────────────────────────────────
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const firstShiftThRef = useRef<HTMLTableCellElement>(null);
  const secondShiftThRef = useRef<HTMLTableCellElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [overlayPositions, setOverlayPositions] = useState<{
    first?: { left: number; width: number; top: number; height: number };
    second?: { left: number; width: number; top: number; height: number };
  }>({});

  const notifId = useRef(0);

  // ─── Notifications ────────────────────────────────────────────────────────
  const showNotification = useCallback((message: string, type: Notification['type']) => {
    const id = ++notifId.current;
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  // ─── Load shift resolutions ──────────────────────────────────────────────
  // ─── Email Modal Handlers ──────────────────────────────────────────────
  const openEmailModal = useCallback(async () => {
    setShowEmailModal(true);
    setEmailWeek(weekFilter);
    setEmailDay(dayFilter);
    setEmailSelectedUsers([]);
    setEmailCustomMessage('');
    setEmailLoadingUsers(true);
    try {
      const res = await api.get('/bakery-metrics/email-eligible-users');
      if (res.data?.success) {
        setEmailEligibleUsers(res.data.users || []);
      }
    } catch {
      showNotification('Failed to load users', 'error');
    } finally {
      setEmailLoadingUsers(false);
    }
  }, [weekFilter, dayFilter, showNotification]);

  const handleSendEmail = useCallback(async () => {
    if (emailSelectedUsers.length === 0) {
      showNotification('Please select at least one user', 'warning');
      return;
    }
    if (!emailWeek || !emailDay) {
      showNotification('Please select a week and day', 'warning');
      return;
    }
    setEmailSending(true);
    try {
      const res = await api.post('/bakery-metrics/send-report-email', {
        weekName: emailWeek,
        dayOfWeek: emailDay,
        userIds: emailSelectedUsers,
        ...(emailCustomMessage.trim() && { customMessage: emailCustomMessage.trim() }),
      });
      if (res.data?.success) {
        showNotification(res.data.message || 'Report emails sent successfully!', 'success');
        setShowEmailModal(false);
      } else {
        showNotification(res.data?.error || 'Failed to send emails', 'error');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to send report emails';
      showNotification(msg, 'error');
    } finally {
      setEmailSending(false);
    }
  }, [emailSelectedUsers, emailWeek, emailDay, emailCustomMessage, showNotification]);

  const toggleUserSelection = useCallback((userId: string) => {
    setEmailSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  }, []);

  const toggleAllUsers = useCallback(() => {
    setEmailSelectedUsers(prev =>
      prev.length === emailEligibleUsers.length ? [] : emailEligibleUsers.map(u => u.id)
    );
  }, [emailEligibleUsers]);

  const loadShiftResolutions = useCallback(async () => {
    try {
      const res = await api.get('/bakery-metrics/resolutions');
      if (res.data?.success) {
        setShiftResolutions(res.data.resolutions || []);
      }
    } catch { /* ignore */ }
  }, []);

  // ─── Get resolution for a specific shift ─────────────────────────────────
  const getShiftResolution = useCallback((shift: 'first' | 'second'): ShiftResolution | undefined => {
    const week = metricsData.week_name || weekFilter;
    const day = metricsData.day_of_week || dayFilter;
    return shiftResolutions.find(
      r => r.weekName === week && r.dayOfWeek === day && r.shiftType === shift
    );
  }, [shiftResolutions, metricsData, weekFilter, dayFilter]);

  // ─── Check if the selected day has passed ────────────────────────────────
  const isDayPassed = useCallback((): boolean => {
    // Only applicable if we're looking at a specific day (not week summary)
    if (isWeekSummary) return false;
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayIndex = weekDays.indexOf(dayFilter); // 0=Mon..4=Fri
    if (dayIndex < 0) return false;
    const now = new Date();
    // Parse the week from weekFilter to get the actual dates
    // weekFilter format: "MM-DD-YYYY_MM-DD-YYYY"
    if (weekFilter) {
      const parts = weekFilter.split('_');
      if (parts.length === 2) {
        const [startStr] = parts;
        const [m, dd, y] = startStr.split('-').map(Number);
        if (m && dd && y) {
          const weekStart = new Date(y, m - 1, dd); // Monday of that week
          const dayDate = new Date(weekStart);
          dayDate.setDate(dayDate.getDate() + dayIndex);
          // Day has passed if the day's date is before today (midnight)
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return dayDate < todayStart;
        }
      }
    }
    // Fallback: simple day-of-week comparison for current week
    const todayDayIdx = now.getDay() === 0 ? -1 : now.getDay() - 1; // Sun=-1, Mon=0, Tue=1...
    return dayIndex < todayDayIdx;
  }, [dayFilter, weekFilter, isWeekSummary]);

  // ─── Format week range for display ────────────────────────────────────────
  const formatWeekRange = (wf: string): string => {
    if (!wf) return '';
    const parts = wf.split('_');
    if (parts.length !== 2) return wf;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parse = (s: string) => {
      const [m, d, y] = s.split('-').map(Number);
      return { month: months[m - 1], day: d, year: y };
    };
    const start = parse(parts[0]);
    const end = parse(parts[1]);
    if (!start.month || !end.month) return wf;
    if (start.year === end.year && start.month === end.month) {
      return `${start.month} ${start.day} – ${end.day}, ${start.year}`;
    }
    if (start.year === end.year) {
      return `${start.month} ${start.day} – ${end.month} ${end.day}, ${start.year}`;
    }
    return `${start.month} ${start.day}, ${start.year} – ${end.month} ${end.day}, ${end.year}`;
  };

  // ─── Submit shift resolution ─────────────────────────────────────────────
  const handleResolveSubmit = async () => {
    if (!resolveModal || !resolveReason.trim()) return;
    setSavingResolve(true);
    try {
      const week = metricsData.week_name || weekFilter;
      const day = metricsData.day_of_week || dayFilter;
      const { data } = await api.post('/bakery-metrics/resolutions', {
        week_name: week,
        day_of_week: day,
        shift_type: resolveModal.shift,
        reason: resolveReason.trim(),
        resolved_by: currentUserName,
      });
      if (data.success) {
        setShiftResolutions(prev => [...prev, data.resolution]);
        setResolveModal(null);
        setResolveReason('');
        showNotification(`${resolveModal.shift === 'first' ? 'First' : 'Second'} shift resolution saved`, 'success');
      }
    } catch {
      showNotification('Failed to save resolution', 'error');
    } finally {
      setSavingResolve(false);
    }
  };

  // ─── Quick resolve (direct preset submission) ─────────────────────────────
  const handleQuickResolve = async (shift: 'first' | 'second', reason: string) => {
    try {
      setSavingResolve(true);
      await api.post('/bakery-metrics/resolutions', {
        week_name: weekFilter,
        day_of_week: dayFilter,
        reason,
        resolved_by: currentUserName,
        shift_type: shift,
      });
      showNotification(`Resolution saved: ${reason}`, 'success');
      await loadShiftResolutions();
    } catch {
      showNotification('Failed to save resolution', 'error');
    } finally {
      setSavingResolve(false);
    }
  };

  const openMissingKpiModal = (shift: 'first' | 'second', line: 1 | 2, missingFields: Array<'oee' | 'pounds' | 'waste'>) => {
    setMissingKpiModal({ shift, line, missingFields });
    setMissingKpiForm({ oee: '', pounds: '', waste: '' });
    const width = 520;
    const startX = Math.max(20, Math.floor((window.innerWidth - width) / 2));
    setMissingModalPos({ x: startX, y: 120 });
  };

  const saveMissingKpi = async () => {
    if (!missingKpiModal || !metricsData.id) return;

    const values: { oee?: number; pounds?: number; waste_lbs?: number } = {};
    if (missingKpiModal.missingFields.includes('oee')) values.oee = Number(missingKpiForm.oee);
    if (missingKpiModal.missingFields.includes('pounds')) values.pounds = Number(missingKpiForm.pounds);
    if (missingKpiModal.missingFields.includes('waste')) values.waste_lbs = Number(missingKpiForm.waste);

    const invalid = Object.values(values).some(v => v === undefined || Number.isNaN(v));
    if (invalid) {
      showNotification('Please enter all required missing KPI values', 'warning');
      return;
    }

    setSavingMissingKpi(true);
    try {
      const res = await api.patch(`/bakery-metrics/both-shifts-records/${metricsData.id}/resolve-missing-kpis`, {
        shift: missingKpiModal.shift,
        line: missingKpiModal.line === 1 ? 'die_cut_1' : 'die_cut_2',
        values,
        updatedBy: currentUserName,
      });

      if (res.data?.success && res.data?.record) {
        setMetricsData(res.data.record);
      } else {
        await loadMetricsData(weekFilter, dayFilter);
      }

      setMissingKpiModal(null);
      showNotification('Missing KPI values updated', 'success');
    } catch (err: any) {
      showNotification(err?.response?.data?.error || 'Failed to update missing KPI values', 'error');
    } finally {
      setSavingMissingKpi(false);
    }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!missingDragRef.current.active) return;
      setMissingModalPos({
        x: Math.max(8, e.clientX - missingDragRef.current.offsetX),
        y: Math.max(8, e.clientY - missingDragRef.current.offsetY),
      });
    };

    const onMouseUp = () => {
      missingDragRef.current.active = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ─── Close dropdowns on outside click ────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(e.target as Node)) {
        setWeekDropdownOpen(false);
      }
      if (recordDropdownRef.current && !recordDropdownRef.current.contains(e.target as Node)) {
        setRecordDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Load KPI Targets ────────────────────────────────────────────────────
  const loadKpiTargets = useCallback(async () => {
    try {
      const res = await api.get('/bakery-metrics/kpi-targets');
      if (res.data?.success && res.data.targets) {
        setKpiTargets(res.data.targets);
      }
    } catch {
      // use defaults
    }
  }, []);

  // ─── Load Week Options ───────────────────────────────────────────────────
  const loadWeekOptions = useCallback(async () => {
    try {
      const res = await api.get('/bakery-metrics/week-options');
      if (res.data?.success && res.data.weeks) {
        setWeekOptions(res.data.weeks);
        if (res.data.weeks.length > 0 && !weekFilter) {
          setWeekFilter(res.data.default_week || res.data.weeks[0]);
        }
      }
    } catch {
      // generate defaults
      const now = new Date();
      const weekNum = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000);
      const opts = Array.from({ length: 5 }, (_, i) => `Week ${weekNum - i} - ${now.getFullYear()}`);
      setWeekOptions(opts);
      if (!weekFilter) setWeekFilter(opts[0]);
    }
  }, [weekFilter]);

  // ─── Load Available Records ──────────────────────────────────────────────
  const loadRecords = useCallback(async () => {
    try {
      const res = await api.get('/bakery-metrics/records');
      if (res.data?.success && res.data.records) {
        setRecordOptions(res.data.records.map((r: any) => {
          const date = new Date(r.createdAt || r.submission_date || r.created_at);
          const dateStr = !isNaN(date.getTime()) ? date.toLocaleDateString() : r.dayOfWeek || 'Unknown';
          const oee = r.bothShiftsMetrics?.oeeAvgPct ?? r.total_oee;
          const oeeStr = oee != null ? `OEE: ${Number(oee).toFixed(1)}%` : (r.dayOfWeek || '');
          return { id: r.id, label: `${dateStr} - ${oeeStr}` };
        }));
      }
    } catch {
      // empty
    }
  }, []);

  // ─── Load Metrics Data ───────────────────────────────────────────────────
  const loadMetricsData = useCallback(async (week?: string, day?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (week && week !== 'latest') params.append('week', week);
      if (day && day !== 'All') params.append('day', day);

      const res = await api.get(`/bakery-metrics/both-shifts-records?${params.toString()}`);
      const records = res.data?.records || res.data || [];

      if (Array.isArray(records) && records.length > 0) {
        setMetricsData(records[0]);
        checkCongrats(records[0]);
      } else {
        setMetricsData({});
        setShowCongrats(false);
        showNotification('No data found for selected filters', 'warning');
      }
    } catch {
      setMetricsData({});
      showNotification('Failed to load metrics data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // ─── Load Dashboard Metrics ──────────────────────────────────────────────
  const loadDashboardMetrics = useCallback(async (week?: string, day?: string) => {
    try {
      const params = new URLSearchParams();
      if (week && week !== 'latest') params.append('week', week);
      if (day && day !== 'All') params.append('day', day);

      const res = await api.get(`/bakery-metrics/report-dashboard-metrics?${params.toString()}`);
      if (res.data?.success && res.data.data) {
        setDashMetrics(res.data.data);
      }
    } catch {
      setDashMetrics({});
    }
  }, []);

  // ─── Congratulations check ───────────────────────────────────────────────
  const checkCongrats = (data: MetricsRecord) => {
    const t = kpiTargets;
    const allMet =
      (data.both_shift_die_cut1_oee || 0) >= t.oee.die_cut_1 &&
      (data.both_shift_die_cut2_oee || 0) >= t.oee.die_cut_2 &&
      (data.total_oee || 0) >= t.oee.total &&
      (data.both_shift_die_cut1_lbs || 0) >= t.volume.die_cut_1 &&
      (data.both_shift_die_cut2_lbs || 0) >= t.volume.die_cut_2 &&
      (data.total_production || 0) >= t.volume.total &&
      (data.both_shift_die_cut1_waste_pct || 0) <= t.waste.die_cut_1 &&
      (data.both_shift_die_cut2_waste_pct || 0) <= t.waste.die_cut_2 &&
      (data.total_waste_percent || 0) <= t.waste.total;
    setShowCongrats(allMet);
    onCongratsChange?.(allMet);
  };

  // ─── Week Summary ────────────────────────────────────────────────────────
  const loadWeekSummary = async () => {
    if (!weekFilter || weekFilter === 'latest') {
      showNotification('Select a specific week to calculate averages', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/bakery-metrics/week-average?week=${encodeURIComponent(weekFilter)}`);
      if (res.data?.success && res.data.averages) {
        const avg = res.data.averages;
        setMetricsData({
          first_shift_die_cut1_oee: avg.oee?.die_cut_1?.first_shift,
          first_shift_die_cut2_oee: avg.oee?.die_cut_2?.first_shift,
          first_shift_oee: avg.oee?.total?.first_shift,
          second_shift_die_cut1_oee: avg.oee?.die_cut_1?.second_shift,
          second_shift_die_cut2_oee: avg.oee?.die_cut_2?.second_shift,
          second_shift_oee: avg.oee?.total?.second_shift,
          both_shift_die_cut1_oee: avg.oee?.die_cut_1?.both_shifts,
          both_shift_die_cut2_oee: avg.oee?.die_cut_2?.both_shifts,
          total_oee: avg.oee?.total?.both_shifts,
          first_shift_die_cut1_lbs: avg.volume?.die_cut_1?.first_shift,
          first_shift_die_cut2_lbs: avg.volume?.die_cut_2?.first_shift,
          first_shift_production: avg.volume?.total?.first_shift,
          second_shift_die_cut1_lbs: avg.volume?.die_cut_1?.second_shift,
          second_shift_die_cut2_lbs: avg.volume?.die_cut_2?.second_shift,
          second_shift_production: avg.volume?.total?.second_shift,
          both_shift_die_cut1_lbs: avg.volume?.die_cut_1?.both_shifts,
          both_shift_die_cut2_lbs: avg.volume?.die_cut_2?.both_shifts,
          total_production: avg.volume?.total?.both_shifts,
          first_shift_die_cut1_waste_pct: avg.waste?.percentage?.die_cut_1?.first_shift,
          first_shift_die_cut2_waste_pct: avg.waste?.percentage?.die_cut_2?.first_shift,
          first_shift_waste_percent: avg.waste?.percentage?.total?.first_shift,
          second_shift_die_cut1_waste_pct: avg.waste?.percentage?.die_cut_1?.second_shift,
          second_shift_die_cut2_waste_pct: avg.waste?.percentage?.die_cut_2?.second_shift,
          second_shift_waste_percent: avg.waste?.percentage?.total?.second_shift,
          both_shift_die_cut1_waste_pct: avg.waste?.percentage?.die_cut_1?.both_shifts,
          both_shift_die_cut2_waste_pct: avg.waste?.percentage?.die_cut_2?.both_shifts,
          total_waste_percent: avg.waste?.percentage?.total?.both_shifts,
          cell_messages: avg.cell_messages,
        });
        setIsWeekSummary(true);
        showNotification(`Week summary calculated for ${res.data.period}`, 'success');
      }
    } catch {
      showNotification('Failed to calculate week summary', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Week Summary pre-check (scan missing data across the week) ──────────
  const requestWeekSummary = async () => {
    if (!weekFilter || weekFilter === 'latest') {
      showNotification('Select a specific week to calculate averages', 'warning');
      return;
    }
    setCheckingWeekSummary(true);
    try {
      const res = await api.get(`/bakery-metrics/both-shifts-records?week=${encodeURIComponent(weekFilter)}`);
      const records = res.data?.records || res.data || [];
      const missing: Array<{ day: string; shift: string; line: string; kpi: string }> = [];
      const shiftLabel = (s: 'first' | 'second') => (s === 'first' ? 'First Shift' : 'Second Shift');
      const kpiLabel: Record<'oee' | 'pounds' | 'waste', string> = {
        oee: 'OEE',
        pounds: 'Volume (lbs)',
        waste: 'Waste %',
      };
      const isMiss = (v: any) => v === undefined || v === null || Number(v) === 0;

      (Array.isArray(records) ? records : []).forEach((rec: any) => {
        const day = rec.day_of_week || rec.dayOfWeek || rec.day || 'Unknown Day';
        (['first', 'second'] as const).forEach((s) => {
          ([1, 2] as const).forEach((line) => {
            const keyBase = `${s}_shift_die_cut${line}`;
            const values = {
              oee: rec[`${keyBase}_oee`],
              pounds: rec[`${keyBase}_lbs`],
              waste: rec[`${keyBase}_waste_pct`],
            };
            const didNotRun = isMiss(values.oee) && isMiss(values.pounds) && isMiss(values.waste);
            const lineName = `Die Cut ${line}`;
            if (didNotRun) {
              missing.push({ day, shift: shiftLabel(s), line: lineName, kpi: 'All KPIs (no production run)' });
            } else {
              (['oee', 'pounds', 'waste'] as Array<'oee' | 'pounds' | 'waste'>).forEach((k) => {
                if (isMiss(values[k])) {
                  missing.push({ day, shift: shiftLabel(s), line: lineName, kpi: kpiLabel[k] });
                }
              });
            }
          });
        });
      });

      if (missing.length > 0) {
        setWeekSummaryConfirm({ missing });
      } else {
        await loadWeekSummary();
      }
    } catch {
      showNotification('Failed to check week data', 'error');
    } finally {
      setCheckingWeekSummary(false);
    }
  };

  // ─── Refresh all ─────────────────────────────────────────────────────────
  const refreshAll = async () => {
    showNotification('Refreshing all data...', 'info');
    setIsWeekSummary(false);
    await Promise.all([
      loadMetricsData(weekFilter, dayFilter),
      loadDashboardMetrics(weekFilter, dayFilter),
      loadRecords(),
      loadShiftResolutions(),
    ]);
    showNotification('Data refreshed', 'success');
  };

  // ─── Filter change handler ───────────────────────────────────────────────
  const onFilterChange = useCallback(async (week: string, day: string) => {
    setIsWeekSummary(false);
    await Promise.all([
      loadMetricsData(week, day),
      loadDashboardMetrics(week, day),
    ]);
  }, [loadMetricsData, loadDashboardMetrics]);

  // ─── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      await loadKpiTargets();
      await loadWeekOptions();
      await loadRecords();
      await loadShiftResolutions();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load data when weekFilter is set
  useEffect(() => {
    if (weekFilter) {
      loadMetricsData(weekFilter, dayFilter);
      loadDashboardMetrics(weekFilter, dayFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekFilter]);

  // Notify parent of filter state changes
  useEffect(() => {
    onFilterInfo?.({ week: weekFilter, day: dayFilter, totalRecords: recordOptions.length, isWeekSummary });
  }, [weekFilter, dayFilter, recordOptions.length, isWeekSummary, onFilterInfo]);

  // Handle actions triggered from parent (sticky header buttons)
  useEffect(() => {
    if (!triggerAction) return;
    if (triggerAction.type === 'refresh') refreshAll();
    else if (triggerAction.type === 'pdf') showNotification('PDF export coming soon', 'info');
    else if (triggerAction.type === 'excel') showNotification('Excel export coming soon', 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerAction]);

  // ─── Computed values for cards ───────────────────────────────────────────
  const oeeVal = dashMetrics.oeeCurrentValue ?? metricsData.total_oee ?? 0;
  const wasteVal = dashMetrics.wasteCurrentValue ?? metricsData.total_waste_percent ?? 0;
  const prodVal = dashMetrics.productionCurrentValue ?? metricsData.total_production ?? 0;
  const effVal = dashMetrics.efficiencyCurrentValue ?? 0;

  const d = metricsData;
  const t = kpiTargets;

  type KpiKey = 'oee' | 'pounds' | 'waste';
  type ShiftKey = 'first' | 'second';

  const isMissingValue = (v: number | undefined | null) => v === undefined || v === null || Number(v) === 0;

  const getLineValues = (shift: ShiftKey, line: 1 | 2) => {
    const keyBase = `${shift}_shift_die_cut${line}`;
    return {
      oee: d[`${keyBase}_oee`] as number | undefined,
      pounds: d[`${keyBase}_lbs`] as number | undefined,
      waste: d[`${keyBase}_waste_pct`] as number | undefined,
    };
  };

  const getLineState = (shift: ShiftKey, line: 1 | 2) => {
    const values = getLineValues(shift, line);
    const didNotRun = isMissingValue(values.oee) && isMissingValue(values.pounds) && isMissingValue(values.waste);
    const missing = {
      oee: !didNotRun && isMissingValue(values.oee),
      pounds: !didNotRun && isMissingValue(values.pounds),
      waste: !didNotRun && isMissingValue(values.waste),
    };
    return { values, didNotRun, partialMissing: missing.oee || missing.pounds || missing.waste, missing };
  };

  type LineState = {
    values: { oee: number | undefined | null; pounds: number | undefined | null; waste: number | undefined | null };
    didNotRun: boolean;
    missing: { oee: boolean; pounds: boolean; waste: boolean };
  };

  const combineTwoLines = (
    kpi: KpiKey,
    line1: LineState,
    line2: LineState,
    mode: 'avg' | 'sum'
  ): number | null => {
    const v1 = line1.values[kpi];
    const v2 = line2.values[kpi];
    const m1 = line1.missing[kpi];
    const m2 = line2.missing[kpi];

    if (line1.didNotRun && line2.didNotRun) return null;
    if (line1.didNotRun && !line2.didNotRun) return m2 ? null : (v2 ?? null);
    if (line2.didNotRun && !line1.didNotRun) return m1 ? null : (v1 ?? null);
    if (m1 || m2 || v1 === undefined || v2 === undefined || v1 === null || v2 === null) return null;

    return mode === 'sum' ? Number(v1) + Number(v2) : (Number(v1) + Number(v2)) / 2;
  };

  const combineTwoShiftsByLine = (line: 1 | 2, kpi: KpiKey): number | null => {
    const first = getLineState('first', line);
    const second = getLineState('second', line);
    const v1 = first.values[kpi];
    const v2 = second.values[kpi];
    const m1 = first.missing[kpi];
    const m2 = second.missing[kpi];

    if (first.didNotRun && second.didNotRun) return null;
    if (first.didNotRun && !second.didNotRun) return m2 ? null : (v2 ?? null);
    if (second.didNotRun && !first.didNotRun) return m1 ? null : (v1 ?? null);
    if (m1 || m2 || v1 === undefined || v2 === undefined || v1 === null || v2 === null) return null;

    if (kpi === 'pounds') return Number(v1) + Number(v2);
    return (Number(v1) + Number(v2)) / 2;
  };

  const fsLine1 = getLineState('first', 1);
  const fsLine2 = getLineState('first', 2);
  const ssLine1 = getLineState('second', 1);
  const ssLine2 = getLineState('second', 2);

  const firstShiftTotalOee = combineTwoLines('oee', fsLine1, fsLine2, 'avg');
  const firstShiftTotalPounds = combineTwoLines('pounds', fsLine1, fsLine2, 'sum');
  const firstShiftTotalWaste = combineTwoLines('waste', fsLine1, fsLine2, 'avg');
  const secondShiftTotalOee = combineTwoLines('oee', ssLine1, ssLine2, 'avg');
  const secondShiftTotalPounds = combineTwoLines('pounds', ssLine1, ssLine2, 'sum');
  const secondShiftTotalWaste = combineTwoLines('waste', ssLine1, ssLine2, 'avg');

  const bothShiftLine1 = {
    oee: combineTwoShiftsByLine(1, 'oee'),
    pounds: combineTwoShiftsByLine(1, 'pounds'),
    waste: combineTwoShiftsByLine(1, 'waste'),
  };
  const bothShiftLine2 = {
    oee: combineTwoShiftsByLine(2, 'oee'),
    pounds: combineTwoShiftsByLine(2, 'pounds'),
    waste: combineTwoShiftsByLine(2, 'waste'),
  };

  const bothLineState = (line: { oee: number | null; pounds: number | null; waste: number | null }) => {
    const didNotRun = isMissingValue(line.oee) && isMissingValue(line.pounds) && isMissingValue(line.waste);
    const missing = {
      oee: !didNotRun && isMissingValue(line.oee),
      pounds: !didNotRun && isMissingValue(line.pounds),
      waste: !didNotRun && isMissingValue(line.waste),
    };
    return { didNotRun, missing, values: line };
  };

  const bsLine1 = bothLineState(bothShiftLine1);
  const bsLine2 = bothLineState(bothShiftLine2);

  const bothShiftTotalOee = combineTwoLines('oee', bsLine1, bsLine2, 'avg');
  const bothShiftTotalPounds = combineTwoLines('pounds', bsLine1, bsLine2, 'sum');
  const bothShiftTotalWaste = combineTwoLines('waste', bsLine1, bsLine2, 'avg');

  const getCellDisplayMessage = (
    shift: 'first_shift' | 'second_shift' | 'both_shifts',
    line: 'die_cut_1' | 'die_cut_2',
    kpi: KpiKey,
    state: LineState,
    lineName: string
  ) => {
    const tableMessage = d.cell_messages?.[shift]?.[line]?.[kpi];
    if (tableMessage) return tableMessage as string;
    if (state.didNotRun) return `No Production Run${lineName ? ` on ${lineName}` : ''}`;
    if (state.missing[kpi]) return 'Missing Data?';
    return null;
  };

  // ─── Days ─────────────────────────────────────────────────────────────────
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // ─── Shift data detection (for overlays) ──────────────────────────────────
  const showFirstOverlay = !isWeekSummary && !d.has_first_shift;
  const showSecondOverlay = !isWeekSummary && !d.has_second_shift;
  const dayPassed = isDayPassed();
  const firstRes = getShiftResolution('first');
  const secondRes = getShiftResolution('second');

  // ─── Measure overlay column positions ──────────────────────────────────────
  useLayoutEffect(() => {
    const wrapper = tableWrapperRef.current;
    const tbody = tbodyRef.current;
    if (!wrapper || !tbody) return;

    const measure = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const tbodyRect = tbody.getBoundingClientRect();
      const newPos: typeof overlayPositions = {};

      if (showFirstOverlay && firstShiftThRef.current) {
        const thRect = firstShiftThRef.current.getBoundingClientRect();
        newPos.first = {
          left: thRect.left - wrapperRect.left + wrapper.scrollLeft,
          width: thRect.width,
          top: tbodyRect.top - wrapperRect.top + wrapper.scrollTop,
          height: tbodyRect.height,
        };
      }
      if (showSecondOverlay && secondShiftThRef.current) {
        const thRect = secondShiftThRef.current.getBoundingClientRect();
        newPos.second = {
          left: thRect.left - wrapperRect.left + wrapper.scrollLeft,
          width: thRect.width,
          top: tbodyRect.top - wrapperRect.top + wrapper.scrollTop,
          height: tbodyRect.height,
        };
      }
      setOverlayPositions(newPos);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFirstOverlay, showSecondOverlay, metricsData, compactView, loading]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white animate-fade-slide-in ${
              n.type === 'success' ? 'bg-emerald-600' : n.type === 'error' ? 'bg-red-600' : n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-600'
            }`}
          >
            {n.message}
          </div>
        ))}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 text-center">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Loading Analytics</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Processing performance data...</p>
          </div>
        </div>
      )}



      {/* ═══ METRICS TABLE ═══ */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
        {/* Table Controls Bar */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 lg:p-5 rounded-t-2xl relative z-10">
          <div className="flex flex-wrap items-center gap-2 max-w-full">
              {/* Week filter — custom dropdown */}
              <div ref={weekDropdownRef} className="relative flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                <label className="text-xs font-semibold text-blue-100 shrink-0">Week:</label>
                <button
                  type="button"
                  onClick={() => { setWeekDropdownOpen(v => !v); setRecordDropdownOpen(false); }}
                  className="flex items-center gap-1 bg-white/20 border border-white/30 rounded-md text-white text-xs px-2 py-1 hover:bg-white/30 transition-colors max-w-[180px] sm:max-w-[220px]"
                  title="Select week"
                >
                  <span className="truncate">{weekFilter || 'Select week'}</span>
                  <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${weekDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {weekDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto min-w-[200px] max-w-[260px]">
                    {weekOptions.map(w => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => { setWeekFilter(w); onFilterChange(w, dayFilter); setWeekDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors truncate ${
                          w === weekFilter ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {w === weekFilter && <span className="mr-1">✓</span>}{w}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Day filter — native select (few options, no scroll needed) */}
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                <label className="text-xs font-semibold text-blue-100">Day:</label>
                <select
                  value={dayFilter}
                  onChange={e => { setDayFilter(e.target.value); onFilterChange(weekFilter, e.target.value); }}
                  className="bg-white/20 border border-white/30 rounded-md text-white text-xs px-2 py-1 focus:ring-2 focus:ring-white/50"
                  title="Select day"
                >
                  {days.map(d => <option key={d} value={d} className="text-gray-900 bg-white">{d}</option>)}
                </select>
              </div>

              {/* Record selector — custom dropdown */}
              <div ref={recordDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setRecordDropdownOpen(v => !v); setWeekDropdownOpen(false); }}
                  className="flex items-center gap-1 bg-white/20 border border-white/30 rounded-lg text-white text-xs px-3 py-2 hover:bg-white/30 transition-colors max-w-[180px] sm:max-w-[220px]"
                  title="Select record"
                >
                  <span className="truncate">
                    {selectedRecord === 'latest' ? 'Latest Record' : (recordOptions.find(r => r.id === selectedRecord)?.label || 'Select record')}
                  </span>
                  <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${recordDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {recordDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto min-w-[200px] max-w-[280px]">
                    <button
                      type="button"
                      onClick={() => { setSelectedRecord('latest'); setRecordDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                        selectedRecord === 'latest' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {selectedRecord === 'latest' && <span className="mr-1">✓</span>}Latest Record
                    </button>
                    {recordOptions.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => { setSelectedRecord(r.id); setRecordDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors truncate ${
                          r.id === selectedRecord ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {r.id === selectedRecord && <span className="mr-1">✓</span>}{r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Week Summary toggle */}
              <button
                onClick={() => { isWeekSummary ? (() => { setIsWeekSummary(false); loadMetricsData(weekFilter, dayFilter); })() : requestWeekSummary(); }}
                disabled={checkingWeekSummary}
                className="px-3 py-2 text-xs bg-emerald-500/80 border border-emerald-400/50 rounded-lg text-white hover:bg-emerald-600/80 transition-colors font-semibold whitespace-nowrap active:scale-95 disabled:opacity-70 disabled:cursor-wait"
              >
                {checkingWeekSummary
                  ? <><Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />Checking...</>
                  : isWeekSummary
                    ? <><Calendar className="w-3.5 h-3.5 inline mr-1" />Daily</>
                    : <><CalendarCheck className="w-3.5 h-3.5 inline mr-1" />Week Summary</>}
              </button>

              {/* Compact toggle */}
              <button
                onClick={() => setCompactView(v => !v)}
                className="px-3 py-2 text-xs bg-white/20 border border-white/30 rounded-lg text-white hover:bg-white/30 transition-colors whitespace-nowrap active:scale-95"
              >
                {compactView ? <><Eye className="w-3.5 h-3.5 inline mr-1" />Full</> : <><EyeOff className="w-3.5 h-3.5 inline mr-1" />Compact</>}
              </button>

              {/* Refresh */}
              <button
                onClick={() => { refreshAll(); }}
                className="px-3 py-2 text-xs bg-white/20 border border-white/30 rounded-lg text-white hover:bg-white/30 transition-colors active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Refresh
              </button>

              {/* Email Report */}
              <button
                onClick={openEmailModal}
                className="px-3 py-2 text-xs bg-amber-500/80 border border-amber-400/50 rounded-lg text-white hover:bg-amber-600/80 transition-colors font-semibold whitespace-nowrap active:scale-95"
              >
                <Send className="w-3.5 h-3.5 inline mr-1" /> Email Report
              </button>
          </div>
        </div>

        {/* Table */}
        <div ref={tableWrapperRef} className={`overflow-x-auto overflow-hidden rounded-b-2xl relative ${compactView ? 'max-h-96 overflow-y-auto' : ''}`}>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">KPI Metric</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">Target</th>
                <th ref={firstShiftThRef} className="px-4 py-3 text-left text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-wider bg-blue-50/50 dark:bg-blue-900/20 min-w-[140px]">
                  First Shift{isWeekSummary && <><br /><span className="text-[8px]">WEEK SUMMARY</span></>}
                </th>
                <th ref={secondShiftThRef} className="px-4 py-3 text-left text-[10px] font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-wider bg-indigo-50/50 dark:bg-indigo-900/20 min-w-[140px]">
                  Second Shift{isWeekSummary && <><br /><span className="text-[8px]">WEEK SUMMARY</span></>}
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-purple-800 dark:text-purple-300 uppercase tracking-wider bg-purple-50/50 dark:bg-purple-900/20 min-w-[140px]">
                  Both Shifts{isWeekSummary && <><br /><span className="text-[8px]">WEEK SUMMARY</span></>}
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody ref={tbodyRef} className="divide-y divide-gray-100 dark:divide-gray-700">
              {/* ── OEE Section ── */}
              <tr className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                <td rowSpan={3} className="px-4 py-4 border-r border-gray-200 dark:border-gray-600 align-top">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                      <Gauge className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-gray-900 dark:text-white">OEE</div>
                      <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Overall Equipment Effectiveness</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2"><div className="text-xs font-semibold text-gray-900 dark:text-gray-100">Die Cut 1</div><div className="text-[10px] text-gray-500">≥ {t.oee.die_cut_1}%</div></td>
                <td className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10">
                  <MetricCell
                    value={fsLine1.values.oee}
                    suffix="%"
                    target={t.oee.die_cut_1}
                    missing={fsLine1.missing.oee}
                    didNotRun={fsLine1.didNotRun}
                    lineName="Die Cut 1"
                    displayMessage={getCellDisplayMessage('first_shift', 'die_cut_1', 'oee', fsLine1, 'Die Cut 1')}
                    onResolve={() => openMissingKpiModal('first', 1, fsLine1.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => fsLine1.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-900/10">
                  <MetricCell
                    value={ssLine1.values.oee}
                    suffix="%"
                    target={t.oee.die_cut_1}
                    missing={ssLine1.missing.oee}
                    didNotRun={ssLine1.didNotRun}
                    lineName="Die Cut 1"
                    displayMessage={getCellDisplayMessage('second_shift', 'die_cut_1', 'oee', ssLine1, 'Die Cut 1')}
                    onResolve={() => openMissingKpiModal('second', 1, ssLine1.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => ssLine1.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-purple-50/30 dark:bg-purple-900/10"><MetricCell value={bothShiftLine1.oee} suffix="%" target={t.oee.die_cut_1} didNotRun={bsLine1.didNotRun} lineName="Die Cut 1" displayMessage={getCellDisplayMessage('both_shifts', 'die_cut_1', 'oee', bsLine1, 'Die Cut 1')} /></td>
                <td className="px-4 py-2"><StatusBadge value={bothShiftLine1.oee} target={t.oee.die_cut_1} type="oee" /></td>
              </tr>
              <tr className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                <td className="px-4 py-2"><div className="text-xs font-semibold text-gray-900 dark:text-gray-100">Die Cut 2</div><div className="text-[10px] text-gray-500">≥ {t.oee.die_cut_2}%</div></td>
                <td className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10">
                  <MetricCell
                    value={fsLine2.values.oee}
                    suffix="%"
                    target={t.oee.die_cut_2}
                    missing={fsLine2.missing.oee}
                    didNotRun={fsLine2.didNotRun}
                    lineName="Die Cut 2"
                    displayMessage={getCellDisplayMessage('first_shift', 'die_cut_2', 'oee', fsLine2, 'Die Cut 2')}
                    onResolve={() => openMissingKpiModal('first', 2, fsLine2.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => fsLine2.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-900/10">
                  <MetricCell
                    value={ssLine2.values.oee}
                    suffix="%"
                    target={t.oee.die_cut_2}
                    missing={ssLine2.missing.oee}
                    didNotRun={ssLine2.didNotRun}
                    lineName="Die Cut 2"
                    displayMessage={getCellDisplayMessage('second_shift', 'die_cut_2', 'oee', ssLine2, 'Die Cut 2')}
                    onResolve={() => openMissingKpiModal('second', 2, ssLine2.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => ssLine2.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-purple-50/30 dark:bg-purple-900/10"><MetricCell value={bothShiftLine2.oee} suffix="%" target={t.oee.die_cut_2} didNotRun={bsLine2.didNotRun} lineName="Die Cut 2" displayMessage={getCellDisplayMessage('both_shifts', 'die_cut_2', 'oee', bsLine2, 'Die Cut 2')} /></td>
                <td className="px-4 py-2"><StatusBadge value={bothShiftLine2.oee} target={t.oee.die_cut_2} type="oee" /></td>
              </tr>
              <tr className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 border-b-4 border-gray-200 dark:border-gray-600">
                <td className="px-4 py-2"><div className="text-xs font-black text-gray-900 dark:text-gray-100">Total</div><div className="text-[10px] text-gray-500">≥ {t.oee.total}%</div></td>
                <td className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10"><MetricCell value={firstShiftTotalOee} suffix="%" target={t.oee.total} /></td>
                <td className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-900/10"><MetricCell value={secondShiftTotalOee} suffix="%" target={t.oee.total} /></td>
                <td className="px-4 py-2 bg-purple-50/30 dark:bg-purple-900/10"><MetricCell value={bothShiftTotalOee} suffix="%" target={t.oee.total} /></td>
                <td className="px-4 py-2"><StatusBadge value={bothShiftTotalOee} target={t.oee.total} type="oee" /></td>
              </tr>

              {/* ── VOLUME Section ── */}
              <tr className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10">
                <td rowSpan={3} className="px-4 py-4 border-r border-gray-200 dark:border-gray-600 align-top">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-md">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-gray-900 dark:text-white">VOLUME</div>
                      <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Production Output (lbs)</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2"><div className="text-xs font-semibold text-gray-900 dark:text-gray-100">Die Cut 1</div><div className="text-[10px] text-gray-500">≥ {t.volume.die_cut_1.toLocaleString()} lbs</div></td>
                <td className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10">
                  <MetricCell
                    value={fsLine1.values.pounds}
                    suffix=" lbs"
                    target={t.volume.die_cut_1 / 2}
                    isInteger
                    missing={fsLine1.missing.pounds}
                    didNotRun={fsLine1.didNotRun}
                    lineName="Die Cut 1"
                    displayMessage={getCellDisplayMessage('first_shift', 'die_cut_1', 'pounds', fsLine1, 'Die Cut 1')}
                    onResolve={() => openMissingKpiModal('first', 1, fsLine1.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => fsLine1.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-900/10">
                  <MetricCell
                    value={ssLine1.values.pounds}
                    suffix=" lbs"
                    target={t.volume.die_cut_1 / 2}
                    isInteger
                    missing={ssLine1.missing.pounds}
                    didNotRun={ssLine1.didNotRun}
                    lineName="Die Cut 1"
                    displayMessage={getCellDisplayMessage('second_shift', 'die_cut_1', 'pounds', ssLine1, 'Die Cut 1')}
                    onResolve={() => openMissingKpiModal('second', 1, ssLine1.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => ssLine1.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-purple-50/30 dark:bg-purple-900/10"><MetricCell value={bothShiftLine1.pounds} suffix=" lbs" target={t.volume.die_cut_1} isInteger didNotRun={bsLine1.didNotRun} lineName="Die Cut 1" displayMessage={getCellDisplayMessage('both_shifts', 'die_cut_1', 'pounds', bsLine1, 'Die Cut 1')} /></td>
                <td className="px-4 py-2"><StatusBadge value={bothShiftLine1.pounds} target={t.volume.die_cut_1} type="volume" /></td>
              </tr>
              <tr className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10">
                <td className="px-4 py-2"><div className="text-xs font-semibold text-gray-900 dark:text-gray-100">Die Cut 2</div><div className="text-[10px] text-gray-500">≥ {t.volume.die_cut_2.toLocaleString()} lbs</div></td>
                <td className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10">
                  <MetricCell
                    value={fsLine2.values.pounds}
                    suffix=" lbs"
                    target={t.volume.die_cut_2 / 2}
                    isInteger
                    missing={fsLine2.missing.pounds}
                    didNotRun={fsLine2.didNotRun}
                    lineName="Die Cut 2"
                    displayMessage={getCellDisplayMessage('first_shift', 'die_cut_2', 'pounds', fsLine2, 'Die Cut 2')}
                    onResolve={() => openMissingKpiModal('first', 2, fsLine2.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => fsLine2.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-900/10">
                  <MetricCell
                    value={ssLine2.values.pounds}
                    suffix=" lbs"
                    target={t.volume.die_cut_2 / 2}
                    isInteger
                    missing={ssLine2.missing.pounds}
                    didNotRun={ssLine2.didNotRun}
                    lineName="Die Cut 2"
                    displayMessage={getCellDisplayMessage('second_shift', 'die_cut_2', 'pounds', ssLine2, 'Die Cut 2')}
                    onResolve={() => openMissingKpiModal('second', 2, ssLine2.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => ssLine2.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-purple-50/30 dark:bg-purple-900/10"><MetricCell value={bothShiftLine2.pounds} suffix=" lbs" target={t.volume.die_cut_2} isInteger didNotRun={bsLine2.didNotRun} lineName="Die Cut 2" displayMessage={getCellDisplayMessage('both_shifts', 'die_cut_2', 'pounds', bsLine2, 'Die Cut 2')} /></td>
                <td className="px-4 py-2"><StatusBadge value={bothShiftLine2.pounds} target={t.volume.die_cut_2} type="volume" /></td>
              </tr>
              <tr className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 border-b-4 border-gray-200 dark:border-gray-600">
                <td className="px-4 py-2"><div className="text-xs font-black text-gray-900 dark:text-gray-100">Total</div><div className="text-[10px] text-gray-500">≥ {t.volume.total.toLocaleString()} lbs</div></td>
                <td className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10"><MetricCell value={firstShiftTotalPounds} suffix=" lbs" target={t.volume.total / 2} isInteger /></td>
                <td className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-900/10"><MetricCell value={secondShiftTotalPounds} suffix=" lbs" target={t.volume.total / 2} isInteger /></td>
                <td className="px-4 py-2 bg-purple-50/30 dark:bg-purple-900/10"><MetricCell value={bothShiftTotalPounds} suffix=" lbs" target={t.volume.total} isInteger /></td>
                <td className="px-4 py-2"><StatusBadge value={bothShiftTotalPounds} target={t.volume.total} type="volume" /></td>
              </tr>

              {/* ── WASTE Section ── */}
              <tr className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                <td rowSpan={3} className="px-4 py-4 border-r border-gray-200 dark:border-gray-600 align-top">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-md">
                      <Trash2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-gray-900 dark:text-white">WASTE</div>
                      <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Material Waste Percentage</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2"><div className="text-xs font-semibold text-gray-900 dark:text-gray-100">Die Cut 1</div><div className="text-[10px] text-gray-500">≤ {t.waste.die_cut_1}%</div></td>
                <td className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10">
                  <MetricCell
                    value={fsLine1.values.waste}
                    suffix="%"
                    target={t.waste.die_cut_1}
                    isReverse
                    missing={fsLine1.missing.waste}
                    didNotRun={fsLine1.didNotRun}
                    lineName="Die Cut 1"
                    displayMessage={getCellDisplayMessage('first_shift', 'die_cut_1', 'waste', fsLine1, 'Die Cut 1')}
                    onResolve={() => openMissingKpiModal('first', 1, fsLine1.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => fsLine1.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-900/10">
                  <MetricCell
                    value={ssLine1.values.waste}
                    suffix="%"
                    target={t.waste.die_cut_1}
                    isReverse
                    missing={ssLine1.missing.waste}
                    didNotRun={ssLine1.didNotRun}
                    lineName="Die Cut 1"
                    displayMessage={getCellDisplayMessage('second_shift', 'die_cut_1', 'waste', ssLine1, 'Die Cut 1')}
                    onResolve={() => openMissingKpiModal('second', 1, ssLine1.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => ssLine1.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-purple-50/30 dark:bg-purple-900/10"><MetricCell value={bothShiftLine1.waste} suffix="%" target={t.waste.die_cut_1} isReverse didNotRun={bsLine1.didNotRun} lineName="Die Cut 1" displayMessage={getCellDisplayMessage('both_shifts', 'die_cut_1', 'waste', bsLine1, 'Die Cut 1')} /></td>
                <td className="px-4 py-2"><StatusBadge value={bothShiftLine1.waste} target={t.waste.die_cut_1} type="waste" /></td>
              </tr>
              <tr className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                <td className="px-4 py-2"><div className="text-xs font-semibold text-gray-900 dark:text-gray-100">Die Cut 2</div><div className="text-[10px] text-gray-500">≤ {t.waste.die_cut_2}%</div></td>
                <td className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10">
                  <MetricCell
                    value={fsLine2.values.waste}
                    suffix="%"
                    target={t.waste.die_cut_2}
                    isReverse
                    missing={fsLine2.missing.waste}
                    didNotRun={fsLine2.didNotRun}
                    lineName="Die Cut 2"
                    displayMessage={getCellDisplayMessage('first_shift', 'die_cut_2', 'waste', fsLine2, 'Die Cut 2')}
                    onResolve={() => openMissingKpiModal('first', 2, fsLine2.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => fsLine2.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-900/10">
                  <MetricCell
                    value={ssLine2.values.waste}
                    suffix="%"
                    target={t.waste.die_cut_2}
                    isReverse
                    missing={ssLine2.missing.waste}
                    didNotRun={ssLine2.didNotRun}
                    lineName="Die Cut 2"
                    displayMessage={getCellDisplayMessage('second_shift', 'die_cut_2', 'waste', ssLine2, 'Die Cut 2')}
                    onResolve={() => openMissingKpiModal('second', 2, ssLine2.didNotRun ? ['oee', 'pounds', 'waste'] : (['oee', 'pounds', 'waste'].filter((k) => ssLine2.missing[k as KpiKey]) as Array<'oee' | 'pounds' | 'waste'>))}
                  />
                </td>
                <td className="px-4 py-2 bg-purple-50/30 dark:bg-purple-900/10"><MetricCell value={bothShiftLine2.waste} suffix="%" target={t.waste.die_cut_2} isReverse didNotRun={bsLine2.didNotRun} lineName="Die Cut 2" displayMessage={getCellDisplayMessage('both_shifts', 'die_cut_2', 'waste', bsLine2, 'Die Cut 2')} /></td>
                <td className="px-4 py-2"><StatusBadge value={bothShiftLine2.waste} target={t.waste.die_cut_2} type="waste" /></td>
              </tr>
              <tr className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                <td className="px-4 py-2"><div className="text-xs font-black text-gray-900 dark:text-gray-100">Total</div><div className="text-[10px] text-gray-500">≤ {t.waste.total}%</div></td>
                <td className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10"><MetricCell value={firstShiftTotalWaste} suffix="%" target={t.waste.total} isReverse /></td>
                <td className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-900/10"><MetricCell value={secondShiftTotalWaste} suffix="%" target={t.waste.total} isReverse /></td>
                <td className="px-4 py-2 bg-purple-50/30 dark:bg-purple-900/10"><MetricCell value={bothShiftTotalWaste} suffix="%" target={t.waste.total} isReverse /></td>
                <td className="px-4 py-2"><StatusBadge value={bothShiftTotalWaste} target={t.waste.total} type="waste" /></td>
              </tr>
            </tbody>
          </table>

          {/* ─── Frosted Glass Column Overlays ─── */}
          {showFirstOverlay && overlayPositions.first && (
            <div
              className="absolute z-20 pointer-events-none"
              style={{
                left: overlayPositions.first.left,
                top: overlayPositions.first.top,
                width: overlayPositions.first.width,
                height: overlayPositions.first.height,
              }}
            >
              {/* Glass blur layer */}
              <div className="absolute inset-0 backdrop-blur-[3px] bg-blue-50/50 dark:bg-gray-800/55 border-x border-gray-200/50 dark:border-gray-600/50" />
              {/* Content */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full p-4 text-center pointer-events-auto animate-overlay-fade-in group">
                {/* Hover hint tooltip */}
                <div className="absolute top-3 right-3 z-30">
                  <div className="relative">
                    <div className="p-1.5 rounded-full bg-white/70 dark:bg-gray-700/70 shadow-sm cursor-help hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors peer">
                      <Info className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div className="absolute right-0 top-full mt-2 w-56 opacity-0 invisible peer-hover:opacity-100 peer-hover:visible transition-all duration-300 ease-out transform translate-y-1 peer-hover:translate-y-0 z-40">
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-600 p-3.5 text-left">
                        <div className="absolute -top-1.5 right-3 w-3 h-3 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-600 rotate-45" />
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100 mb-2">First Shift — Missing Data</p>
                        <div className="space-y-1.5 text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed">
                          <p><span className="font-semibold text-gray-700 dark:text-gray-200">Day:</span> {dayFilter}</p>
                          <p><span className="font-semibold text-gray-700 dark:text-gray-200">Week:</span> {formatWeekRange(weekFilter)}</p>
                          <p><span className="font-semibold text-gray-700 dark:text-gray-200">Status:</span> {firstRes ? '✅ Resolved' : dayPassed ? '⚠️ Past due — action needed' : '🕐 Awaiting submission'}</p>
                          {firstRes && <p><span className="font-semibold text-gray-700 dark:text-gray-200">Reason:</span> {firstRes.reason}</p>}
                          {firstRes && <p><span className="font-semibold text-gray-700 dark:text-gray-200">Resolved by:</span> {firstRes.resolvedBy}</p>}
                          {!firstRes && dayPassed && <p className="text-amber-600 dark:text-amber-400 font-medium mt-1">Use the quick options below or click Other Reason to explain why this shift has no data.</p>}
                          {!firstRes && !dayPassed && <p className="text-blue-600 dark:text-blue-400 font-medium mt-1">Data can still be submitted for this shift. No action required yet.</p>}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                          <p className="text-[9px] text-gray-400 dark:text-gray-500 italic">Hover over this icon anytime for details</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-white/80 dark:bg-gray-700/80 rounded-full mb-3 shadow-lg animate-gentle-float">
                  <ClipboardX className="w-7 h-7 text-gray-400 dark:text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-0.5 drop-shadow-sm">No record submitted Yet</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">First Shift data is missing</p>
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{dayFilter} · {formatWeekRange(weekFilter)}</p>
                {dayPassed && !firstRes && (
                  <div className="mt-4 space-y-2.5 w-full max-w-[200px]">
                    <div className="px-3 py-2 bg-amber-100/90 dark:bg-amber-900/40 rounded-xl border border-amber-300 dark:border-amber-700 animate-subtle-pulse">
                      <div className="flex items-center gap-1.5 justify-center">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Did you Forget Something?</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {['Production canceled', 'Plant Shutdown', 'Not Scheduled to Run'].map(reason => (
                        <button
                          key={reason}
                          onClick={() => handleQuickResolve('first', reason)}
                          disabled={savingResolve}
                          className="w-full px-3 py-2 text-[11px] font-semibold rounded-lg border transition-all duration-200 bg-white/90 dark:bg-gray-700/90 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-700 dark:hover:text-blue-300 active:scale-[0.97] shadow-sm disabled:opacity-50"
                        >
                          {reason}
                        </button>
                      ))}
                      <button
                        onClick={() => setResolveModal({ shift: 'first' })}
                        className="w-full px-3 py-2 text-[11px] font-bold rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-md transition-all active:scale-[0.97] mt-1"
                      >
                        Other Reason...
                      </button>
                    </div>
                  </div>
                )}
                {firstRes && (
                  <div className="mt-4 p-3 bg-green-50/90 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-700 max-w-[200px] w-full animate-ripple-glow">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-subtle-pulse" />
                      <p className="text-[10px] font-bold text-green-700 dark:text-green-300">Resolved</p>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MessageSquare className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-green-600 dark:text-green-400 leading-relaxed">{firstRes.reason}</p>
                    </div>
                    <p className="text-xs font-semibold text-green-500 dark:text-green-400 mt-2 animate-shimmer-text">by {firstRes.resolvedBy}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {showSecondOverlay && overlayPositions.second && (
            <div
              className="absolute z-20 pointer-events-none"
              style={{
                left: overlayPositions.second.left,
                top: overlayPositions.second.top,
                width: overlayPositions.second.width,
                height: overlayPositions.second.height,
              }}
            >
              {/* Glass blur layer */}
              <div className="absolute inset-0 backdrop-blur-[3px] bg-indigo-50/50 dark:bg-gray-800/55 border-x border-gray-200/50 dark:border-gray-600/50" />
              {/* Content */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full p-4 text-center pointer-events-auto animate-overlay-fade-in group">
                {/* Hover hint tooltip */}
                <div className="absolute top-3 right-3 z-30">
                  <div className="relative">
                    <div className="p-1.5 rounded-full bg-white/70 dark:bg-gray-700/70 shadow-sm cursor-help hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors peer">
                      <Info className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div className="absolute right-0 top-full mt-2 w-56 opacity-0 invisible peer-hover:opacity-100 peer-hover:visible transition-all duration-300 ease-out transform translate-y-1 peer-hover:translate-y-0 z-40">
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-600 p-3.5 text-left">
                        <div className="absolute -top-1.5 right-3 w-3 h-3 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-600 rotate-45" />
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100 mb-2">Second Shift — Missing Data</p>
                        <div className="space-y-1.5 text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed">
                          <p><span className="font-semibold text-gray-700 dark:text-gray-200">Day:</span> {dayFilter}</p>
                          <p><span className="font-semibold text-gray-700 dark:text-gray-200">Week:</span> {formatWeekRange(weekFilter)}</p>
                          <p><span className="font-semibold text-gray-700 dark:text-gray-200">Status:</span> {secondRes ? '✅ Resolved' : dayPassed ? '⚠️ Past due — action needed' : '🕐 Awaiting submission'}</p>
                          {secondRes && <p><span className="font-semibold text-gray-700 dark:text-gray-200">Reason:</span> {secondRes.reason}</p>}
                          {secondRes && <p><span className="font-semibold text-gray-700 dark:text-gray-200">Resolved by:</span> {secondRes.resolvedBy}</p>}
                          {!secondRes && dayPassed && <p className="text-amber-600 dark:text-amber-400 font-medium mt-1">Use the quick options below or click Other Reason to explain why this shift has no data.</p>}
                          {!secondRes && !dayPassed && <p className="text-blue-600 dark:text-blue-400 font-medium mt-1">Data can still be submitted for this shift. No action required yet.</p>}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                          <p className="text-[9px] text-gray-400 dark:text-gray-500 italic">Hover over this icon anytime for details</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-white/80 dark:bg-gray-700/80 rounded-full mb-3 shadow-lg animate-gentle-float">
                  <ClipboardX className="w-7 h-7 text-gray-400 dark:text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-0.5 drop-shadow-sm">No record submitted Yet</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Second Shift data is missing</p>
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{dayFilter} · {formatWeekRange(weekFilter)}</p>
                {dayPassed && !secondRes && (
                  <div className="mt-4 space-y-2.5 w-full max-w-[200px]">
                    <div className="px-3 py-2 bg-amber-100/90 dark:bg-amber-900/40 rounded-xl border border-amber-300 dark:border-amber-700 animate-subtle-pulse">
                      <div className="flex items-center gap-1.5 justify-center">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Did you Forget Something?</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {['Production canceled', 'Plant Shutdown', 'Not Scheduled to Run'].map(reason => (
                        <button
                          key={reason}
                          onClick={() => handleQuickResolve('second', reason)}
                          disabled={savingResolve}
                          className="w-full px-3 py-2 text-[11px] font-semibold rounded-lg border transition-all duration-200 bg-white/90 dark:bg-gray-700/90 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 active:scale-[0.97] shadow-sm disabled:opacity-50"
                        >
                          {reason}
                        </button>
                      ))}
                      <button
                        onClick={() => setResolveModal({ shift: 'second' })}
                        className="w-full px-3 py-2 text-[11px] font-bold rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-md transition-all active:scale-[0.97] mt-1"
                      >
                        Other Reason...
                      </button>
                    </div>
                  </div>
                )}
                {secondRes && (
                  <div className="mt-4 p-3 bg-green-50/90 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-700 max-w-[200px] w-full animate-ripple-glow">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-subtle-pulse" />
                      <p className="text-[10px] font-bold text-green-700 dark:text-green-300">Resolved</p>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MessageSquare className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-green-600 dark:text-green-400 leading-relaxed">{secondRes.reason}</p>
                    </div>
                    <p className="text-xs font-semibold text-green-500 dark:text-green-400 mt-2 animate-shimmer-text">by {secondRes.resolvedBy}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ PERFORMANCE SUMMARY CARDS ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PerfCard
          icon={<Gauge className="w-6 h-6 text-white" />}
          iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
          title="Overall Equipment Effectiveness"
          value={oeeVal.toFixed(1)}
          unit="%"
          status={dashMetrics.oeeStatus || (oeeVal >= t.oee.total ? 'Target Met' : 'Below Target')}
          statusGood={oeeVal >= t.oee.total}
          change={dashMetrics.oeeChange || `${oeeVal >= t.oee.total ? '+' : ''}${(oeeVal - t.oee.total).toFixed(1)}%`}
          changeGood={oeeVal >= t.oee.total}
          subtext={dashMetrics.oeeVsTarget || `vs target (${t.oee.total}%)`}
        />
        <PerfCard
          icon={<Trash2 className="w-6 h-6 text-white" />}
          iconBg="bg-gradient-to-br from-red-500 to-red-600"
          title="Waste Percentage"
          value={wasteVal.toFixed(2)}
          unit="%"
          status={dashMetrics.wasteStatus || (wasteVal <= t.waste.total ? 'Below Target' : 'Above Target')}
          statusGood={wasteVal <= t.waste.total}
          change={dashMetrics.wasteChange || `${wasteVal <= t.waste.total ? '-' : '+'}${Math.abs(wasteVal - t.waste.total).toFixed(2)}%`}
          changeGood={wasteVal <= t.waste.total}
          subtext={dashMetrics.wasteVsTarget || `vs target (${t.waste.total}%)`}
        />
        <PerfCard
          icon={<Package className="w-6 h-6 text-white" />}
          iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
          title="Production Volume"
          value={prodVal.toLocaleString()}
          unit="lbs"
          status={dashMetrics.productionStatus || (prodVal >= t.volume.total ? 'Above Target' : 'Below Target')}
          statusGood={prodVal >= t.volume.total}
          change={dashMetrics.productionChange || `${prodVal >= t.volume.total ? '+' : '-'}${Math.abs(prodVal - t.volume.total).toLocaleString()} lbs`}
          changeGood={prodVal >= t.volume.total}
          subtext={dashMetrics.productionDailyOutput || 'daily output'}
        />
        <PerfCard
          icon={<Zap className="w-6 h-6 text-white" />}
          iconBg="bg-gradient-to-br from-amber-500 to-amber-600"
          title="Efficiency Score"
          value={effVal.toFixed(1)}
          unit="/10"
          status={dashMetrics.efficiencyStatus || (effVal >= 7 ? 'Good' : 'Fair')}
          statusGood={effVal >= 7}
          change={dashMetrics.efficiencyChange || 'Stable'}
          changeGood={null}
          subtext={dashMetrics.efficiencyPerformanceIndex || 'performance index'}
        />
      </div>

      {/* ═══ MISSING KPI RESOLVE MODAL (DRAGGABLE, NO BLUR) ═══ */}
      {missingKpiModal && (
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setMissingKpiModal(null)}>
          <div
            className="fixed w-full max-w-[520px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700"
            style={{ left: missingModalPos?.x ?? 80, top: missingModalPos?.y ?? 120 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 cursor-move select-none bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl"
              onMouseDown={(e) => {
                missingDragRef.current.active = true;
                const rect = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
                missingDragRef.current.offsetX = e.clientX - rect.left;
                missingDragRef.current.offsetY = e.clientY - rect.top;
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Resolve Missing KPI Data</h3>
                  <p className="text-xs text-amber-100 mt-0.5">
                    {missingKpiModal.shift === 'first' ? 'First Shift' : 'Second Shift'} · Die Cut {missingKpiModal.line}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMissingKpiModal(null)}
                  title="Close missing KPI modal"
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {missingKpiModal.missingFields.includes('oee') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">OEE (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    title="OEE percent"
                    placeholder="Enter OEE %"
                    value={missingKpiForm.oee}
                    onChange={(e) => setMissingKpiForm((prev) => ({ ...prev, oee: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              {missingKpiModal.missingFields.includes('pounds') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Pounds (lbs)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    title="Pounds in lbs"
                    placeholder="Enter pounds"
                    value={missingKpiForm.pounds}
                    onChange={(e) => setMissingKpiForm((prev) => ({ ...prev, pounds: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              {missingKpiModal.missingFields.includes('waste') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Waste (lbs)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    title="Waste in lbs"
                    placeholder="Enter waste lbs"
                    value={missingKpiForm.waste}
                    onChange={(e) => setMissingKpiForm((prev) => ({ ...prev, waste: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMissingKpiModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveMissingKpi}
                  disabled={savingMissingKpi}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingMissingKpi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {savingMissingKpi ? 'Updating...' : 'Save/Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RESOLVE MODAL ═══ */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setResolveModal(null); setResolveReason(''); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 animate-fade-slide-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`p-5 rounded-t-2xl ${resolveModal.shift === 'first' ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-indigo-600 to-purple-600'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Resolve Missing Data</h3>
                    <p className="text-xs text-white/80 mt-0.5">
                      {resolveModal.shift === 'first' ? 'First' : 'Second'} Shift — {dayFilter}, {formatWeekRange(weekFilter)}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setResolveModal(null); setResolveReason(''); }} title="Close" className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Why is {resolveModal.shift === 'first' ? 'First' : 'Second'} Shift data missing?
                </label>
                {/* Quick Respond presets */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {['Production canceled', 'Plant Shutdown', 'Not Scheduled to Run'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setResolveReason(preset)}
                      className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all duration-200 ${
                        resolveReason === preset
                          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm scale-[1.02]'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  value={resolveReason}
                  onChange={e => setResolveReason(e.target.value)}
                  placeholder="e.g., Machine was down for maintenance, Shift was cancelled, Data entry delayed..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  autoFocus
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                  This reason will appear in the report and Data Completeness Tracker.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => { setResolveModal(null); setResolveReason(''); }}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolveSubmit}
                  disabled={!resolveReason.trim() || savingResolve}
                  className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-md flex items-center gap-1.5"
                >
                  {savingResolve ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {savingResolve ? 'Saving...' : 'Submit Resolution'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EMAIL REPORT MODAL ═══ */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEmailModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5" /> Email Report
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">Send bakery production report to selected users</p>
              </div>
              <button onClick={() => setShowEmailModal(false)} title="Close email modal" className="text-white/70 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-160px)]">
              {/* Week & Day Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Week</label>
                  <select
                    value={emailWeek}
                    onChange={e => setEmailWeek(e.target.value)}
                    title="Select week"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select week</option>
                    {weekOptions.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Day</label>
                  <select
                    value={emailDay}
                    onChange={e => setEmailDay(e.target.value)}
                    title="Select day"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Email Message */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Email Message <span className="font-normal text-gray-400">(optional)</span></label>
                <textarea
                  value={emailCustomMessage}
                  onChange={e => setEmailCustomMessage(e.target.value)}
                  placeholder={`A saved bakery production report has been submitted for ${emailDay || 'this day'}. Please find the detailed KPI report attached as a PDF.`}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Leave blank to use the default message</p>
              </div>

              {/* User Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Select Recipients</label>
                  <button
                    type="button"
                    onClick={toggleAllUsers}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {emailSelectedUsers.length === emailEligibleUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                {emailLoadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <span className="ml-2 text-sm text-gray-500">Loading users...</span>
                  </div>
                ) : emailEligibleUsers.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No eligible users found
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                    {emailEligibleUsers.map(u => (
                      <label
                        key={u.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                          emailSelectedUsers.includes(u.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={emailSelectedUsers.includes(u.id)}
                          onChange={() => toggleUserSelection(u.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.firstName} {u.lastName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                        </div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{u.role}</span>
                      </label>
                    ))}
                  </div>
                )}
                {emailSelectedUsers.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{emailSelectedUsers.length} user(s) selected</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={emailSending || emailSelectedUsers.length === 0 || !emailWeek}
                className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {emailSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-4 h-4" /> Send Report</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Week Summary — Missing Data Confirmation Modal */}
      {weekSummaryConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-overlay-fade-in">
          <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-bounce-in">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center animate-gentle-float">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold leading-tight">Heads up — some data is missing</h3>
                  <p className="text-xs text-white/90 mt-0.5">Please review before viewing the week summary.</p>
                </div>
                <button
                  onClick={() => setWeekSummaryConfirm(null)}
                  className="ml-2 text-white/80 hover:text-white hover:bg-white/20 rounded-md p-1 transition-colors"
                  title="Close"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 text-sm text-gray-700 dark:text-gray-200 space-y-3">
              <p className="leading-relaxed">
                The <span className="font-semibold">Week Summary</span> for{' '}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{weekFilter}</span>{' '}
                will be computed using only the data currently available. A few entries are missing and will not be included in the KPI averages.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                For the most accurate picture of both Die Cut lines, we recommend resolving the items below first. You can still proceed if you&apos;d like a quick look at the week so far.
              </p>

              <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
                <div className="px-3 py-2 bg-amber-100/70 dark:bg-amber-900/40 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200 flex items-center justify-between">
                  <span>Missing entries ({weekSummaryConfirm.missing.length})</span>
                  <span className="text-amber-700 dark:text-amber-300 normal-case font-medium">Day · Shift · Line · KPI</span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-amber-100 dark:divide-amber-900/40">
                  {weekSummaryConfirm.missing.map((m, i) => (
                    <div key={i} className="px-3 py-2 text-xs flex items-center gap-2">
                      <ClipboardX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="font-semibold text-gray-800 dark:text-gray-100 w-20 flex-shrink-0 truncate">{m.day}</span>
                      <span className="text-gray-600 dark:text-gray-300 w-24 flex-shrink-0 truncate">{m.shift}</span>
                      <span className="text-gray-600 dark:text-gray-300 w-20 flex-shrink-0 truncate">{m.line}</span>
                      <span className="text-amber-700 dark:text-amber-300 font-medium truncate">{m.kpi}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                onClick={() => setWeekSummaryConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={async () => {
                  setWeekSummaryConfirm(null);
                  await loadWeekSummary();
                }}
                className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center gap-2 shadow-md active:scale-95"
              >
                <CalendarCheck className="w-4 h-4" />
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-slide-in { animation: fadeSlideIn 0.25s ease-out; }

        @keyframes overlayFadeIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-overlay-fade-in { animation: overlayFadeIn 0.5s cubic-bezier(0.22, 1, 0.36, 1); }

        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-gentle-float { animation: gentleFloat 3s ease-in-out infinite; }

        @keyframes subtlePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.82; transform: scale(1.03); }
        }
        .animate-subtle-pulse { animation: subtlePulse 2.5s ease-in-out infinite; }

        @keyframes shimmerText {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .animate-shimmer-text {
          background: linear-gradient(90deg, #22c55e 0%, #86efac 25%, #bbf7d0 50%, #86efac 75%, #22c55e 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerText 3s linear infinite;
        }

        @keyframes rippleGlow {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 12px 4px rgba(34, 197, 94, 0.15); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        .animate-ripple-glow { animation: rippleGlow 2s ease-in-out infinite; }

        @keyframes bounceIn {
          0%   { opacity: 0; transform: scale(0.3) translateY(-40px); }
          50%  { opacity: 1; transform: scale(1.05) translateY(6px); }
          70%  { transform: scale(0.97) translateY(-3px); }
          85%  { transform: scale(1.01) translateY(1px); }
          100% { transform: scale(1) translateY(0); }
        }
        .animate-bounce-in { animation: bounceIn 0.6s cubic-bezier(0.22, 1.2, 0.36, 1) both; }
      `}</style>
    </div>
  );
}
