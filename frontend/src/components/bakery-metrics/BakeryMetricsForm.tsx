'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import LoadingState from '@/components/ui/LoadingState';
import api from '@/lib/api';
import {
  FileText,
  Calendar,
  CalendarDays,
  User,
  Target,
  TrendingDown,
  Clock,
  Info,
  BarChart3,
  Sun,
  Moon,
  Gauge,
  Package,
  Trash2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  History,
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Database,
  Inbox,
  Loader2,
  ClipboardList,
  Shield,
  MessageSquare,
  PenLine,
  ExternalLink,
  Filter,
  Plus,
  Minus,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface FormData {
  week_name: string;
  day_of_week: string;
  submitted_by: string;
  first_die_cut1_oee_pct: string;
  first_die_cut2_oee_pct: string;
  first_die_cut1_pounds: string;
  first_die_cut2_pounds: string;
  first_die_cut1_waste_lbs: string;
  first_die_cut2_waste_lbs: string;
  second_die_cut1_oee_pct: string;
  second_die_cut2_oee_pct: string;
  second_die_cut1_pounds: string;
  second_die_cut2_pounds: string;
  second_die_cut1_waste_lbs: string;
  second_die_cut2_waste_lbs: string;
}

interface ValidationAlert {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

interface Submission {
  id?: string;
  week_name: string;
  day_of_week: string;
  submitted_by: string;
  status: string;
  time_ago?: string;
  title?: string;
}

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ─── Helper: current week name ──────────────────────────────────────────────────
function getCurrentWeekName(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 604800000;
  const weekNum = Math.ceil((diff / oneWeek) + 1);
  return `Week ${weekNum} - ${now.getFullYear()}`;
}

function getCurrentDayName(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = days[new Date().getDay()];
  if (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day)) return day;
  return '';
}

// ─── Helper: format week name readably ──────────────────────────────────────────
function formatWeekReadable(weekName: string): string {
  // Converts "03-16-2026_03-20-2026" → "Mar 16 – Mar 20, 2026"
  const parts = weekName.split('_');
  if (parts.length !== 2) return weekName;
  const fmt = (dateStr: string) => {
    const [m, d, y] = dateStr.split('-');
    if (!m || !d || !y) return dateStr;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: undefined as any });
  };
  const [startStr, endStr] = parts;
  const endYear = endStr.split('-')[2] || '';
  return `${fmt(startStr)} – ${fmt(endStr)}, ${endYear}`;
}

// ─── Helper: parse week start/end dates from week_name ─────────────────────────
function parseWeekDates(weekName: string): { start: Date; end: Date } | null {
  const parts = weekName.split('_');
  if (parts.length !== 2) return null;
  const parseDate = (dateStr: string) => {
    const [m, d, y] = dateStr.split('-');
    if (!m || !d || !y) return null;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return isNaN(date.getTime()) ? null : date;
  };
  const start = parseDate(parts[0]);
  const end = parseDate(parts[1]);
  if (!start || !end) return null;
  return { start, end };
}

// ─── Helper: get a day's actual date within a week ──────────────────────────────
function getDayDate(weekName: string, dayName: string): Date | null {
  const dates = parseWeekDates(weekName);
  if (!dates) return null;
  const dayOffsets: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 };
  const offset = dayOffsets[dayName];
  if (offset === undefined) return null;
  const dayDate = new Date(dates.start);
  dayDate.setDate(dayDate.getDate() + offset);
  dayDate.setHours(0, 0, 0, 0);
  return dayDate;
}

// ─── Component ──────────────────────────────────────────────────────────────────
interface BakeryMetricsFormProps {
  onStepChange?: (step: number, total: number) => void;
  openRecentSubmissions?: number; // timestamp trigger from parent
  openTrackerModal?: number; // timestamp trigger from parent
  onFillNow?: (weekName: string, dayOfWeek: string) => void; // callback when Fill Now is clicked in tracker
  prefillWeekDay?: { weekName: string; dayOfWeek: string; ts: number } | null; // prefill week/day from parent
  onSuccessClose?: () => void; // callback when Close is clicked on success modal
}

export default function BakeryMetricsForm({ onStepChange, openRecentSubmissions, openTrackerModal, onFillNow, prefillWeekDay, onSuccessClose }: BakeryMetricsFormProps) {
  const { user } = useAuth();
  const { theme } = useTheme();

  // Steps
  const totalSteps = 3;
  const [currentStep, setCurrentStep] = useState(1);

  // Notify parent of step changes
  useEffect(() => {
    onStepChange?.(currentStep, totalSteps);
  }, [currentStep, onStepChange]);

  // Fetch available weeks from database
  useEffect(() => {
    const loadWeeks = async () => {
      try {
        setWeeksLoading(true);
        const res = await api.get('/bakery-metrics/weeks');
        const weeks = res.data?.weeks || [];
        setWeekOptions(weeks);
        // Auto-select the most recent week if available and form is still on default
        if (weeks.length > 0 && formData.week_name === getCurrentWeekName()) {
          setFormData(prev => ({ ...prev, week_name: weeks[0].sheet_name }));
        }
      } catch (err) {
        console.error('Failed to load weeks:', err);
      } finally {
        setWeeksLoading(false);
      }
    };
    loadWeeks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Form data
  const [formData, setFormData] = useState<FormData>({
    week_name: getCurrentWeekName(),
    day_of_week: getCurrentDayName(),
    submitted_by: '',
    first_die_cut1_oee_pct: '',
    first_die_cut2_oee_pct: '',
    first_die_cut1_pounds: '',
    first_die_cut2_pounds: '',
    first_die_cut1_waste_lbs: '',
    first_die_cut2_waste_lbs: '',
    second_die_cut1_oee_pct: '',
    second_die_cut2_oee_pct: '',
    second_die_cut1_pounds: '',
    second_die_cut2_pounds: '',
    second_die_cut1_waste_lbs: '',
    second_die_cut2_waste_lbs: '',
  });

  // Week options from database
  const [weekOptions, setWeekOptions] = useState<{ id: number; sheet_name: string }[]>([]);
  const [weeksLoading, setWeeksLoading] = useState(true);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const weekDropdownRef = useRef<HTMLDivElement>(null);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [dayAvailable, setDayAvailable] = useState<boolean | null>(null);

  // UI state
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [validationAlerts, setValidationAlerts] = useState<ValidationAlert[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [showAllModal, setShowAllModal] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [allSubsLoading, setAllSubsLoading] = useState(false);
  // All Submissions draggable modal — GPU-accelerated drag
  const [allModalPos, setAllModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const allModalCardRef = useRef<HTMLDivElement | null>(null);
  const allModalDragRef = useRef<{
    dragging: boolean;
    startX: number; startY: number;
    origX: number; origY: number;
    curX: number; curY: number;
    rafId: number | null;
  }>({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0, curX: 0, curY: 0, rafId: null });
  const handleAllModalDragStart = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) return;
    e.preventDefault();
    const s = allModalDragRef.current;
    s.dragging = true;
    s.startX = e.clientX; s.startY = e.clientY;
    s.origX = allModalPos.x; s.origY = allModalPos.y;
    s.curX = allModalPos.x; s.curY = allModalPos.y;
    const card = allModalCardRef.current;
    if (card) { card.style.transition = 'none'; card.style.willChange = 'transform'; }
    const flush = () => {
      s.rafId = null;
      if (!allModalDragRef.current.dragging) return;
      const c = allModalCardRef.current;
      if (c) c.style.transform = `translate3d(${s.curX}px, ${s.curY}px, 0)`;
    };
    const handleMove = (ev: MouseEvent) => {
      if (!allModalDragRef.current.dragging) return;
      s.curX = s.origX + (ev.clientX - s.startX);
      s.curY = s.origY + (ev.clientY - s.startY);
      if (s.rafId == null) s.rafId = requestAnimationFrame(flush);
    };
    const handleUp = () => {
      allModalDragRef.current.dragging = false;
      if (s.rafId != null) { cancelAnimationFrame(s.rafId); s.rafId = null; }
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.userSelect = '';
      if (allModalCardRef.current) allModalCardRef.current.style.willChange = '';
      setAllModalPos({ x: s.curX, y: s.curY });
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [allModalPos]);
  useEffect(() => { if (showAllModal) setAllModalPos({ x: 0, y: 0 }); }, [showAllModal]);
  // All Submissions filters
  const [showAllFilter, setShowAllFilter] = useState(false);
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);
  const [allFilterWeek, setAllFilterWeek] = useState('');
  const [allFilterDay, setAllFilterDay] = useState('');
  const [allFilterUser, setAllFilterUser] = useState('');
  const [allFilterStatus, setAllFilterStatus] = useState('');
  const filteredAllSubmissions = useMemo(() => {
    return allSubmissions.filter(s => {
      if (allFilterWeek && !(s.week_name || '').toLowerCase().includes(allFilterWeek.toLowerCase())) return false;
      if (allFilterDay && s.day_of_week !== allFilterDay) return false;
      if (allFilterUser && !(s.submitted_by || '').toLowerCase().includes(allFilterUser.toLowerCase())) return false;
      if (allFilterStatus && (s.status || 'Completed') !== allFilterStatus) return false;
      return true;
    });
  }, [allSubmissions, allFilterWeek, allFilterDay, allFilterUser, allFilterStatus]);
  const allFilterActiveCount = [allFilterWeek, allFilterDay, allFilterUser, allFilterStatus].filter(Boolean).length;
  const clearAllFilters = () => { setAllFilterWeek(''); setAllFilterDay(''); setAllFilterUser(''); setAllFilterStatus(''); };
  const uniqueAllUsers = useMemo(() => Array.from(new Set(allSubmissions.map(s => s.submitted_by).filter(Boolean))) as string[], [allSubmissions]);
  const uniqueAllWeeks = useMemo(() => Array.from(new Set(allSubmissions.map(s => s.week_name).filter(Boolean))) as string[], [allSubmissions]);
  // Safety fallback: when modal opens, ensure we fetch data (prevents stuck "Loading…" state)
  useEffect(() => {
    if (showAllModal && !allSubsLoading && allSubmissions.length === 0) {
      loadAllSubmissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllModal]);
  const [shiftTab, setShiftTab] = useState<'first' | 'second'>('first');
  const [shiftSubmitReady, setShiftSubmitReady] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bakeryShiftSubmitReady') === 'true';
    }
    return false;
  });
  const [shiftReminder, setShiftReminder] = useState(false);

  // ─── Success Modal state ───────────────────────────────────────────────
  const [successModal, setSuccessModal] = useState<{
    show: boolean;
    submittedBy: string;
    weekName: string;
    dayOfWeek: string;
    shiftType: string;
    timestamp: string;
    metrics: { label: string; value: string }[];
  }>({ show: false, submittedBy: '', weekName: '', dayOfWeek: '', shiftType: '', timestamp: '', metrics: [] });

  // ─── Reset Confirm Modal state ────────────────────────────────────────
  const [resetConfirm, setResetConfirm] = useState(false);

  // ─── Quick Stats: real KPI targets + deadline from DB ─────────────────────
  const [quickStats, setQuickStats] = useState({ oeeTarget: '≥ 70%', wasteTarget: '≤ 3.75%', deadline: 'End of Day' });

  // ─── Tips & Guidelines from DB ────────────────────────────────────────────
  const [tipsData, setTipsData] = useState<{ title: string; description: string; color: string; icon: string }[]>([
    { title: 'OEE Best Practice', description: 'Target OEE ≥70%. Above 85% is excellent.', color: 'green', icon: 'check' },
    { title: 'Waste Control', description: 'Keep waste below 3.75% to avoid process issues.', color: 'orange', icon: 'alert' },
    { title: 'Submission Timing', description: 'Submit by end of day for accurate reporting.', color: 'blue', icon: 'clock' },
  ]);

  // ─── Missing data analysis ────────────────────────────────────────────────
  const [missingData, setMissingData] = useState<any>(null);
  const [missingDataLoading, setMissingDataLoading] = useState(true);
  const [trackerRefreshing, setTrackerRefreshing] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  // ─── Resolve / Fill Now state ─────────────────────────────────────────────
  const [trackerTab, setTrackerTab] = useState<'outstanding' | 'resolved' | 'activity'>('outstanding');
  const [resolutions, setResolutions] = useState<any[]>([]);
  const [resolveModal, setResolveModal] = useState<{ weekName: string; dayOfWeek: string } | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [savingResolve, setSavingResolve] = useState(false);
  const [unresolveConfirm, setUnresolveConfirm] = useState<{ weekName: string; dayOfWeek: string; shiftType?: string } | null>(null);
  const [unresolving, setUnresolving] = useState(false);

  // ─── Activity Log state ───────────────────────────────────────────────────
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);
  const [activityLogsTotalCount, setActivityLogsTotalCount] = useState(0);
  const [logFilterAction, setLogFilterAction] = useState('');
  const [logFilterUser, setLogFilterUser] = useState('');
  const [logFilterStartDate, setLogFilterStartDate] = useState('');
  const [logFilterEndDate, setLogFilterEndDate] = useState('');
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackerPos, setTrackerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const trackerCardRef = useRef<HTMLDivElement | null>(null);
  const trackerDragRef = useRef<{
    dragging: boolean;
    startX: number; startY: number;
    origX: number; origY: number;
    curX: number; curY: number;
    rafId: number | null;
  }>({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0, curX: 0, curY: 0, rafId: null });
  const handleTrackerDragStart = useCallback((e: React.MouseEvent) => {
    // Do not start drag on interactive elements inside the header
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) return;
    e.preventDefault();
    const card = trackerCardRef.current;
    const startState = trackerDragRef.current;
    startState.dragging = true;
    startState.startX = e.clientX;
    startState.startY = e.clientY;
    startState.origX = trackerPos.x;
    startState.origY = trackerPos.y;
    startState.curX = trackerPos.x;
    startState.curY = trackerPos.y;
    if (card) {
      card.style.transition = 'none';
      card.style.willChange = 'transform';
    }
    const flush = () => {
      startState.rafId = null;
      if (!trackerDragRef.current.dragging) return;
      const c = trackerCardRef.current;
      if (c) c.style.transform = `translate3d(${startState.curX}px, ${startState.curY}px, 0)`;
    };
    const handleMove = (ev: MouseEvent) => {
      if (!trackerDragRef.current.dragging) return;
      startState.curX = startState.origX + (ev.clientX - startState.startX);
      startState.curY = startState.origY + (ev.clientY - startState.startY);
      if (startState.rafId == null) {
        startState.rafId = requestAnimationFrame(flush);
      }
    };
    const handleUp = () => {
      trackerDragRef.current.dragging = false;
      if (startState.rafId != null) { cancelAnimationFrame(startState.rafId); startState.rafId = null; }
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.userSelect = '';
      if (trackerCardRef.current) trackerCardRef.current.style.willChange = '';
      // Sync final position to state so re-renders keep the position
      setTrackerPos({ x: startState.curX, y: startState.curY });
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [trackerPos]);
  // Reset position each time modal opens
  useEffect(() => { if (showTrackerModal) setTrackerPos({ x: 0, y: 0 }); }, [showTrackerModal]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterPanelClosing, setFilterPanelClosing] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [outstandingFilterWeeks, setOutstandingFilterWeeks] = useState<string[]>([]);
  const [outstandingFilterType, setOutstandingFilterType] = useState('');
  const [outstandingFilterYear, setOutstandingFilterYear] = useState('');
  // ─── Resolved tab filter state ─────────────────────────────────────────
  const [resolvedFilterWeek, setResolvedFilterWeek] = useState('');
  const [resolvedFilterDay, setResolvedFilterDay] = useState('');
  const [resolvedFilterDate, setResolvedFilterDate] = useState('');
  const [resolvedFilterCustomYear, setResolvedFilterCustomYear] = useState('');
  const [resolvedFilterBy, setResolvedFilterBy] = useState('');

  const firstInvalidRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Persist shift submit preference to localStorage
  useEffect(() => {
    localStorage.setItem('bakeryShiftSubmitReady', String(shiftSubmitReady));
  }, [shiftSubmitReady]);

  // Set submitted_by from auth user
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        submitted_by: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      }));
    }
  }, [user]);

  // Auto-save every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      const { submitted_by, ...rest } = formData;
      localStorage.setItem('bakeryFormDraft', JSON.stringify(rest));
    }, 30000);
    return () => clearInterval(timer);
  }, [formData]);

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem('bakeryFormDraft');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...data, submitted_by: prev.submitted_by }));
      } catch { /* ignore */ }
    }
  }, []);

  // Load recent submissions
  useEffect(() => {
    loadRecentSubmissions();
  }, []);

  // Load real KPI targets + deadline for Quick Stats
  useEffect(() => {
    const loadQuickStats = async () => {
      try {
        const [targetsRes, deadlineRes, tipsRes] = await Promise.all([
          api.get('/bakery-metrics/kpi-targets').catch(() => null),
          api.get('/bakery-metrics/submission-deadline').catch(() => null),
          api.get('/bakery-metrics/tips-guidelines').catch(() => null),
        ]);

        const oeeTotal = targetsRes?.data?.targets?.oee?.total ?? 70;
        const wasteTotal = targetsRes?.data?.targets?.waste?.total ?? 3.75;
        const deadlineText = deadlineRes?.data?.deadline ?? 'End of Day';

        setQuickStats({
          oeeTarget: `≥ ${oeeTotal}%`,
          wasteTarget: `≤ ${wasteTotal}%`,
          deadline: deadlineText,
        });

        if (tipsRes?.data?.tips && tipsRes.data.tips.length > 0) {
          setTipsData(tipsRes.data.tips.map((t: any) => ({
            title: t.title,
            description: t.description,
            color: t.color || 'blue',
            icon: t.icon || 'info',
          })));
        }
      } catch {
        // keep defaults
      }
    };
    loadQuickStats();
  }, []);

  // Load missing data analysis
  const loadMissingData = useCallback(async () => {
    setMissingDataLoading(true);
    try {
      const { data } = await api.get('/bakery-metrics/missing-data');
      if (data.success) {
        setMissingData(data);
      }
    } catch {
      // silent
    } finally {
      setMissingDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMissingData();
  }, [loadMissingData]);

  // Load resolutions
  const loadResolutions = useCallback(async () => {
    try {
      const { data } = await api.get('/bakery-metrics/resolutions');
      if (data.success) setResolutions(data.resolutions || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadResolutions();
  }, [loadResolutions]);

  // Load activity logs (triggered when switching to activity tab or filters change)
  const loadActivityLogs = useCallback(async () => {
    setActivityLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (logFilterAction) params.append('action', logFilterAction);
      if (logFilterUser) params.append('performed_by', logFilterUser);
      if (logFilterStartDate) params.append('start_date', logFilterStartDate);
      if (logFilterEndDate) params.append('end_date', logFilterEndDate);
      params.append('limit', '200');
      const { data } = await api.get(`/bakery-metrics/activity-logs?${params.toString()}`);
      if (data.success) {
        setActivityLogs(data.logs || []);
        setActivityLogsTotalCount(data.totalCount || 0);
      }
    } catch { /* silent */ }
    finally { setActivityLogsLoading(false); }
  }, [logFilterAction, logFilterUser, logFilterStartDate, logFilterEndDate]);

  useEffect(() => {
    if (trackerTab === 'activity') loadActivityLogs();
  }, [trackerTab, loadActivityLogs]);

  // Refresh all tracker data
  const refreshTrackerData = useCallback(async () => {
    setTrackerRefreshing(true);
    await Promise.all([loadMissingData(), loadResolutions(), ...(trackerTab === 'activity' ? [loadActivityLogs()] : [])]);
    setTrackerRefreshing(false);
  }, [loadMissingData, loadResolutions, trackerTab, loadActivityLogs]);

  // Check if a day is resolved
  const isResolved = useCallback((weekName: string, dayOfWeek: string) => {
    return resolutions.some(r => r.weekName === weekName && r.dayOfWeek === dayOfWeek);
  }, [resolutions]);

  const getResolution = useCallback((weekName: string, dayOfWeek: string) => {
    return resolutions.find(r => r.weekName === weekName && r.dayOfWeek === dayOfWeek);
  }, [resolutions]);

  // Handle resolve submission
  const handleResolve = async () => {
    if (!resolveModal || !resolveReason.trim()) return;
    setSavingResolve(true);
    try {
      const { data } = await api.post('/bakery-metrics/resolutions', {
        week_name: resolveModal.weekName,
        day_of_week: resolveModal.dayOfWeek,
        reason: resolveReason.trim(),
        resolved_by: formData.submitted_by || user?.firstName || 'Unknown',
      });
      if (data.success) {
        setResolutions(prev => [...prev, data.resolution]);
        setResolveModal(null);
        setResolveReason('');
        showNotification('Issue resolved successfully', 'success');
        if (trackerTab === 'activity') loadActivityLogs();
      }
    } catch {
      showNotification('Failed to save resolution', 'error');
    } finally {
      setSavingResolve(false);
    }
  };

  // Handle unresolve — put back to Outstanding
  const handleUnresolve = async () => {
    if (!unresolveConfirm) return;
    setUnresolving(true);
    try {
      await api.delete('/bakery-metrics/resolutions', { data: { week_name: unresolveConfirm.weekName, day_of_week: unresolveConfirm.dayOfWeek, shift_type: unresolveConfirm.shiftType, performed_by: formData.submitted_by || user?.firstName || 'Unknown' } });
      setResolutions(prev => prev.filter(r => !(r.weekName === unresolveConfirm.weekName && r.dayOfWeek === unresolveConfirm.dayOfWeek && (r.shiftType || 'day') === (unresolveConfirm.shiftType || 'day'))));
      setUnresolveConfirm(null);
      showNotification('Record moved back to Outstanding', 'info');
      if (trackerTab === 'activity') loadActivityLogs();
    } catch {
      showNotification('Failed to unresolve record', 'error');
    } finally {
      setUnresolving(false);
    }
  };

  // Handle "Fill Now" — close tracker and notify parent to open form modal
  const handleFillNow = (weekName: string, dayOfWeek: string) => {
    setShowTrackerModal(false);
    if (onFillNow) {
      onFillNow(weekName, dayOfWeek);
    } else {
      // Fallback: set locally if no parent callback
      setFormData(prev => ({ ...prev, week_name: weekName, day_of_week: dayOfWeek }));
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    showNotification(`Selected ${dayOfWeek} of ${weekName} — fill in your metrics`, 'info');
    // Log Fill Now activity
    api.post('/bakery-metrics/activity-log', {
      action: 'FILL_NOW',
      week_name: weekName,
      day_of_week: dayOfWeek,
      performed_by: formData.submitted_by || user?.firstName || 'Unknown',
      details: { action_description: 'User clicked Fill Now to auto-select week and day for submission' },
    }).catch(() => {});
  };

  // Apply prefill from parent
  const prevPrefillRef = useRef(prefillWeekDay?.ts);
  useEffect(() => {
    if (prefillWeekDay && prefillWeekDay.ts !== prevPrefillRef.current) {
      setFormData(prev => ({
        ...prev,
        week_name: prefillWeekDay.weekName,
        day_of_week: prefillWeekDay.dayOfWeek,
      }));
      setCurrentStep(1);
      prevPrefillRef.current = prefillWeekDay.ts;
    }
  }, [prefillWeekDay]);

  const toggleWeekExpanded = (weekName: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekName)) next.delete(weekName);
      else next.add(weekName);
      return next;
    });
  };

  // ─── Notifications ────────────────────────────────────────────────────────────
  const showNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // ─── Validation ───────────────────────────────────────────────────────────────
  const validateStep = (step: number): boolean => {
    const errors: Record<string, boolean> = {};
    let valid = true;

    if (step === 1) {
      if (!formData.week_name) { errors.week_name = true; valid = false; }
      if (!formData.day_of_week) { errors.day_of_week = true; valid = false; }
      if (!formData.submitted_by) { errors.submitted_by = true; valid = false; }
    }

    if (step === 2) {
      // If checkbox is checked, only validate the current shift tab's fields
      // If unchecked, validate ALL fields (both shifts) — blocks Next if other shift is empty
      const fieldsToValidate: (keyof FormData)[] = shiftSubmitReady
        ? [
            `${shiftTab === 'first' ? 'first' : 'second'}_die_cut1_oee_pct` as keyof FormData,
            `${shiftTab === 'first' ? 'first' : 'second'}_die_cut2_oee_pct` as keyof FormData,
            `${shiftTab === 'first' ? 'first' : 'second'}_die_cut1_pounds` as keyof FormData,
            `${shiftTab === 'first' ? 'first' : 'second'}_die_cut2_pounds` as keyof FormData,
            `${shiftTab === 'first' ? 'first' : 'second'}_die_cut1_waste_lbs` as keyof FormData,
            `${shiftTab === 'first' ? 'first' : 'second'}_die_cut2_waste_lbs` as keyof FormData,
          ]
        : [
            'first_die_cut1_oee_pct', 'first_die_cut2_oee_pct',
            'first_die_cut1_pounds', 'first_die_cut2_pounds',
            'first_die_cut1_waste_lbs', 'first_die_cut2_waste_lbs',
            'second_die_cut1_oee_pct', 'second_die_cut2_oee_pct',
            'second_die_cut1_pounds', 'second_die_cut2_pounds',
            'second_die_cut1_waste_lbs', 'second_die_cut2_waste_lbs',
          ];

      fieldsToValidate.forEach(field => {
        const val = formData[field];
        if (!val || val.trim() === '') {
          errors[field] = true;
          valid = false;
        } else {
          const num = parseFloat(val);
          if (isNaN(num) || num < 0) {
            errors[field] = true;
            valid = false;
          }
          if (field.includes('oee') && num > 100) {
            errors[field] = true;
            valid = false;
          }
        }
      });
    }

    setValidationErrors(errors);
    if (!valid) {
      showNotification('Please fill in all required fields correctly', 'error');
    }
    return valid;
  };

  // ─── Shift-specific validation ────────────────────────────────────────────────
  const validateShiftFields = (shift: 'first' | 'second'): boolean => {
    const errors: Record<string, boolean> = {};
    let valid = true;

    // Step 1 fields first
    if (!formData.week_name) { errors.week_name = true; valid = false; }
    if (!formData.day_of_week) { errors.day_of_week = true; valid = false; }
    if (!formData.submitted_by) { errors.submitted_by = true; valid = false; }

    const prefix = shift === 'first' ? 'first_' : 'second_';
    const metricFields = [
      `${prefix}die_cut1_oee_pct`, `${prefix}die_cut2_oee_pct`,
      `${prefix}die_cut1_pounds`, `${prefix}die_cut2_pounds`,
      `${prefix}die_cut1_waste_lbs`, `${prefix}die_cut2_waste_lbs`,
    ] as (keyof FormData)[];

    metricFields.forEach(field => {
      const val = formData[field];
      if (!val || val.trim() === '') {
        errors[field] = true;
        valid = false;
      } else {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) { errors[field] = true; valid = false; }
        if (field.includes('oee') && num > 100) { errors[field] = true; valid = false; }
      }
    });

    setValidationErrors(errors);
    if (!valid) showNotification('Please fill in all required fields correctly', 'error');
    return valid;
  };

  // ─── Shift-specific submit ────────────────────────────────────────────────────
  const handleShiftSubmit = async (shift: 'first' | 'second') => {
    if (!validateShiftFields(shift)) return;

    if (duplicateWarning) {
      showNotification(duplicateWarning, 'error');
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress(0);

    const interval = setInterval(() => {
      setSubmitProgress(prev => {
        if (prev >= 90) { clearInterval(interval); return prev; }
        return prev + 10;
      });
    }, 200);

    try {
      const prefix = shift === 'first' ? 'first_' : 'second_';
      const payload: Record<string, string> = {
        week_name: formData.week_name,
        day_of_week: formData.day_of_week,
        submitted_by: formData.submitted_by,
        shift_type: shift,
        local_timestamp: new Date().toLocaleString(),
      };
      // Include only current shift's fields
      (Object.keys(formData) as (keyof FormData)[]).forEach(key => {
        if (key.startsWith(prefix)) {
          payload[key] = formData[key];
        }
      });

      const res = await api.post('/bakery-metrics/submit', payload);

      clearInterval(interval);
      setSubmitProgress(100);

      if (res.data?.success) {
        showNotification(`${shift === 'first' ? 'First' : 'Second'} shift metrics submitted successfully! 🎉`, 'success');
        localStorage.removeItem('bakeryFormDraft');
        setTimeout(() => {
          setShiftSubmitReady(false);
          loadRecentSubmissions();
        }, 2000);
      } else {
        throw new Error(res.data?.message || 'Submission failed');
      }
    } catch (err: any) {
      clearInterval(interval);
      showNotification(err?.response?.data?.message || err.message || 'Error submitting metrics', 'error');
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  // ─── Metric blur validation alerts ────────────────────────────────────────────
  const handleMetricBlur = (field: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;

    setValidationAlerts(prev => prev.filter(a => a.id !== field));
    let alert: ValidationAlert | null = null;

    if (field.includes('oee')) {
      if (num > 100) alert = { id: field, message: 'OEE cannot exceed 100%', type: 'error' };
      else if (num < 70) alert = { id: field, message: 'OEE below target (70%)', type: 'warning' };
      else if (num >= 85) alert = { id: field, message: 'Excellent OEE performance!', type: 'success' };
    }

    if (field.includes('waste') && num > 0) {
      alert = { id: field, message: 'Waste recorded in pounds — will be converted to percentage automatically', type: 'info' };
    }

    if (alert) setValidationAlerts(prev => [...prev, alert!]);
  };

  // ─── Duplicate check ─────────────────────────────────────────────────────────
  const checkDuplicate = useCallback(async (week: string, day: string) => {
    if (!week || !day) { setDuplicateWarning(null); setDayAvailable(null); return; }
    try {
      setDuplicateChecking(true);
      const res = await api.get(`/bakery-metrics/check-existing?week=${encodeURIComponent(week)}&day=${encodeURIComponent(day)}`);
      if (res.data?.exists) {
        setDuplicateWarning(`A record already exists for ${day} of the week ${formatWeekReadable(week)}`);
        setDayAvailable(false);
      } else {
        setDuplicateWarning(null);
        setDayAvailable(true);
      }
    } catch {
      setDuplicateWarning(null);
      setDayAvailable(null);
    } finally {
      setDuplicateChecking(false);
    }
  }, []);

  useEffect(() => {
    checkDuplicate(formData.week_name, formData.day_of_week);
  }, [formData.week_name, formData.day_of_week, checkDuplicate]);

  // Close week dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(e.target as Node)) {
        setWeekDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Formatted selected week for display
  const selectedWeekFormatted = useMemo(() => {
    if (!formData.week_name) return '';
    return formatWeekReadable(formData.week_name);
  }, [formData.week_name]);

  // ─── Navigation ───────────────────────────────────────────────────────────────
  const goNext = () => {
    if (currentStep === 2 && !shiftSubmitReady) {
      // Check if current shift tab is valid but the OTHER shift has errors
      const currentShiftValid = validateShiftFields(shiftTab);
      if (currentShiftValid) {
        // Current shift is fine — check the other shift
        const otherShift = shiftTab === 'first' ? 'second' : 'first';
        const otherShiftValid = validateShiftFields(otherShift);
        if (!otherShiftValid) {
          // Auto-switch to the shift with missing fields
          setShiftTab(otherShift);
          setShiftReminder(true);
          showNotification(`${otherShift === 'first' ? 'First' : 'Second'} shift has missing fields`, 'error');
          return;
        }
      } else {
        // Current shift itself has errors — normal validation message already shown
        return;
      }
    }
    if (!validateStep(currentStep)) return;
    if (currentStep < totalSteps) setCurrentStep(prev => prev + 1);
  };

  const goPrev = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const handleReset = () => {
    setResetConfirm(true);
  };

  const executeReset = () => {
    setResetConfirm(false);
    setFormData({
      week_name: weekOptions.length > 0 ? weekOptions[0].sheet_name : getCurrentWeekName(),
      day_of_week: getCurrentDayName(),
      submitted_by: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      first_die_cut1_oee_pct: '',
      first_die_cut2_oee_pct: '',
      first_die_cut1_pounds: '',
      first_die_cut2_pounds: '',
      first_die_cut1_waste_lbs: '',
      first_die_cut2_waste_lbs: '',
      second_die_cut1_oee_pct: '',
      second_die_cut2_oee_pct: '',
      second_die_cut1_pounds: '',
      second_die_cut2_pounds: '',
      second_die_cut1_waste_lbs: '',
      second_die_cut2_waste_lbs: '',
    });
    setCurrentStep(1);
    setValidationAlerts([]);
    setValidationErrors({});
    setConfirmationChecked(false);
    localStorage.removeItem('bakeryFormDraft');
    showNotification('Form has been reset', 'info');
  };

  // ─── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Validate step 1
    if (!validateStep(1)) {
      setCurrentStep(1);
      return;
    }

    // If single-shift mode, validate only that shift; otherwise validate both
    if (shiftSubmitReady) {
      if (!validateShiftFields(shiftTab)) {
        setCurrentStep(2);
        return;
      }
    } else {
      if (!validateShiftFields('first')) {
        setCurrentStep(2);
        setShiftTab('first');
        return;
      }
      if (!validateShiftFields('second')) {
        setCurrentStep(2);
        setShiftTab('second');
        return;
      }
    }

    if (!confirmationChecked) {
      showNotification('Please confirm that your data is accurate before submitting', 'error');
      return;
    }

    if (duplicateWarning) {
      showNotification(duplicateWarning, 'error');
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress(0);

    // Animate progress with smoother increments
    const interval = setInterval(() => {
      setSubmitProgress(prev => {
        if (prev >= 90) { clearInterval(interval); return prev; }
        return Math.min(prev + (Math.random() * 5 + 2), 90);
      });
    }, 180);

    try {
      const payload: Record<string, string> = {
        week_name: formData.week_name,
        day_of_week: formData.day_of_week,
        submitted_by: formData.submitted_by,
        local_timestamp: new Date().toLocaleString(),
      };

      if (shiftSubmitReady) {
        // Single-shift submission
        payload.shift_type = shiftTab;
        const prefix = shiftTab === 'first' ? 'first_' : 'second_';
        (Object.keys(formData) as (keyof FormData)[]).forEach(key => {
          if (key.startsWith(prefix)) payload[key] = formData[key];
        });
      } else {
        // Full submission (both shifts)
        (Object.keys(formData) as (keyof FormData)[]).forEach(key => {
          if (key !== 'week_name' && key !== 'day_of_week' && key !== 'submitted_by') {
            payload[key] = formData[key];
          }
        });
      }

      const res = await api.post('/bakery-metrics/submit', payload);

      clearInterval(interval);
      setSubmitProgress(100);

      if (res.data?.success) {
        localStorage.removeItem('bakeryFormDraft');

        // Build metrics summary for the success modal
        const submittedMetrics: { label: string; value: string }[] = [];
        const activeShift = shiftSubmitReady ? shiftTab : 'both';
        if (activeShift === 'first' || activeShift === 'both') {
          submittedMetrics.push(
            { label: 'OEE Die Cut 1', value: `${formData.first_die_cut1_oee_pct}%` },
            { label: 'OEE Die Cut 2', value: `${formData.first_die_cut2_oee_pct}%` },
            { label: 'Pounds Die Cut 1', value: `${parseFloat(formData.first_die_cut1_pounds).toLocaleString()} lbs` },
            { label: 'Pounds Die Cut 2', value: `${parseFloat(formData.first_die_cut2_pounds).toLocaleString()} lbs` },
            { label: 'Waste Die Cut 1', value: `${parseFloat(formData.first_die_cut1_waste_lbs).toLocaleString()} lbs` },
            { label: 'Waste Die Cut 2', value: `${parseFloat(formData.first_die_cut2_waste_lbs).toLocaleString()} lbs` },
          );
        }
        if (activeShift === 'second' || activeShift === 'both') {
          const prefix = activeShift === 'both' ? '(2nd) ' : '';
          submittedMetrics.push(
            { label: `${prefix}OEE Die Cut 1`, value: `${formData.second_die_cut1_oee_pct}%` },
            { label: `${prefix}OEE Die Cut 2`, value: `${formData.second_die_cut2_oee_pct}%` },
            { label: `${prefix}Pounds Die Cut 1`, value: `${parseFloat(formData.second_die_cut1_pounds).toLocaleString()} lbs` },
            { label: `${prefix}Pounds Die Cut 2`, value: `${parseFloat(formData.second_die_cut2_pounds).toLocaleString()} lbs` },
            { label: `${prefix}Waste Die Cut 1`, value: `${parseFloat(formData.second_die_cut1_waste_lbs).toLocaleString()} lbs` },
            { label: `${prefix}Waste Die Cut 2`, value: `${parseFloat(formData.second_die_cut2_waste_lbs).toLocaleString()} lbs` },
          );
        }

        const now = new Date();
        setSuccessModal({
          show: true,
          submittedBy: formData.submitted_by,
          weekName: formData.week_name,
          dayOfWeek: formData.day_of_week,
          shiftType: activeShift === 'first' ? 'First Shift' : activeShift === 'second' ? 'Second Shift' : 'Both Shifts',
          timestamp: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          metrics: submittedMetrics,
        });

        loadRecentSubmissions();
      } else {
        throw new Error(res.data?.message || 'Submission failed');
      }
    } catch (err: any) {
      clearInterval(interval);
      showNotification(err?.response?.data?.message || err.message || 'Error submitting metrics', 'error');
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  // ─── Recent Submissions ───────────────────────────────────────────────────────
  const loadRecentSubmissions = async () => {
    setRecentLoading(true);
    try {
      const res = await api.get('/bakery-metrics/recent-submissions');
      if (res.data?.success && res.data.submissions) {
        setRecentSubmissions(res.data.submissions);
      }
    } catch {
      // silently fail — empty list shown
    } finally {
      setRecentLoading(false);
    }
  };

  const loadAllSubmissions = async () => {
    setAllSubsLoading(true);
    try {
      const res = await api.get('/bakery-metrics/all-submissions');
      if (res.data?.submissions) {
        setAllSubmissions(res.data.submissions);
      }
    } catch (err) {
      console.error('[AllSubmissions] Failed to load:', err);
      showNotification('Failed to load submissions', 'error');
    } finally {
      setAllSubsLoading(false);
    }
  };

  // Open recent submissions modal when parent triggers it
  const prevRecentSubsRef = useRef(openRecentSubmissions);
  useEffect(() => {
    if (openRecentSubmissions && openRecentSubmissions > 0 && openRecentSubmissions !== prevRecentSubsRef.current) {
      setShowAllModal(true);
      loadAllSubmissions();
    }
    prevRecentSubsRef.current = openRecentSubmissions;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRecentSubmissions]);

  // Open tracker modal when parent triggers it
  const prevTrackerRef = useRef(openTrackerModal);
  useEffect(() => {
    if (openTrackerModal && openTrackerModal > 0 && openTrackerModal !== prevTrackerRef.current) {
      setExpandedWeeks(new Set());
      setShowFilterPanel(false);
      setFilterPanelClosing(false);
      setActiveFilters([]);
      setOutstandingFilterWeeks([]);
      setOutstandingFilterType('');
      setOutstandingFilterYear('');
      setShowTrackerModal(true);
    }
    prevTrackerRef.current = openTrackerModal;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrackerModal]);

  // ─── Input helper ─────────────────────────────────────────────────────────────
  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationErrors(prev => ({ ...prev, [field]: false }));
  };

  const inputClasses = (field: string) =>
    `w-full px-3 py-2.5 sm:py-2 rounded-lg border font-medium shadow-sm transition-all duration-200 text-sm
     ${validationErrors[field]
      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-400'
      : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500'
    }`;

  const selectClasses = (field: string) =>
    `${inputClasses(field)} appearance-none truncate pr-8`;

  // ─── Progress percentage ──────────────────────────────────────────────────────
  const progressPercent = (currentStep / totalSteps) * 100;

  // ─── Alert icon map ───────────────────────────────────────────────────────────
  const alertConfig = {
    success: { icon: CheckCircle, bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-800 dark:text-green-300', border: 'border-green-200 dark:border-green-700' },
    warning: { icon: AlertTriangle, bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-800 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-700' },
    error:   { icon: AlertCircle, bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-800 dark:text-red-300', border: 'border-red-200 dark:border-red-700' },
    info:    { icon: Info, bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700' },
  };

  const notifConfig = {
    success: 'bg-green-500 border-green-300',
    error: 'bg-red-500 border-red-300',
    warning: 'bg-orange-500 border-orange-300',
    info: 'bg-blue-500 border-blue-300',
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // TRACKER CONTENT (reused inline on Step 1 and in modal overlay)
  // ═════════════════════════════════════════════════════════════════════════════
  const trackerContent = (
    <>
      {/* Header with Tabs */}
      <div
        className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 sm:px-5 py-3 select-none cursor-move"
        onMouseDown={handleTrackerDragStart}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Data Completeness Tracker</h3>
              <p className="text-amber-100 text-[10px]">Missing submissions, shifts & metrics across all weeks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab switcher */}
            <div className="flex bg-white/15 rounded-lg p-0.5">
              <button
                onClick={() => setTrackerTab('outstanding')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  trackerTab === 'outstanding'
                    ? 'bg-white text-amber-600 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                Outstanding
                {missingData && (() => {
                  const outstandingCount = missingData.weeks?.reduce((acc: number, w: any) => {
                    return acc + w.days.filter((d: any) => (d.status === 'missing' || d.status === 'incomplete') && !isResolved(w.week_name, d.day)).length;
                  }, 0) || 0;
                  return outstandingCount > 0 ? <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[9px]">{outstandingCount}</span> : null;
                })()}
              </button>
              <button
                onClick={() => setTrackerTab('resolved')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  trackerTab === 'resolved'
                    ? 'bg-white text-amber-600 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                Resolved
                {resolutions.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-green-500 text-white rounded-full text-[9px]">{resolutions.length}</span>}
              </button>
              <button
                onClick={() => setTrackerTab('activity')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  trackerTab === 'activity'
                    ? 'bg-white text-amber-600 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                Activity Log
              </button>
            </div>
            {missingData && (
              <span className="text-[10px] text-amber-100 font-medium hidden sm:inline">{missingData.total_weeks} week(s)</span>
            )}
            <button
              onClick={refreshTrackerData}
              disabled={trackerRefreshing}
              className={`p-1.5 rounded-lg transition-all bg-white/20 text-white hover:bg-white/30 ${trackerRefreshing ? 'opacity-60 cursor-not-allowed' : ''}`}
              title="Refresh records"
            >
              <RotateCcw className={`w-4 h-4 ${trackerRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                if (showFilterPanel) {
                  setFilterPanelClosing(true);
                  setTimeout(() => { setShowFilterPanel(false); setFilterPanelClosing(false); }, 250);
                } else {
                  setShowFilterPanel(true);
                }
              }}
              className={`p-1.5 rounded-lg transition-all relative ${showFilterPanel ? 'bg-white/30 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'}`}
              title="Toggle filters"
            >
              <Filter className="w-4 h-4" />
              {(() => {
                let fc = 0;
                if (trackerTab === 'outstanding') {
                  fc = outstandingFilterWeeks.length + (outstandingFilterType ? 1 : 0) + (outstandingFilterYear.length === 4 ? 1 : 0);
                } else if (trackerTab === 'resolved') {
                  fc = (resolvedFilterWeek ? 1 : 0) + (resolvedFilterDay ? 1 : 0) + (resolvedFilterDate ? 1 : 0) + (resolvedFilterBy ? 1 : 0);
                } else if (trackerTab === 'activity') {
                  fc = (logFilterAction ? 1 : 0) + (logFilterUser ? 1 : 0) + (logFilterStartDate ? 1 : 0) + (logFilterEndDate ? 1 : 0);
                }
                return fc > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center px-1 bg-red-500 text-white text-[9px] font-bold rounded-full animate-[filterBlink_2s_ease-in-out_infinite]">
                    {fc}
                  </span>
                ) : null;
              })()}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto scrollbar-thin flex-1 min-h-0">
        {missingDataLoading ? (
          <LoadingState message="Checking all weeks for missing information" title="Analyzing submission data..." icon="data" color="amber" fullScreen={false} />
        ) : !missingData || missingData.weeks?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
              <ClipboardList className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No weeks to analyze</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Create weekly sheets first to start tracking completeness</p>
          </div>
        ) : trackerTab === 'resolved' ? (
          /* ── RESOLVED TAB ─────────────────────────────────────────────── */
          resolutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No resolved items yet</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Resolve outstanding issues to see them here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {resolutions.filter((res: any) => {
                if (resolvedFilterWeek && res.weekName !== resolvedFilterWeek) return false;
                if (resolvedFilterDay && res.dayOfWeek !== resolvedFilterDay) return false;
                if (resolvedFilterBy && res.resolvedBy !== resolvedFilterBy) return false;
                if (resolvedFilterDate) {
                  const rd = new Date(res.resolvedAt);
                  const now = new Date();
                  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const dayOfWeekNum = now.getDay();
                  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeekNum === 0 ? 6 : dayOfWeekNum - 1));
                  if (resolvedFilterDate === 'today') { if (rd < startOfDay || rd >= new Date(startOfDay.getTime() + 86400000)) return false; }
                  else if (resolvedFilterDate === 'thisWeek') { if (rd < startOfWeek) return false; }
                  else if (resolvedFilterDate === 'lastWeek') { const lws = new Date(startOfWeek); lws.setDate(lws.getDate() - 7); if (rd < lws || rd >= startOfWeek) return false; }
                  else if (resolvedFilterDate === 'lastMonth') { const lms = new Date(now.getFullYear(), now.getMonth() - 1, 1); const lme = new Date(now.getFullYear(), now.getMonth(), 1); if (rd < lms || rd >= lme) return false; }
                  else if (resolvedFilterDate === 'lastQuarter') { const cq = Math.floor(now.getMonth() / 3); const lqs = new Date(now.getFullYear(), (cq - 1) * 3, 1); const lqe = new Date(now.getFullYear(), cq * 3, 1); if (cq === 0) { lqs.setFullYear(now.getFullYear() - 1); lqs.setMonth(9); lqe.setFullYear(now.getFullYear()); lqe.setMonth(0); } if (rd < lqs || rd >= lqe) return false; }
                  else if (resolvedFilterDate === 'thisYear') { if (rd.getFullYear() !== now.getFullYear()) return false; }
                  else if (resolvedFilterDate === 'lastYear') { if (rd.getFullYear() !== now.getFullYear() - 1) return false; }
                  else if (resolvedFilterDate === 'customYear' && resolvedFilterCustomYear.length === 4) { const cy = parseInt(resolvedFilterCustomYear); if (!isNaN(cy) && cy <= now.getFullYear() && rd.getFullYear() !== cy) return false; }
                }
                return true;
              }).map((res: any) => {
                const weekFormatted = formatWeekReadable(res.weekName);
                const shiftLabel = res.shiftType === 'first' ? '1st Shift' : res.shiftType === 'second' ? '2nd Shift' : null;
                return (
                  <div key={`${res.weekName}-${res.dayOfWeek}-${res.shiftType || 'day'}`} className="px-4 sm:px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                            {res.dayOfWeek} — {weekFormatted}
                            {shiftLabel && (
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold">
                                {shiftLabel}
                              </span>
                            )}
                          </p>
                          <div className="flex items-start gap-1.5 mt-1">
                            <MessageSquare className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{res.reason}</p>
                          </div>
                          <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1">
                            Resolved by <span className="font-semibold">{res.resolvedBy}</span> · {new Date(res.resolvedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setUnresolveConfirm({ weekName: res.weekName, dayOfWeek: res.dayOfWeek, shiftType: res.shiftType })}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700 rounded-md text-[9px] font-bold transition-all active:scale-95"
                          title="Move back to Outstanding"
                        >
                          <RotateCcw className="w-3 h-3" /> Put Back
                        </button>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          Resolved
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : trackerTab === 'activity' ? (
          /* ── ACTIVITY LOG TAB ─────────────────────────────────────────── */
          <div>
            {/* Log entries */}
            {activityLogsLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-7 h-7 text-amber-500 animate-spin mb-2" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Loading activity logs...</p>
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                  <History className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No activity logs found</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {logFilterAction || logFilterUser || logFilterStartDate || logFilterEndDate
                    ? 'Try adjusting your filters'
                    : 'Resolve or unresolve records to generate activity logs'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {activityLogs.map((log: any) => {
                  const actionConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string; badgeColor: string }> = {
                    RESOLVED: {
                      icon: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
                      color: 'border-l-green-500',
                      bgColor: 'bg-green-50/40 dark:bg-green-900/10',
                      label: 'Resolved',
                      badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                    },
                    UNRESOLVED: {
                      icon: <RotateCcw className="w-3.5 h-3.5 text-orange-500" />,
                      color: 'border-l-orange-500',
                      bgColor: 'bg-orange-50/40 dark:bg-orange-900/10',
                      label: 'Unresolved',
                      badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
                    },
                    FILL_NOW: {
                      icon: <ExternalLink className="w-3.5 h-3.5 text-blue-500" />,
                      color: 'border-l-blue-500',
                      bgColor: 'bg-blue-50/40 dark:bg-blue-900/10',
                      label: 'Fill Now',
                      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                    },
                  };
                  const config = actionConfig[log.action] || actionConfig.RESOLVED;
                  const weekFormatted = formatWeekReadable(log.weekName);
                  const parsedDetails = log.details ? (() => { try { return JSON.parse(log.details); } catch { return null; } })() : null;
                  const logDate = new Date(log.createdAt);

                  return (
                    <div key={log.id} className={`border-l-[3px] ${config.color} ${config.bgColor} px-4 sm:px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="mt-0.5 flex-shrink-0">{config.icon}</div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${config.badgeColor}`}>{config.label}</span>
                              <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{log.dayOfWeek}</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">—</span>
                              <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">{weekFormatted}</span>
                            </div>
                            {log.reason && (
                              <div className="flex items-start gap-1.5 mt-1">
                                <MessageSquare className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
                                <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">{log.reason}</p>
                              </div>
                            )}
                            {parsedDetails?.action_description && (
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 italic">{parsedDetails.action_description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-[9px] text-gray-500 dark:text-gray-400">
                                <span className="font-semibold text-gray-700 dark:text-gray-300">{log.performedBy}</span>
                              </span>
                              <span className="text-[9px] text-gray-400 dark:text-gray-500">
                                {logDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {logDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                              </span>
                              {log.ipAddress && (
                                <span className="text-[8px] text-gray-400 dark:text-gray-500 font-mono">IP: {log.ipAddress}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 flex-shrink-0 font-mono">#{log.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── OUTSTANDING TAB ──────────────────────────────────────────── */
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {missingData.weeks.filter((week: any) => {
              if (outstandingFilterWeeks.length > 0 && !outstandingFilterWeeks.includes(week.week_name)) return false;
              if (outstandingFilterYear.length === 4 && parseInt(outstandingFilterYear) <= new Date().getFullYear() && !week.week_name.includes(outstandingFilterYear)) return false;
              if (outstandingFilterType) {
                const uDays = week.days.filter((d: any) => (d.status === 'missing' || d.status === 'incomplete') && !isResolved(week.week_name, d.day));
                const fullyComplete = week.completion_pct === 100 && week.total_issues === 0;
                const anyResolutions = week.days.some((d: any) => isResolved(week.week_name, d.day));
                if (outstandingFilterType === 'unresolved') return uDays.length > 0;
                if (outstandingFilterType === 'complete') return fullyComplete && uDays.length === 0;
                if (outstandingFilterType === 'resolved') return uDays.length === 0 && anyResolutions;
              }
              return true;
            }).map((week: any) => {
              const isExpanded = expandedWeeks.has(week.week_name);
              const hasIssues = week.total_issues > 0 || week.missing_days.length > 0;
              const isFullyComplete = week.completion_pct === 100 && week.total_issues === 0;
              const weekFormatted = formatWeekReadable(week.week_name);

              const unresolvedDays = week.days.filter((d: any) =>
                (d.status === 'missing' || d.status === 'incomplete') && !isResolved(week.week_name, d.day)
              );

              // ── Week color: green/blue/red/yellow/gray ──
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const weekDates = parseWeekDates(week.week_name);
              const weekStatus = (() => {
                if (!weekDates) return 'past' as const;
                const end = new Date(weekDates.end); end.setHours(0, 0, 0, 0);
                const start = new Date(weekDates.start); start.setHours(0, 0, 0, 0);
                if (end < today) return 'past' as const;
                if (start > today) return 'future' as const;
                return 'current' as const;
              })();
              const hasAnyResolutions = week.days.some((d: any) => isResolved(week.week_name, d.day));
              let weekColor: 'green' | 'blue' | 'red' | 'yellow' | 'gray';
              if (unresolvedDays.length === 0 && (isFullyComplete || hasAnyResolutions)) {
                weekColor = hasAnyResolutions ? 'blue' : 'green';
              } else if (weekStatus === 'future') {
                weekColor = 'gray';
              } else if (weekStatus === 'past') {
                weekColor = unresolvedDays.length > 0 ? 'red' : 'green';
              } else {
                const hasPastDueUnresolved = unresolvedDays.some((d: any) => {
                  const dd = getDayDate(week.week_name, d.day);
                  return dd !== null && dd < today;
                });
                weekColor = (!hasPastDueUnresolved && week.completion_pct === 0) ? 'gray' : 'yellow';
              }
              const wc = {
                green: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', bar: 'bg-green-500' },
                blue: { dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', bar: 'bg-blue-500' },
                red: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', bar: 'bg-red-500' },
                yellow: { dot: 'bg-yellow-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', bar: 'bg-yellow-500' },
                gray: { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-500 dark:bg-gray-700/30 dark:text-gray-400', bar: 'bg-gray-400' },
              };

              if (isFullyComplete && unresolvedDays.length === 0) {
                // Still show complete weeks but collapsed
              }

              return (
                <div key={week.week_name}>
                  <button
                    onClick={() => toggleWeekExpanded(week.week_name)}
                    className="w-full flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${wc[weekColor].dot}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{weekFormatted}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {week.total_submitted}/{week.total_expected} days submitted
                          {unresolvedDays.length > 0 && (
                            <span className="text-red-600 dark:text-red-400 ml-1.5">· {unresolvedDays.length} unresolved</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${wc[weekColor].badge}`}>
                        {week.completion_pct}%
                      </span>
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className={`h-full rounded-full transition-all ${wc[weekColor].bar}`}
                          style={{ width: `${week.completion_pct}%` }}
                        />
                      </div>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                        : <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                      }
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 sm:px-5 pb-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
                      {week.missing_days.length > 0 && (
                        <div className="mt-3 mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                            <span className="text-[11px] font-bold text-red-700 dark:text-red-300">
                              {week.missing_days.length} day{week.missing_days.length !== 1 ? 's' : ''} not yet submitted
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 ml-5">
                            {week.missing_days.map((day: string) => {
                              const pillFuture = (() => { const dd = getDayDate(week.week_name, day); return dd !== null && dd > today; })();
                              return (
                                <span key={day} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isResolved(week.week_name, day)
                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 line-through'
                                    : pillFuture
                                    ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/30'
                                    : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                                }`}>
                                  {day}{isResolved(week.week_name, day) ? ' ✓' : ''}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 mt-2">
                        {week.days.map((day: any) => {
                          const resolved = isResolved(week.week_name, day.day);
                          const resolution = getResolution(week.week_name, day.day);
                          const dayIsFuture = (() => { const dd = getDayDate(week.week_name, day.day); return dd !== null && dd > today; })();
                          const statusColors: Record<string, string> = {
                            complete: 'border-l-green-500 bg-green-50/50 dark:bg-green-900/10',
                            incomplete: resolved ? 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10',
                            missing: resolved ? 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-l-red-500 bg-red-50/50 dark:bg-red-900/10',
                          };
                          const statusIcons: Record<string, React.ReactNode> = {
                            complete: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
                            incomplete: resolved ? <CheckCircle className="w-3.5 h-3.5 text-blue-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
                            missing: resolved ? <CheckCircle className="w-3.5 h-3.5 text-blue-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
                          };
                          const statusLabels: Record<string, string> = {
                            complete: 'Complete',
                            incomplete: resolved ? 'Resolved' : dayIsFuture ? 'Upcoming' : 'Has Issues',
                            missing: resolved ? 'Resolved' : dayIsFuture ? 'Upcoming' : 'Not Submitted',
                          };
                          const statusBadgeColors: Record<string, string> = {
                            complete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                            incomplete: resolved ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                            missing: resolved ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                          };

                          return (
                            <div
                              key={day.day}
                              className={`border-l-[3px] rounded-lg px-3 py-2.5 ${dayIsFuture ? 'border-l-gray-300 bg-gray-50/30 dark:bg-gray-800/20 opacity-50' : statusColors[day.status]}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  {statusIcons[day.status]}
                                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{day.day}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusBadgeColors[day.status]}`}>
                                    {statusLabels[day.status]}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {(day.status === 'missing' || day.status === 'incomplete') && !resolved && !dayIsFuture && (
                                    <>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleFillNow(week.week_name, day.day); }}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-[9px] font-bold transition-all active:scale-95 shadow-sm"
                                        title="Fill in this record now"
                                      >
                                        <ExternalLink className="w-3 h-3" /> Fill Now
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setShowTrackerModal(false); setResolveModal({ weekName: week.week_name, dayOfWeek: day.day }); setResolveReason(''); }}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[9px] font-bold transition-all active:scale-95 shadow-sm"
                                        title="Mark as resolved with a reason"
                                      >
                                        <PenLine className="w-3 h-3" /> Resolve
                                      </button>
                                    </>
                                  )}
                                  {day.submitted_by && (
                                    <div className="text-right">
                                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                        by <span className="font-semibold">{day.submitted_by}</span>
                                      </p>
                                      {day.submitted_at && (
                                        <p className="text-[9px] text-gray-400 dark:text-gray-500">
                                          {new Date(day.submitted_at).toLocaleString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric',
                                            hour: 'numeric', minute: '2-digit', hour12: true,
                                          })}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {resolved && resolution && (
                                <div className="mt-1.5 ml-5 px-2.5 py-1.5 bg-blue-500 dark:bg-blue-600 border border-blue-600 dark:border-blue-700 rounded-md">
                                  <div className="flex items-start gap-1.5">
                                    <MessageSquare className="w-3 h-3 text-white flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-[10px] text-white">{resolution.reason}</p>
                                      <p className="text-[9px] text-white/70 mt-0.5">
                                        — {resolution.resolvedBy}, {new Date(resolution.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {day.issues.length > 0 && day.status !== 'missing' && !resolved && (
                                <div className="mt-1.5 ml-5 space-y-0.5">
                                  {day.issues.map((issue: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-1.5">
                                      <ChevronRight className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                                      <span className="text-[10px] text-gray-600 dark:text-gray-400">{issue}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {day.status === 'missing' && !resolved && !dayIsFuture && (
                                <p className="text-[10px] text-red-600/80 dark:text-red-400/70 mt-1 ml-5">
                                  No metrics have been submitted for this day. Please submit your data or resolve with a reason.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-3 relative">

      {/* Custom animation styles */}
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-slide-in {
          animation: fadeSlideIn 0.25s ease-out;
        }
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(8px);
          }
          50% {
            opacity: 1;
            transform: scale(1.05) translateY(-2px);
          }
          70% {
            transform: scale(0.97) translateY(1px);
          }
          100% {
            transform: scale(1) translateY(0);
          }
        }
        .animate-bounce-in {
          animation: bounceIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes slideInLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideOutLeft {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
        @keyframes filterBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes filterPanelIn {
          from { opacity: 0; transform: scaleX(0.3) translateX(-24px); }
          to { opacity: 1; transform: scaleX(1) translateX(0); }
        }
      `}</style>

      {/* ─── Notifications ──────────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(n => {
          const Ic = alertConfig[n.type].icon;
          return (
            <div key={n.id} className={`px-4 py-3 rounded-xl shadow-lg max-w-xs border ${notifConfig[n.type]} animate-slide-in-right`}>
              <div className="flex items-center space-x-2">
                <Ic className="w-4 h-4 text-white flex-shrink-0" />
                <span className="text-xs font-semibold text-white">{n.message}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Main Layout: Form + Right Sidebar ──────────────────────────────── */}
      <div className="flex flex-col xl:flex-row gap-3">
      <div className="flex-1 min-w-0 space-y-3">

      {/* ─── Form Container ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-visible">

        {/* ═══ STEP 1: Basic Information ═══ */}
        {currentStep === 1 && (
          <div className="p-4 sm:p-5">
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-1">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">Basic Information</h2>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Select the week and day for your metrics submission</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Week — Custom Scrollable Dropdown */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-blue-600 dark:text-blue-400" />
                  Week <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={weekDropdownRef}>
                  <button
                    type="button"
                    onClick={() => !weeksLoading && setWeekDropdownOpen(prev => !prev)}
                    disabled={weeksLoading}
                    className={`${selectClasses('week_name')} text-left flex items-center justify-between cursor-pointer`}
                    title="Select week"
                  >
                    <span className="truncate">
                      {weeksLoading ? 'Loading weeks...' : formData.week_name ? selectedWeekFormatted : 'Select a week'}
                    </span>
                    {weeksLoading ? (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0 ml-2" />
                    ) : (
                      <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2 transition-transform duration-200 ${weekDropdownOpen ? 'rotate-180' : ''}`} />
                    )}
                  </button>

                  {weekDropdownOpen && weekOptions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-[50vh] overflow-y-auto">
                      <div className="sticky top-0 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 border-b border-gray-200 dark:border-gray-600">
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Available Weeks ({weekOptions.length})</span>
                      </div>
                      {weekOptions.map(w => {
                        const isSelected = formData.week_name === w.sheet_name;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              updateField('week_name', w.sheet_name);
                              setWeekDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors duration-100
                              ${isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                          >
                            <span className="flex items-center justify-between">
                              <span>{formatWeekReadable(w.sheet_name)}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Day */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  <CalendarDays className="w-3.5 h-3.5 inline mr-1.5 text-blue-600 dark:text-blue-400" />
                  Day <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.day_of_week}
                    onChange={e => updateField('day_of_week', e.target.value)}
                    className={selectClasses('day_of_week')}
                    title="Select day of week"
                  >
                    <option value="">Select a day</option>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                </div>
              </div>

              {/* Submitted By */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  <User className="w-3.5 h-3.5 inline mr-1.5 text-blue-600 dark:text-blue-400" />
                  Submitted By <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.submitted_by}
                  readOnly
                  title="Submitted by"
                  placeholder="Your name"
                  className={`${inputClasses('submitted_by')} bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed`}
                />
              </div>
            </div>

            {/* ─── Availability / Duplicate Status Message ─── */}
            {formData.week_name && formData.day_of_week && (
              <div className="mt-3">
                {duplicateChecking ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-200 dark:border-gray-600">
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">Checking availability for {formData.day_of_week}...</span>
                  </div>
                ) : duplicateWarning ? (
                  <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700/50">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-red-700 dark:text-red-300 font-semibold text-xs">{duplicateWarning}</p>
                        <p className="text-red-600/80 dark:text-red-400/70 text-[11px] mt-0.5">Please select a different day of the week or choose another week to continue.</p>
                      </div>
                    </div>
                  </div>
                ) : dayAvailable ? (
                  <div className="px-3 py-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700/50">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-green-700 dark:text-green-300 font-semibold text-xs">No existing record for {formData.day_of_week} — {selectedWeekFormatted}</p>
                        <p className="text-green-600/80 dark:text-green-400/70 text-[11px] mt-0.5">You&apos;re all set! Click <strong>Next</strong> to proceed with submitting bakery metrics for this day.</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Quick Stats - inline row */}
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2.5 border border-blue-200 dark:border-blue-700 hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-blue-500 rounded-lg">
                    <Target className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">OEE Target</p>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{quickStats.oeeTarget}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2.5 border border-green-200 dark:border-green-700 hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-green-500 rounded-lg">
                    <TrendingDown className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Waste Target</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">{quickStats.wasteTarget}</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2.5 border border-orange-200 dark:border-orange-700 hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-orange-500 rounded-lg">
                    <Clock className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Deadline</p>
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{quickStats.deadline}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Performance Metrics ═══ */}
        {currentStep === 2 && (
          <div className="p-3">
            <div className="mb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-100">Performance Metrics</h2>
                <span
                  key={shiftTab}
                  className={`ml-auto inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold animate-bounce-in ${
                    shiftTab === 'first' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
                  }`}
                >
                  {shiftTab === 'first' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  {shiftTab === 'first' ? 'First Shift Metrics' : 'Second Shift Metrics'}
                </span>
              </div>
            </div>

            {/* Shift Tabs */}
            <div className="flex space-x-1 mb-2 bg-gray-100 dark:bg-gray-700/80 rounded-xl p-1 relative">
              <button
                type="button"
                onClick={() => setShiftTab('first')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 ease-in-out active:scale-[0.96] ${
                  shiftTab === 'first'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 ring-1 ring-blue-400/50'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-600/40'
                }`}
              >
                <Sun className={`w-4 h-4 transition-transform duration-300 ${shiftTab === 'first' ? 'rotate-0 scale-110' : 'rotate-180 scale-90 opacity-60'}`} />
                First Shift
                {(formData.first_die_cut1_oee_pct || formData.first_die_cut2_oee_pct || formData.first_die_cut1_pounds || formData.first_die_cut2_pounds || formData.first_die_cut1_waste_lbs || formData.first_die_cut2_waste_lbs) && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300 ${shiftTab === 'first' ? 'bg-white animate-pulse' : 'bg-green-500'}`} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShiftTab('second')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 ease-in-out active:scale-[0.96] ${
                  shiftTab === 'second'
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30 ring-1 ring-orange-400/50'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-600/40'
                }`}
              >
                <Moon className={`w-4 h-4 transition-transform duration-300 ${shiftTab === 'second' ? 'rotate-0 scale-110' : '-rotate-90 scale-90 opacity-60'}`} />
                Second Shift
                {(formData.second_die_cut1_oee_pct || formData.second_die_cut2_oee_pct || formData.second_die_cut1_pounds || formData.second_die_cut2_pounds || formData.second_die_cut1_waste_lbs || formData.second_die_cut2_waste_lbs) && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300 ${shiftTab === 'second' ? 'bg-white animate-pulse' : 'bg-green-500'}`} />
                )}
              </button>
            </div>

            {/* ─── First Shift Content ─────────────────────────────────────── */}
            {shiftTab === 'first' && (
              <div className="space-y-2 animate-fade-slide-in">
                <MetricSection
                  title="Overall Equipment Effectiveness (OEE)"
                  icon={<Gauge className="w-5 h-5 mr-3 text-indigo-600 dark:text-indigo-400" />}
                  bgFrom="indigo"
                  fields={[
                    { label: 'Die Cut 1 (%)', field: 'first_die_cut1_oee_pct' as keyof FormData, unit: '%', min: 0, max: 100, step: 0.1 },
                    { label: 'Die Cut 2 (%)', field: 'first_die_cut2_oee_pct' as keyof FormData, unit: '%', min: 0, max: 100, step: 0.1 },
                  ]}
                  formData={formData}
                  updateField={updateField}
                  inputClasses={inputClasses}
                  onBlur={handleMetricBlur}
                />

                <MetricSection
                  title="Production Volume (Pounds)"
                  icon={<Package className="w-5 h-5 mr-3 text-green-600 dark:text-green-400" />}
                  bgFrom="green"
                  fields={[
                    { label: 'Die Cut 1 (lbs)', field: 'first_die_cut1_pounds' as keyof FormData, unit: 'lbs', min: 0, step: 0.1 },
                    { label: 'Die Cut 2 (lbs)', field: 'first_die_cut2_pounds' as keyof FormData, unit: 'lbs', min: 0, step: 0.1 },
                  ]}
                  formData={formData}
                  updateField={updateField}
                  inputClasses={inputClasses}
                  onBlur={handleMetricBlur}
                />

                <MetricSection
                  title="Waste (Pounds)"
                  icon={<Trash2 className="w-5 h-5 mr-3 text-red-600 dark:text-red-400" />}
                  bgFrom="red"
                  fields={[
                    { label: 'Die Cut 1 (LB)', field: 'first_die_cut1_waste_lbs' as keyof FormData, unit: 'LB', min: 0, step: 0.1 },
                    { label: 'Die Cut 2 (LB)', field: 'first_die_cut2_waste_lbs' as keyof FormData, unit: 'LB', min: 0, step: 0.1 },
                  ]}
                  formData={formData}
                  updateField={updateField}
                  inputClasses={inputClasses}
                  onBlur={handleMetricBlur}
                />
              </div>
            )}

            {/* ─── Second Shift Content ────────────────────────────────────── */}
            {shiftTab === 'second' && (
              <div className="space-y-2 animate-fade-slide-in">
                <MetricSection
                  title="Overall Equipment Effectiveness (OEE)"
                  icon={<Gauge className="w-5 h-5 mr-3 text-indigo-600 dark:text-indigo-400" />}
                  bgFrom="indigo"
                  fields={[
                    { label: 'Die Cut 1 (%)', field: 'second_die_cut1_oee_pct' as keyof FormData, unit: '%', min: 0, max: 100, step: 0.1 },
                    { label: 'Die Cut 2 (%)', field: 'second_die_cut2_oee_pct' as keyof FormData, unit: '%', min: 0, max: 100, step: 0.1 },
                  ]}
                  formData={formData}
                  updateField={updateField}
                  inputClasses={inputClasses}
                  onBlur={handleMetricBlur}
                />

                <MetricSection
                  title="Production Volume (Pounds)"
                  icon={<Package className="w-5 h-5 mr-3 text-green-600 dark:text-green-400" />}
                  bgFrom="green"
                  fields={[
                    { label: 'Die Cut 1 (lbs)', field: 'second_die_cut1_pounds' as keyof FormData, unit: 'lbs', min: 0, step: 0.1 },
                    { label: 'Die Cut 2 (lbs)', field: 'second_die_cut2_pounds' as keyof FormData, unit: 'lbs', min: 0, step: 0.1 },
                  ]}
                  formData={formData}
                  updateField={updateField}
                  inputClasses={inputClasses}
                  onBlur={handleMetricBlur}
                />

                <MetricSection
                  title="Waste (Pounds)"
                  icon={<Trash2 className="w-5 h-5 mr-3 text-red-600 dark:text-red-400" />}
                  bgFrom="red"
                  fields={[
                    { label: 'Die Cut 1 (LB)', field: 'second_die_cut1_waste_lbs' as keyof FormData, unit: 'LB', min: 0, step: 0.1 },
                    { label: 'Die Cut 2 (LB)', field: 'second_die_cut2_waste_lbs' as keyof FormData, unit: 'LB', min: 0, step: 0.1 },
                  ]}
                  formData={formData}
                  updateField={updateField}
                  inputClasses={inputClasses}
                  onBlur={handleMetricBlur}
                />
              </div>
            )}

            {/* Validation Alerts */}
            {validationAlerts.length > 0 && (
              <div className="space-y-1.5 mt-3">
                {validationAlerts.map(a => {
                  const cfg = alertConfig[a.type];
                  const Ic = cfg.icon;
                  return (
                    <div key={a.id} className={`px-3 py-2 rounded-lg flex items-center space-x-2 shadow-sm border ${cfg.bg} ${cfg.border}`}>
                      <Ic className={`w-3.5 h-3.5 ${cfg.text} flex-shrink-0`} />
                      <span className={`text-xs font-medium ${cfg.text}`}>{a.message}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Shift Submit Checkbox */}
            <div className="mt-2 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/40 dark:to-gray-700/60 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
              <label className="flex items-center space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={shiftSubmitReady}
                  onChange={e => { setShiftSubmitReady(e.target.checked); if (e.target.checked) setShiftReminder(false); }}
                  className={`w-4 h-4 rounded border-2 focus:ring-2 bg-white dark:bg-gray-700 transition-colors ${
                    shiftTab === 'first'
                      ? 'text-blue-600 border-blue-400 focus:ring-blue-500'
                      : 'text-orange-600 border-orange-400 focus:ring-orange-500'
                  }`}
                />
                <div>
                  <span className={`text-sm font-semibold ${
                    shiftTab === 'first'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-orange-700 dark:text-orange-300'
                  }`}>
                    {shiftTab === 'first'
                      ? 'Submit First Shift records only'
                      : 'Submit Second Shift records only'}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {shiftTab === 'first'
                      ? 'Check this to submit first shift data without entering second shift metrics'
                      : 'Check this to submit second shift data independently'}
                  </p>
                </div>
              </label>
            </div>

            {/* Red reminder banner — shown when user tried to proceed with missing shift data */}
            {shiftReminder && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg px-4 py-3 flex items-start justify-between animate-fade-slide-in">
                <div className="flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                      {shiftTab === 'second' ? 'Second' : 'First'} Shift fields are required
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                      Fill in the missing fields above, or check the <strong>&ldquo;Submit {shiftTab === 'first' ? 'First' : 'Second'} Shift records only&rdquo;</strong> checkbox {shiftTab === 'second' ? 'above' : 'below'} if you only want to submit one shift&apos;s report.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShiftReminder(false)}
                  className="ml-3 p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-800/40 transition-colors flex-shrink-0"
                  title="Dismiss"
                >
                  <X className="w-4 h-4 text-red-500 dark:text-red-400" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 3: Review & Submit ═══ */}
        {currentStep === 3 && (
          <div className="p-4 sm:p-5">
            <div className="mb-3">
              <div className="flex items-center space-x-2 mb-1">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">Review & Submit</h2>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Review your entries before submitting</p>
            </div>

            {/* Single-shift mode indicator */}
            {shiftSubmitReady && (
              <div className={`mb-3 px-4 py-2.5 rounded-lg border flex items-center space-x-2 ${
                shiftTab === 'first'
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                  : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
              }`}>
                <Info className={`w-4 h-4 flex-shrink-0 ${
                  shiftTab === 'first' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
                }`} />
                <span className={`text-xs font-semibold ${
                  shiftTab === 'first' ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'
                }`}>
                  Submitting {shiftTab === 'first' ? 'First' : 'Second'} Shift records only — {shiftTab === 'first' ? 'Second' : 'First'} Shift data will not be included
                </span>
              </div>
            )}

            {/* Summary Cards */}
            <div className={`grid grid-cols-1 ${shiftSubmitReady ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3 mb-4`}>
              <SummaryCard
                title="Basic Information"
                icon={<Calendar className="w-5 h-5 text-white" />}
                color="blue"
                items={[
                  { label: 'Week', value: formData.week_name },
                  { label: 'Day', value: formData.day_of_week },
                  { label: 'Submitted By', value: formData.submitted_by },
                ]}
              />
              {(!shiftSubmitReady || shiftTab === 'first') && (
                <SummaryCard
                  title="First Shift"
                  icon={<Sun className="w-5 h-5 text-white" />}
                  color="green"
                  items={[
                    { label: 'OEE Die Cut 1', value: `${formData.first_die_cut1_oee_pct}%` },
                    { label: 'OEE Die Cut 2', value: `${formData.first_die_cut2_oee_pct}%` },
                    { label: 'Pounds Die Cut 1', value: `${formData.first_die_cut1_pounds} lbs` },
                    { label: 'Pounds Die Cut 2', value: `${formData.first_die_cut2_pounds} lbs` },
                    { label: 'Waste Die Cut 1', value: `${formData.first_die_cut1_waste_lbs} lbs` },
                    { label: 'Waste Die Cut 2', value: `${formData.first_die_cut2_waste_lbs} lbs` },
                  ]}
                />
              )}
              {(!shiftSubmitReady || shiftTab === 'second') && (
                <SummaryCard
                  title="Second Shift"
                  icon={<Moon className="w-5 h-5 text-white" />}
                  color="orange"
                  items={[
                    { label: 'OEE Die Cut 1', value: `${formData.second_die_cut1_oee_pct}%` },
                    { label: 'OEE Die Cut 2', value: `${formData.second_die_cut2_oee_pct}%` },
                    { label: 'Pounds Die Cut 1', value: `${formData.second_die_cut1_pounds} lbs` },
                    { label: 'Pounds Die Cut 2', value: `${formData.second_die_cut2_pounds} lbs` },
                    { label: 'Waste Die Cut 1', value: `${formData.second_die_cut1_waste_lbs} lbs` },
                    { label: 'Waste Die Cut 2', value: `${formData.second_die_cut2_waste_lbs} lbs` },
                  ]}
                />
              )}
            </div>

            {/* Confirmation */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-600">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmationChecked}
                  onChange={e => setConfirmationChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-blue-600 border border-gray-300 dark:border-gray-500 rounded focus:ring-blue-500 focus:ring-2 bg-white dark:bg-gray-700"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">I confirm that all entered data is accurate</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">By checking this, I certify the metrics above are correct and complete.</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* ─── Navigation Buttons ───────────────────────────────────────────── */}
        <div className="bg-gray-50 dark:bg-gray-700/50 px-4 sm:px-5 py-3 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0 border-t border-gray-200 dark:border-gray-600">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={goPrev}
              className="w-full sm:w-auto px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center shadow-sm hover:shadow-md active:scale-[0.96] active:shadow-inner"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Previous
            </button>
          ) : <div />}

          <div className="flex space-x-2 w-full sm:w-auto">
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={goNext}
                disabled={currentStep === 1 && !!duplicateWarning}
                className={`flex-1 sm:flex-none px-5 py-2 text-white rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center shadow-sm
                  ${currentStep === 1 && duplicateWarning
                    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:shadow-md active:scale-[0.96] active:shadow-inner'
                  }`}
              >
                Next <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !!duplicateWarning}
                className="flex-1 sm:flex-none px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center shadow-sm hover:shadow-md active:scale-[0.96] active:shadow-inner"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Submitting...</>
                ) : (
                  <><Check className="w-4 h-4 mr-1.5" /> {shiftSubmitReady ? `Submit ${shiftTab === 'first' ? 'First' : 'Second'} Shift Records` : 'Submit Metrics'}</>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="flex-1 sm:flex-none px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center shadow-sm hover:shadow-md active:scale-[0.96] active:shadow-inner"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
            </button>
          </div>
        </div>

        {/* Submit progress bar */}
        {isSubmitting && (
          <div className="w-full px-5 pb-4">
            <style>{`
              @keyframes moveStripes {
                0% { background-position: 0 0; }
                100% { background-position: 20px 0; }
              }
              @keyframes pulse-glow {
                0%, 100% { box-shadow: 0 0 4px rgba(59,130,246,0.3); }
                50% { box-shadow: 0 0 12px rgba(59,130,246,0.6); }
              }
            `}</style>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {submitProgress < 25 ? 'Validating data...' : submitProgress < 50 ? 'Uploading metrics...' : submitProgress < 80 ? 'Processing records...' : 'Finalizing submission...'}
                </span>
              </div>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">{Math.round(submitProgress)}%</span>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full h-3 overflow-hidden" style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}>
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 rounded-full transition-all duration-300 relative overflow-hidden"
                style={{ width: `${submitProgress}%` }}
              >
                <div className="absolute inset-0 opacity-30" style={{
                  backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.3) 75%, transparent 75%)',
                  backgroundSize: '20px 20px',
                  animation: 'moveStripes 0.8s linear infinite',
                }} />
              </div>
            </div>
            <div className="flex justify-between mt-1.5">
              {['Validate', 'Upload', 'Process', 'Complete'].map((step, i) => {
                const stepThreshold = i * 25;
                const isActive = submitProgress >= stepThreshold;
                return (
                  <div key={step} className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isActive ? 'bg-blue-500 scale-110' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <span className={`text-[9px] font-medium transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>{/* end flex row left col */}
      </div>{/* end flex row */}

      {/* ─── Data Completeness Tracker Modal ────────────────────────────────── */}
      {showTrackerModal && createPortal(
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="relative h-full flex items-center justify-center p-2 sm:p-4 pointer-events-none">
            <div
              ref={trackerCardRef}
              className="relative h-[75vh] sm:h-[72vh] w-full max-w-4xl rounded-xl pointer-events-auto"
              style={{ transform: `translate3d(${trackerPos.x}px, ${trackerPos.y}px, 0)` }}
              onClick={e => e.stopPropagation()}
            >
              {/* ── Main Modal ── */}
              <div className="relative z-10 bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 w-full h-full overflow-hidden flex flex-col rounded-xl">
                {trackerContent}
                {/* Close button footer */}
                <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                    {(() => {
                      let count = 0;
                      if (trackerTab === 'outstanding' && missingData?.weeks) {
                        count = missingData.weeks.filter((week: any) => {
                          if (outstandingFilterWeeks.length > 0 && !outstandingFilterWeeks.includes(week.week_name)) return false;
                          if (outstandingFilterYear.length === 4 && parseInt(outstandingFilterYear) <= new Date().getFullYear() && !week.week_name.includes(outstandingFilterYear)) return false;
                          if (outstandingFilterType) {
                            const uDays = week.days.filter((d: any) => (d.status === 'missing' || d.status === 'incomplete') && !isResolved(week.week_name, d.day));
                            const fullyComplete = week.completion_pct === 100 && week.total_issues === 0;
                            const anyResolutions = week.days.some((d: any) => isResolved(week.week_name, d.day));
                            if (outstandingFilterType === 'unresolved') return uDays.length > 0;
                            if (outstandingFilterType === 'complete') return fullyComplete && uDays.length === 0;
                            if (outstandingFilterType === 'resolved') return uDays.length === 0 && anyResolutions;
                          }
                          return true;
                        }).length;
                      } else if (trackerTab === 'resolved') {
                        count = resolutions.filter((res: any) => {
                          if (resolvedFilterWeek && res.weekName !== resolvedFilterWeek) return false;
                          if (resolvedFilterDay && res.dayOfWeek !== resolvedFilterDay) return false;
                          if (resolvedFilterBy && res.resolvedBy !== resolvedFilterBy) return false;
                          if (resolvedFilterDate) {
                            const rd = new Date(res.resolvedAt);
                            const now = new Date();
                            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            const dayOfWeekNum = now.getDay();
                            const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeekNum === 0 ? 6 : dayOfWeekNum - 1));
                            if (resolvedFilterDate === 'today') { if (rd < startOfDay || rd >= new Date(startOfDay.getTime() + 86400000)) return false; }
                            else if (resolvedFilterDate === 'thisWeek') { if (rd < startOfWeek) return false; }
                            else if (resolvedFilterDate === 'lastWeek') { const lws = new Date(startOfWeek); lws.setDate(lws.getDate() - 7); if (rd < lws || rd >= startOfWeek) return false; }
                            else if (resolvedFilterDate === 'lastMonth') { const lms = new Date(now.getFullYear(), now.getMonth() - 1, 1); const lme = new Date(now.getFullYear(), now.getMonth(), 1); if (rd < lms || rd >= lme) return false; }
                            else if (resolvedFilterDate === 'lastQuarter') { const cq = Math.floor(now.getMonth() / 3); const lqs = new Date(now.getFullYear(), (cq - 1) * 3, 1); const lqe = new Date(now.getFullYear(), cq * 3, 1); if (cq === 0) { lqs.setFullYear(now.getFullYear() - 1); lqs.setMonth(9); lqe.setFullYear(now.getFullYear()); lqe.setMonth(0); } if (rd < lqs || rd >= lqe) return false; }
                            else if (resolvedFilterDate === 'thisYear') { if (rd.getFullYear() !== now.getFullYear()) return false; }
                            else if (resolvedFilterDate === 'lastYear') { if (rd.getFullYear() !== now.getFullYear() - 1) return false; }
                            else if (resolvedFilterDate === 'customYear' && resolvedFilterCustomYear.length === 4) { const cy = parseInt(resolvedFilterCustomYear); if (!isNaN(cy) && cy <= now.getFullYear() && rd.getFullYear() !== cy) return false; }
                          }
                          return true;
                        }).length;
                      } else if (trackerTab === 'activity') {
                        count = activityLogs.length;
                      }
                      return `${count} ${count === 1 ? 'Record' : 'Records'}`;
                    })()}
                  </span>
                  {(() => {
                    let fc = 0;
                    if (trackerTab === 'outstanding') {
                      fc = outstandingFilterWeeks.length + (outstandingFilterType ? 1 : 0) + (outstandingFilterYear.length === 4 ? 1 : 0);
                    } else if (trackerTab === 'resolved') {
                      fc = (resolvedFilterWeek ? 1 : 0) + (resolvedFilterDay ? 1 : 0) + (resolvedFilterDate ? 1 : 0) + (resolvedFilterBy ? 1 : 0);
                    } else if (trackerTab === 'activity') {
                      fc = (logFilterAction ? 1 : 0) + (logFilterUser ? 1 : 0) + (logFilterStartDate ? 1 : 0) + (logFilterEndDate ? 1 : 0);
                    }
                    return fc > 0 ? (
                      <span className="text-xs font-bold text-red-500 animate-[filterBlink_2s_ease-in-out_infinite]">
                        {fc} {fc === 1 ? 'Filter added' : 'Filters added'}
                      </span>
                    ) : null;
                  })()}
                  <button
                    onClick={() => setShowTrackerModal(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all active:scale-95"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* ── Slide-out Filter Panel (extends left outside modal) ── */}
              {showFilterPanel && (
                <div className={`absolute top-0 right-[calc(100%+6px)] w-56 sm:w-64 h-full bg-white dark:bg-gray-800 rounded-l-xl border border-r-0 border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col overflow-hidden z-0 ${filterPanelClosing ? 'animate-[slideOutLeft_200ms_ease-in_forwards]' : 'animate-[slideInLeft_200ms_ease-out_forwards]'}`}>
                  <div className="px-4 sm:px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 bg-white/20 rounded-lg">
                        <Filter className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white">Filters</span>
                        <p className="text-amber-100 text-[10px]">Refine your results</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setFilterPanelClosing(true); setTimeout(() => { setShowFilterPanel(false); setFilterPanelClosing(false); }, 250); }}
                      className="p-1 bg-white/20 rounded-md hover:bg-white/30 transition-all"
                      title="Close filters"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                    {/* Dynamic filters based on active tab */}
                    {trackerTab === 'activity' ? (
                      <>
                        {!activeFilters.includes('action') && !activeFilters.includes('user') && !activeFilters.includes('startDate') && !activeFilters.includes('endDate') && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center py-2">No filters added yet</p>
                        )}

                        {activeFilters.includes('action') && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Action Type</label>
                              <button onClick={() => { setActiveFilters(prev => prev.filter(f => f !== 'action')); setLogFilterAction(''); }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove filter"><Minus className="w-3 h-3" /></button>
                            </div>
                            <select value={logFilterAction} onChange={e => setLogFilterAction(e.target.value)} title="Filter by action type" className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800">
                              <option value="">All Actions</option>
                              <option value="RESOLVED">Resolved</option>
                              <option value="UNRESOLVED">Unresolved</option>
                              <option value="FILL_NOW">Fill Now</option>
                            </select>
                          </div>
                        )}

                        {activeFilters.includes('user') && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">User</label>
                              <button onClick={() => { setActiveFilters(prev => prev.filter(f => f !== 'user')); setLogFilterUser(''); }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove filter"><Minus className="w-3 h-3" /></button>
                            </div>
                            <input type="text" value={logFilterUser} onChange={e => setLogFilterUser(e.target.value)} placeholder="Filter by user..." className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium placeholder-gray-400 dark:placeholder-gray-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800" />
                          </div>
                        )}

                        {activeFilters.includes('startDate') && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Start Date</label>
                              <button onClick={() => { setActiveFilters(prev => prev.filter(f => f !== 'startDate')); setLogFilterStartDate(''); }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove filter"><Minus className="w-3 h-3" /></button>
                            </div>
                            <input type="date" value={logFilterStartDate} onChange={e => setLogFilterStartDate(e.target.value)} title="Start date" className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800" />
                          </div>
                        )}

                        {activeFilters.includes('endDate') && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">End Date</label>
                              <button onClick={() => { setActiveFilters(prev => prev.filter(f => f !== 'endDate')); setLogFilterEndDate(''); }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove filter"><Minus className="w-3 h-3" /></button>
                            </div>
                            <input type="date" value={logFilterEndDate} onChange={e => setLogFilterEndDate(e.target.value)} title="End date" className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800" />
                          </div>
                        )}

                        {(() => {
                          const available = [
                            { key: 'action', label: 'Action Type' },
                            { key: 'user', label: 'User' },
                            { key: 'startDate', label: 'Start Date' },
                            { key: 'endDate', label: 'End Date' },
                          ].filter(f => !activeFilters.includes(f.key));
                          if (available.length === 0) return null;
                          return (
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Add Filter</p>
                              <div className="space-y-1">
                                {available.map(f => (
                                  <button key={f.key} onClick={() => setActiveFilters(prev => [...prev, f.key])} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/15 hover:text-amber-700 dark:hover:text-amber-300 transition-colors text-left">
                                    <Plus className="w-3 h-3" /> {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : trackerTab === 'outstanding' ? (
                      <>
                        {outstandingFilterWeeks.length === 0 && !activeFilters.includes('weekType') && !activeFilters.includes('year') && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center py-2">No filters added yet</p>
                        )}

                        {outstandingFilterWeeks.map((wk, idx) => (
                          <div key={wk} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Week {outstandingFilterWeeks.length > 1 ? idx + 1 : ''}</label>
                              <button onClick={() => setOutstandingFilterWeeks(prev => prev.filter(w => w !== wk))} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove week filter"><Minus className="w-3 h-3" /></button>
                            </div>
                            <select value={wk} onChange={e => { const newVal = e.target.value; setOutstandingFilterWeeks(prev => newVal ? prev.map(w => w === wk ? newVal : w) : prev.filter(w => w !== wk)); }} title="Filter by week" className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800">
                              <option value={wk}>{formatWeekReadable(wk)}</option>
                              {missingData?.weeks?.filter((w2: any) => !outstandingFilterWeeks.includes(w2.week_name) || w2.week_name === wk).map((w2: any) => (
                                w2.week_name !== wk ? <option key={w2.week_name} value={w2.week_name}>{formatWeekReadable(w2.week_name)}</option> : null
                              ))}
                            </select>
                          </div>
                        ))}

                        {activeFilters.includes('year') && (() => {
                          const currentYear = new Date().getFullYear();
                          const isFutureYear = outstandingFilterYear.length === 4 && parseInt(outstandingFilterYear) > currentYear;
                          const allYears = Array.from(new Set((missingData?.weeks || []).map((w: any) => { const parts = w.week_name.split('_'); return parts[1]?.split('-')[2] || parts[0]?.split('-')[2] || ''; }).filter(Boolean))).sort();
                          const hasMatchingWeeks = outstandingFilterYear.length === 4 && !isFutureYear && (missingData?.weeks || []).some((w: any) => w.week_name.includes(outstandingFilterYear));
                          const noRecords = outstandingFilterYear.length === 4 && !isFutureYear && !hasMatchingWeeks;
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Year</label>
                                <button onClick={() => { setActiveFilters(prev => prev.filter(f => f !== 'year')); setOutstandingFilterYear(''); }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove filter"><Minus className="w-3 h-3" /></button>
                              </div>
                              <input type="text" inputMode="numeric" value={outstandingFilterYear} onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 4); setOutstandingFilterYear(val); }} placeholder="yyyy" title="Filter by year" className={`w-full px-2 py-1.5 rounded-md border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 ${isFutureYear || noRecords ? 'border-red-400 dark:border-red-600 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-800' : 'border-gray-300 dark:border-gray-600 focus:border-amber-400 focus:ring-amber-200 dark:focus:ring-amber-800'}`} />
                              {isFutureYear && <p className="text-[9px] text-red-500 dark:text-red-400 font-medium">Future year is not allowed</p>}
                              {noRecords && <p className="text-[9px] text-red-500 dark:text-red-400 font-medium">There is no record available for that year.{allYears.length > 0 && ` Available: ${allYears[0]}–${allYears[allYears.length - 1]}`}</p>}
                            </div>
                          );
                        })()}

                        {activeFilters.includes('weekType') && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Status</label>
                              <button onClick={() => { setActiveFilters(prev => prev.filter(f => f !== 'weekType')); setOutstandingFilterType(''); }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove filter"><Minus className="w-3 h-3" /></button>
                            </div>
                            <select value={outstandingFilterType} onChange={e => setOutstandingFilterType(e.target.value)} title="Filter by status" className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800">
                              <option value="">All Statuses</option>
                              <option value="unresolved">Unresolved Weeks</option>
                              <option value="complete">100% Completed Weeks</option>
                              <option value="resolved">Resolved Weeks</option>
                            </select>
                          </div>
                        )}

                        {(() => {
                          const allWeeksSelected = missingData?.weeks?.every((w: any) => outstandingFilterWeeks.includes(w.week_name));
                          const available = [
                            ...(!allWeeksSelected ? [{ key: 'week', label: 'Week' }] : []),
                            ...(!activeFilters.includes('year') ? [{ key: 'year', label: 'Year' }] : []),
                            ...(!activeFilters.includes('weekType') ? [{ key: 'weekType', label: 'Status' }] : []),
                          ];
                          if (available.length === 0) return null;
                          return (
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Add Filter</p>
                              <div className="space-y-1">
                                {available.map(f => (
                                  <button key={f.key} onClick={() => { if (f.key === 'week') { const firstAvailable = missingData?.weeks?.find((w: any) => !outstandingFilterWeeks.includes(w.week_name)); if (firstAvailable) setOutstandingFilterWeeks(prev => [...prev, firstAvailable.week_name]); } else { setActiveFilters(prev => [...prev, f.key]); } }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/15 hover:text-amber-700 dark:hover:text-amber-300 transition-colors text-left">
                                    <Plus className="w-3 h-3" /> {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : trackerTab === 'resolved' ? (
                      <>
                        {!activeFilters.includes('resolvedWeek') && !activeFilters.includes('resolvedDay') && !activeFilters.includes('resolvedDate') && !activeFilters.includes('resolvedBy') && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center py-2">No filters added yet</p>
                        )}

                        {activeFilters.includes('resolvedWeek') && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Week</label>
                              <button onClick={() => { setActiveFilters(prev => prev.filter(f => f !== 'resolvedWeek')); setResolvedFilterWeek(''); }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove filter"><Minus className="w-3 h-3" /></button>
                            </div>
                            <select value={resolvedFilterWeek} onChange={e => setResolvedFilterWeek(e.target.value)} title="Filter by week" className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800">
                              <option value="">All Weeks</option>
                              {Array.from(new Set(resolutions.map((r: any) => r.weekName))).sort().map((wk: any) => (
                                <option key={wk} value={wk}>{formatWeekReadable(wk)}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {activeFilters.includes('resolvedDay') && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Day</label>
                              <button onClick={() => { setActiveFilters(prev => prev.filter(f => f !== 'resolvedDay')); setResolvedFilterDay(''); }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove filter"><Minus className="w-3 h-3" /></button>
                            </div>
                            <select value={resolvedFilterDay} onChange={e => setResolvedFilterDay(e.target.value)} title="Filter by day" className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800">
                              <option value="">All Days</option>
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (<option key={d} value={d}>{d}</option>))}
                            </select>
                          </div>
                        )}

                        {activeFilters.includes('resolvedDate') && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Resolved Date</label>
                              <button onClick={() => { setActiveFilters(prev => prev.filter(f => f !== 'resolvedDate')); setResolvedFilterDate(''); setResolvedFilterCustomYear(''); }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove filter"><Minus className="w-3 h-3" /></button>
                            </div>
                            <select value={resolvedFilterDate} onChange={e => { setResolvedFilterDate(e.target.value); if (e.target.value !== 'customYear') setResolvedFilterCustomYear(''); }} title="Filter by resolved date" className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800">
                              <option value="">All Dates</option>
                              <option value="today">Today</option>
                              <option value="thisWeek">This Week</option>
                              <option value="lastWeek">Last Week</option>
                              <option value="lastMonth">Last Month</option>
                              <option value="lastQuarter">Last Quarter</option>
                              <option value="thisYear">This Year</option>
                              <option value="lastYear">Last Year</option>
                              <option value="customYear">Custom Year</option>
                            </select>
                            {resolvedFilterDate === 'customYear' && (() => {
                              const currentYear = new Date().getFullYear();
                              const isFutureYear = resolvedFilterCustomYear.length === 4 && parseInt(resolvedFilterCustomYear) > currentYear;
                              const allResYears = Array.from(new Set(resolutions.map((r: any) => new Date(r.resolvedAt).getFullYear().toString()))).sort();
                              const hasMatch = resolvedFilterCustomYear.length === 4 && !isFutureYear && resolutions.some((r: any) => new Date(r.resolvedAt).getFullYear().toString() === resolvedFilterCustomYear);
                              const noRecords = resolvedFilterCustomYear.length === 4 && !isFutureYear && !hasMatch;
                              return (
                                <>
                                  <input type="text" inputMode="numeric" value={resolvedFilterCustomYear} onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 4); setResolvedFilterCustomYear(val); }} placeholder="yyyy" title="Enter year" className={`w-full px-2 py-1.5 rounded-md border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 ${isFutureYear || noRecords ? 'border-red-400 dark:border-red-600 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-800' : 'border-gray-300 dark:border-gray-600 focus:border-amber-400 focus:ring-amber-200 dark:focus:ring-amber-800'}`} />
                                  {isFutureYear && <p className="text-[9px] text-red-500 dark:text-red-400 font-medium">Future year is not allowed</p>}
                                  {noRecords && <p className="text-[9px] text-red-500 dark:text-red-400 font-medium">There is no record available for that year.{allResYears.length > 0 && ` Available: ${allResYears[0]}–${allResYears[allResYears.length - 1]}`}</p>}
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {activeFilters.includes('resolvedBy') && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Resolved By</label>
                              <button onClick={() => { setActiveFilters(prev => prev.filter(f => f !== 'resolvedBy')); setResolvedFilterBy(''); }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove filter"><Minus className="w-3 h-3" /></button>
                            </div>
                            <select value={resolvedFilterBy} onChange={e => setResolvedFilterBy(e.target.value)} title="Filter by resolver" className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800">
                              <option value="">All Users</option>
                              {Array.from(new Set(resolutions.map((r: any) => r.resolvedBy).filter(Boolean))).sort().map((name: any) => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {(() => {
                          const available = [
                            { key: 'resolvedWeek', label: 'Week' },
                            { key: 'resolvedDay', label: 'Day' },
                            { key: 'resolvedDate', label: 'Resolved Date' },
                            { key: 'resolvedBy', label: 'Resolved By' },
                          ].filter(f => !activeFilters.includes(f.key));
                          if (available.length === 0) return null;
                          return (
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Add Filter</p>
                              <div className="space-y-1">
                                {available.map(f => (
                                  <button key={f.key} onClick={() => setActiveFilters(prev => [...prev, f.key])} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/15 hover:text-amber-700 dark:hover:text-amber-300 transition-colors text-left">
                                    <Plus className="w-3 h-3" /> {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : null}
                  </div>

                  {/* Clear All button at bottom */}
                  {(activeFilters.length > 0 || outstandingFilterWeeks.length > 0 || outstandingFilterYear || resolvedFilterWeek || resolvedFilterDay || resolvedFilterDate || resolvedFilterBy) && (
                    <div className="flex-shrink-0 px-3 py-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => { setActiveFilters([]); setLogFilterAction(''); setLogFilterUser(''); setLogFilterStartDate(''); setLogFilterEndDate(''); setOutstandingFilterWeeks([]); setOutstandingFilterType(''); setOutstandingFilterYear(''); setResolvedFilterWeek(''); setResolvedFilterDay(''); setResolvedFilterDate(''); setResolvedFilterCustomYear(''); setResolvedFilterBy(''); }}
                        className="w-full px-2 py-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/15 rounded-md transition-colors"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}
      {/* ─── Resolve Modal ──────────────────────────────────────────────────── */}
      {resolveModal && (
        <div className="fixed inset-0 z-50" onClick={() => setResolveModal(null)}>
          <div className="absolute inset-0 backdrop-blur-sm bg-black/30" />
          <div className="relative h-full flex items-center justify-center p-4">
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <PenLine className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold">Resolve Missing Record</h2>
                      <p className="text-amber-100 text-[11px]">{resolveModal.dayOfWeek} — {formatWeekReadable(resolveModal.weekName)}</p>
                    </div>
                  </div>
                  <button onClick={() => setResolveModal(null)} title="Close" className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all active:scale-90">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Why is this record missing? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={resolveReason}
                    onChange={e => setResolveReason(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900/30 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm placeholder-gray-400 dark:placeholder-gray-500 resize-none transition-all"
                    rows={4}
                    maxLength={1000}
                    placeholder="e.g., Machine was down for maintenance, No production scheduled, Holiday..."
                  />
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 text-right">{resolveReason.length}/1000</p>
                </div>

                {/* Quick reason chips */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Quick Reasons:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['No production scheduled', 'Machine maintenance', 'Holiday / Plant closed', 'Staff shortage', 'Data entry error', 'Weekend / Off day'].map(reason => (
                      <button
                        key={reason}
                        onClick={() => setResolveReason(reason)}
                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
                          resolveReason === reason
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-300'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Or fill now divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">or</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>

                {/* Fill Now option */}
                <button
                  onClick={() => {
                    const wk = resolveModal.weekName;
                    const dy = resolveModal.dayOfWeek;
                    setResolveModal(null);
                    handleFillNow(wk, dy);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all active:scale-[0.98]"
                >
                  <ExternalLink className="w-4 h-4" />
                  Fill This Record Now — auto-selects week & day for you
                </button>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-3 flex justify-end gap-2 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => setResolveModal(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={!resolveReason.trim() || savingResolve}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
                    !resolveReason.trim() || savingResolve
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:from-amber-600 hover:to-orange-600'
                  }`}
                >
                  {savingResolve ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {savingResolve ? 'Saving...' : 'Mark as Resolved'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Unresolve Confirmation Modal ────────────────────────────────── */}
      {unresolveConfirm && (
        <div className="fixed inset-0 z-50" onClick={() => !unresolving && setUnresolveConfirm(null)}>
          <div className="absolute inset-0 backdrop-blur-sm bg-black/30" />
          <div className="relative h-full flex items-center justify-center p-4">
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-orange-500 px-5 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold">Put Back to Outstanding</h2>
                      <p className="text-red-100 text-[11px]">{unresolveConfirm.dayOfWeek} — {formatWeekReadable(unresolveConfirm.weekName)}</p>
                    </div>
                  </div>
                  <button onClick={() => setUnresolveConfirm(null)} title="Close" className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all active:scale-90">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Are you sure?</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                      You are about to unresolve this missing record. It will <span className="font-bold text-red-600 dark:text-red-400">no longer be marked as resolved</span> and will move back to Outstanding.
                    </p>
                  </div>
                </div>

                <div className="px-3.5 py-2.5 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/40 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">You can resolve this record again at any time.</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-3 flex justify-end gap-2 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => setUnresolveConfirm(null)}
                  disabled={unresolving}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnresolve}
                  disabled={unresolving}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg text-xs font-bold shadow-sm hover:from-red-600 hover:to-orange-600 transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {unresolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  {unresolving ? 'Removing...' : 'Yes, Put Back'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── All Submissions Modal ──────────────────────────────────────────── */}
      {showAllModal && createPortal(
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="relative h-full flex items-center justify-center p-4 pointer-events-none">
            {/* Drag-wrapper holds both modal card and filter panel so they translate together */}
            <div
              ref={allModalCardRef}
              className="relative flex items-start gap-0 pointer-events-auto"
              style={{ transform: `translate3d(${allModalPos.x}px, ${allModalPos.y}px, 0)` }}
              onClick={e => e.stopPropagation()}
            >
              {/* Main modal card — fixed height */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[min(64rem,calc(100vw-2rem))] h-[72vh] overflow-hidden flex flex-col">
                {/* Modal Header — drag handle */}
                <div
                  className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-white border-b border-white/20 select-none cursor-move"
                  onMouseDown={handleAllModalDragStart}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-white/20 rounded-lg"><Database className="w-4 h-4" /></div>
                      <div>
                        <h2 className="text-sm font-bold">All Submissions</h2>
                        <p className="text-blue-100 text-[10px]">Complete history of bakery metrics</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowAllFilter(v => !v)}
                        className={`relative p-1.5 rounded-lg transition-all active:scale-90 ${showAllFilter ? 'bg-white text-blue-600' : 'bg-white/20 hover:bg-white/30 text-white'}`}
                        title="Filter submissions"
                      >
                        <Filter className="w-4 h-4" />
                        {allFilterActiveCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
                            {allFilterActiveCount}
                          </span>
                        )}
                      </button>
                      <button onClick={() => setShowAllModal(false)} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all active:scale-90" title="Close modal">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto">
                {allSubsLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Loading Submissions</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Please wait...</p>
                  </div>
                ) : allSubmissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-2">
                      <Inbox className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">No Submissions Found</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">There are no submissions to display.</p>
                    <button
                      onClick={loadAllSubmissions}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition-colors active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Retry
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">Week</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">Day</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">Submitted By</th>
                          <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredAllSubmissions.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                              No submissions match the current filters.
                            </td>
                          </tr>
                        ) : filteredAllSubmissions.map((sub, i) => {
                          const statusClass = sub.status === 'Completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
                          return (
                            <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                              <td className="px-4 py-2.5 text-xs text-gray-900 dark:text-gray-200 font-medium">{sub.week_name || 'N/A'}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-900 dark:text-gray-200">{sub.day_of_week || 'N/A'}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-900 dark:text-gray-200">{sub.submitted_by || 'N/A'}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusClass}`}>{sub.status || 'Completed'}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              </div>
              {/* Outward Filter Panel — sibling of the card, same fixed height */}
              {showAllFilter && (
                <div className="w-72 h-[72vh] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl origin-left flex flex-col overflow-hidden animate-[filterPanelIn_0.22s_cubic-bezier(0.34,1.56,0.64,1)]">
                  <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                      <Filter className="w-3.5 h-3.5" /> Filter
                      {allFilterActiveCount > 0 && (
                        <span className="bg-blue-600 text-white text-[9px] rounded-full px-1.5 py-0.5">{allFilterActiveCount}</span>
                      )}
                    </div>
                    <button onClick={() => setShowAllFilter(false)} className="p-1 hover:bg-white/80 dark:hover:bg-gray-700 rounded transition" title="Close filter">
                      <X className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    <div className="relative">
                      <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Week</label>
                      <button
                        type="button"
                        onClick={() => setShowWeekDropdown(v => !v)}
                        className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center justify-between gap-1 hover:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <span className="truncate">{allFilterWeek || 'All weeks'}</span>
                        <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${showWeekDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {showWeekDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-10 max-h-48 overflow-y-auto bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                          <button type="button" onClick={() => { setAllFilterWeek(''); setShowWeekDropdown(false); }} className={`w-full text-left text-xs px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 ${!allFilterWeek ? 'bg-blue-100 dark:bg-blue-900/40 font-semibold' : ''}`}>All weeks</button>
                          {uniqueAllWeeks.map(w => (
                            <button key={w} type="button" onClick={() => { setAllFilterWeek(w); setShowWeekDropdown(false); }} className={`w-full text-left text-xs px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 ${allFilterWeek === w ? 'bg-blue-100 dark:bg-blue-900/40 font-semibold' : ''}`}>{w}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Day</label>
                      <select title="Filter by day" value={allFilterDay} onChange={e => setAllFilterDay(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">All days</option>
                        <option>Monday</option>
                        <option>Tuesday</option>
                        <option>Wednesday</option>
                        <option>Thursday</option>
                        <option>Friday</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Submitted By</label>
                      <select title="Filter by submitter" value={allFilterUser} onChange={e => setAllFilterUser(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">Everyone</option>
                        {uniqueAllUsers.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Status</label>
                      <select title="Filter by status" value={allFilterStatus} onChange={e => setAllFilterStatus(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">All statuses</option>
                        <option value="Completed">Completed</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                      {filteredAllSubmissions.length} of {allSubmissions.length}
                    </span>
                    <button
                      onClick={clearAllFilters}
                      disabled={allFilterActiveCount === 0}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <RotateCcw className="w-3 h-3" /> Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* ═══ Success Modal ═══ */}
      {successModal.show && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setSuccessModal(prev => ({ ...prev, show: false })); }}>
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
              100% { transform: translateY(80px) rotate(720deg) scale(0); opacity: 0; }
            }
            @keyframes draw-check {
              0% { stroke-dashoffset: 50; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes draw-circle {
              0% { stroke-dashoffset: 166; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes success-bounce {
              0% { transform: scale(0); opacity: 0; }
              50% { transform: scale(1.08); }
              70% { transform: scale(0.96); }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes fade-in-up {
              0% { opacity: 0; transform: translateY(12px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes shimmer-text {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
          `}</style>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            style={{ animation: 'success-bounce 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Green header banner with confetti */}
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-5 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-white rounded-full" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white rounded-full" />
              </div>
              {/* Confetti particles */}
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: `${4 + (i % 3) * 2}px`,
                    height: `${4 + (i % 3) * 2}px`,
                    backgroundColor: ['#fbbf24', '#f87171', '#60a5fa', '#34d399', '#a78bfa', '#fb923c'][i % 6],
                    left: `${8 + (i * 7.5)}%`,
                    top: `${15 + (i % 4) * 8}%`,
                    animation: `confetti-fall ${1.5 + (i % 3) * 0.5}s ease-out ${0.3 + i * 0.08}s forwards`,
                  }}
                />
              ))}
              <div className="relative">
                {/* Animated SVG checkmark */}
                <div className="w-16 h-16 mx-auto mb-3" style={{ animation: 'success-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' }}>
                  <svg viewBox="0 0 52 52" className="w-full h-full">
                    <circle cx="26" cy="26" r="25" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"
                      style={{ strokeDasharray: 166, animation: 'draw-circle 0.6s ease-out forwards' }} />
                    <circle cx="26" cy="26" r="25" fill="rgba(255,255,255,0.15)" />
                    <path fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      d="M14.1 27.2l7.1 7.2 16.7-16.8"
                      style={{ strokeDasharray: 50, strokeDashoffset: 50, animation: 'draw-check 0.4s ease-out 0.5s forwards' }} />
                  </svg>
                </div>
                <h3 className="text-lg font-bold" style={{
                  background: 'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.6) 50%, #fff 100%)',
                  backgroundSize: '200% 100%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'shimmer-text 2.5s ease-in-out infinite',
                }}>Submission Successful!</h3>
                <p className="text-emerald-100 text-xs mt-1">Your bakery metrics have been recorded</p>
              </div>
            </div>

            {/* Details body */}
            <div className="px-6 py-4 space-y-4">
              {/* Submitted by + timestamp */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3"
                style={{ animation: 'fade-in-up 0.4s ease-out 0.3s both' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{successModal.submittedBy}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Submitted by</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-medium">{successModal.timestamp}</span>
                  </div>
                </div>
              </div>

              {/* Submission info cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 text-center border border-blue-200 dark:border-blue-700"
                  style={{ animation: 'fade-in-up 0.4s ease-out 0.4s both' }}>
                  <Calendar className="w-3.5 h-3.5 mx-auto text-blue-500 mb-1" />
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Week</p>
                  <p className="text-[10px] font-bold text-gray-900 dark:text-white mt-0.5">{formatWeekReadable(successModal.weekName)}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2 text-center border border-purple-200 dark:border-purple-700"
                  style={{ animation: 'fade-in-up 0.4s ease-out 0.5s both' }}>
                  <CalendarDays className="w-3.5 h-3.5 mx-auto text-purple-500 mb-1" />
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Day</p>
                  <p className="text-[10px] font-bold text-gray-900 dark:text-white mt-0.5">{successModal.dayOfWeek}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 text-center border border-amber-200 dark:border-amber-700"
                  style={{ animation: 'fade-in-up 0.4s ease-out 0.6s both' }}>
                  <Sun className="w-3.5 h-3.5 mx-auto text-amber-500 mb-1" />
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Shift</p>
                  <p className="text-[10px] font-bold text-gray-900 dark:text-white mt-0.5">{successModal.shiftType}</p>
                </div>
              </div>

              {/* Metrics summary — table form */}
              <div style={{ animation: 'fade-in-up 0.4s ease-out 0.7s both' }}>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> Submitted Metrics
                </p>
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl overflow-hidden max-h-44 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-600/50">
                        <th className="text-left px-3 py-1.5 text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Metric</th>
                        <th className="text-right px-3 py-1.5 text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {successModal.metrics.map((m, i) => (
                        <tr key={i} className={`${i % 2 === 0 ? 'bg-white dark:bg-gray-700/20' : 'bg-gray-50 dark:bg-gray-700/40'} hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors`}
                          style={{ animation: `fade-in-up 0.3s ease-out ${0.8 + i * 0.05}s both` }}>
                          <td className="px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-400">{m.label}</td>
                          <td className="px-3 py-1.5 text-[11px] font-bold text-gray-900 dark:text-white text-right tabular-nums">{m.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-2" style={{ animation: 'fade-in-up 0.4s ease-out 0.9s both' }}>
              <button
                onClick={() => {
                  setSuccessModal(prev => ({ ...prev, show: false }));
                  loadRecentSubmissions();
                  onSuccessClose?.();
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSuccessModal(prev => ({ ...prev, show: false }));
                  executeReset();
                }}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all shadow-sm hover:shadow-md"
              >
                Submit New Entry
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ═══ Reset Confirm Modal ═══ */}
      {resetConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setResetConfirm(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Reset Form?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">All entered data will be cleared. This action cannot be undone.</p>
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button
                onClick={() => setResetConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeReset}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors shadow-sm"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════════

interface MetricFieldDef {
  label: string;
  field: keyof FormData;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
}

function MetricSection({
  title, icon, bgFrom, fields, formData, updateField, inputClasses, onBlur,
}: {
  title: string;
  icon: React.ReactNode;
  bgFrom: string;
  fields: MetricFieldDef[];
  formData: FormData;
  updateField: (f: keyof FormData, v: string) => void;
  inputClasses: (f: string) => string;
  onBlur: (f: string, v: string) => void;
}) {
  const bgMap: Record<string, string> = {
    indigo: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-700',
    green: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700',
    red: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700',
  };

  return (
    <div className={`bg-gradient-to-r ${bgMap[bgFrom] || bgMap.indigo} rounded-lg px-3 py-2`}>
      <h4 className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5 flex items-center">
        {icon}
        {title}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {fields.map(f => (
          <div key={f.field}>
            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-0.5">
              {f.label} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData[f.field]}
                onChange={e => updateField(f.field, e.target.value)}
                onBlur={() => onBlur(f.field, formData[f.field])}
                className={inputClasses(f.field)}
                min={f.min}
                max={f.max}
                step={f.step}
                placeholder="0.0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs font-medium">
                {f.unit}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  title, icon, color, items,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: { label: string; value: string }[];
}) {
  const colorMap: Record<string, { bg: string; iconBg: string; border: string }> = {
    blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20', iconBg: 'bg-blue-500', border: 'border-blue-200 dark:border-blue-700' },
    green:  { bg: 'bg-green-50 dark:bg-green-900/20', iconBg: 'bg-green-500', border: 'border-green-200 dark:border-green-700' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', iconBg: 'bg-orange-500', border: 'border-orange-200 dark:border-orange-700' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`${c.bg} rounded-lg p-3 border ${c.border} shadow-sm hover:shadow-md transition-all duration-200`}>
      <div className="flex items-center space-x-2 mb-2">
        <div className={`p-1.5 ${c.iconBg} rounded-lg`}>{icon}</div>
        <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h4>
      </div>
      <div className="space-y-1">
        {items.filter(it => it.value && !it.value.includes('undefined') && !it.value.includes('null')).map(it => (
          <div key={it.label} className="flex justify-between items-center py-0.5">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{it.label}</span>
            <span className="text-[11px] font-bold text-gray-900 dark:text-gray-100">{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
