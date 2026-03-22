'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  CalendarPlus,
  CalendarDays,
  Trash2,
  Target,
  Gauge,
  Package,
  Save,
  Loader2,
  History,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
  ShieldAlert,
  TrendingUp,
  ArrowRight,
  Zap,
  ToggleLeft,
  ToggleRight,
  Clock,
  Plus,
  Lightbulb,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface Week {
  id: string;
  sheet_name: string;
  week_start: string;
  week_end: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface HistoryItem {
  id: number;
  metric_type: string;
  metric_name: string;
  old_value: number | null;
  new_value: number;
  changed_by: string | null;
  changed_at: string;
}

interface TipGuideline {
  id?: number;
  title: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ─── Intersection Observer Hook ─────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, isInView };
}

// ─── Helper ─────────────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const y = d.getUTCFullYear();
  return `${m}-${day}-${y}`;
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function getMetricLabel(metricType: string, metricName: string) {
  const typeLabels: Record<string, string> = { oee: 'OEE', volume: 'Volume', waste: 'Waste' };
  const nameLabels: Record<string, string> = { die_cut_1: 'Die Cut 1', die_cut_2: 'Die Cut 2', total: 'Total' };
  return `${typeLabels[metricType] || metricType} - ${nameLabels[metricName] || metricName}`;
}

function getMetricTypeColor(metricType: string) {
  switch (metricType) {
    case 'oee': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'volume': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'waste': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getMetricIcon(metricType: string) {
  switch (metricType) {
    case 'oee': return Gauge;
    case 'volume': return Package;
    case 'waste': return Trash2;
    default: return Target;
  }
}

function getMetricBorderColor(metricType: string) {
  switch (metricType) {
    case 'oee': return 'border-l-blue-500';
    case 'volume': return 'border-l-emerald-500';
    case 'waste': return 'border-l-red-500';
    default: return 'border-l-gray-500';
  }
}

export default function BakeryMetricsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN';

  // ─── Week state ───────────────────────────────────────────────────────────
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [weeksLoading, setWeeksLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generatedWeekName, setGeneratedWeekName] = useState('');
  const [addingWeek, setAddingWeek] = useState(false);
  const [deletingWeekId, setDeletingWeekId] = useState<string | null>(null);

  // ─── Auto-week state ──────────────────────────────────────────────────────
  const [autoWeekEnabled, setAutoWeekEnabled] = useState(false);
  const [autoWeekLoading, setAutoWeekLoading] = useState(true);
  const [autoWeekToggling, setAutoWeekToggling] = useState(false);
  const [autoWeekEnabledBy, setAutoWeekEnabledBy] = useState<string | null>(null);

  // ─── KPI state ────────────────────────────────────────────────────────────
  const [oee, setOee] = useState({ die_cut_1: 74, die_cut_2: 74, total: 74 });
  const [volume, setVolume] = useState({ die_cut_1: 6000, die_cut_2: 6000, total: 12000 });
  const [waste, setWaste] = useState({ die_cut_1: 3, die_cut_2: 3, total: 3 });
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [savingTargets, setSavingTargets] = useState(false);

  // ─── Deadline state ───────────────────────────────────────────────────────
  const [deadline, setDeadline] = useState('End of Day');
  const [deadlineLoading, setDeadlineLoading] = useState(true);
  const [savingDeadline, setSavingDeadline] = useState(false);
  // ─── Tips & Guidelines state ────────────────────────────────────────────────
  const [tips, setTips] = useState<TipGuideline[]>([]);
  const [tipsLoading, setTipsLoading] = useState(true);
  const [savingTips, setSavingTips] = useState(false);
  // ─── History state ────────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ─── Notifications ────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((message: string, type: Notification['type'] = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  // ─── Auto-generate week name ─────────────────────────────────────────────
  useEffect(() => {
    if (startDate && endDate) {
      const fmt = (d: string) => {
        const date = new Date(d + 'T00:00:00');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const y = date.getFullYear();
        return `${m}-${day}-${y}`;
      };
      setGeneratedWeekName(`${fmt(startDate)}_${fmt(endDate)}`);
    } else {
      setGeneratedWeekName('');
    }
  }, [startDate, endDate]);

  // ─── Load weeks ───────────────────────────────────────────────────────────
  const loadWeeks = useCallback(async () => {
    setWeeksLoading(true);
    try {
      const { data } = await api.get('/bakery-metrics/weeks');
      if (data.success) setWeeks(data.weeks);
    } catch (err: any) {
      console.error('Error loading weeks:', err);
    } finally {
      setWeeksLoading(false);
    }
  }, []);

  // ─── Load auto-week setting ──────────────────────────────────────────────
  const loadAutoWeekSetting = useCallback(async () => {
    setAutoWeekLoading(true);
    try {
      const { data } = await api.get('/bakery-metrics/auto-week');
      if (data.success) {
        setAutoWeekEnabled(data.setting.enabled);
        setAutoWeekEnabledBy(data.setting.enabled_by);
      }
    } catch (err: any) {
      console.error('Error loading auto-week setting:', err);
    } finally {
      setAutoWeekLoading(false);
    }
  }, []);

  // ─── Toggle auto-week ────────────────────────────────────────────────────
  const handleToggleAutoWeek = useCallback(async () => {
    const newState = !autoWeekEnabled;
    const confirmMsg = newState
      ? 'Enable auto-week generation? A new Mon–Fri week will be created every Tuesday at 12:00 AM automatically.'
      : 'Disable auto-week generation? You will need to create weeks manually.';
    if (!confirm(confirmMsg)) return;

    setAutoWeekToggling(true);
    try {
      const { data } = await api.put('/bakery-metrics/auto-week', { enabled: newState });
      if (data.success) {
        setAutoWeekEnabled(data.setting.enabled);
        setAutoWeekEnabledBy(data.setting.enabled_by);
        notify(data.message, 'success');
      }
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to toggle auto-week', 'error');
    } finally {
      setAutoWeekToggling(false);
    }
  }, [autoWeekEnabled, notify]);

  // ─── Load KPI targets ────────────────────────────────────────────────────
  const loadTargets = useCallback(async () => {
    setTargetsLoading(true);
    try {
      const { data } = await api.get('/bakery-metrics/kpi-targets/detailed');
      if (data.success && data.targets) {
        setOee({
          die_cut_1: data.targets.oee.die_cut_1.value,
          die_cut_2: data.targets.oee.die_cut_2.value,
          total: data.targets.oee.total.value,
        });
        setVolume({
          die_cut_1: data.targets.volume.die_cut_1.value,
          die_cut_2: data.targets.volume.die_cut_2.value,
          total: data.targets.volume.total.value,
        });
        setWaste({
          die_cut_1: data.targets.waste.die_cut_1.value,
          die_cut_2: data.targets.waste.die_cut_2.value,
          total: data.targets.waste.total.value,
        });
      }
    } catch (err: any) {
      console.error('Error loading targets:', err);
    } finally {
      setTargetsLoading(false);
    }
  }, []);

  // ─── Load history ─────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/bakery-metrics/kpi-targets/history?limit=20');
      if (data.success) setHistory(data.history);
    } catch (err: any) {
      console.error('Error loading history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // ─── Load deadline ────────────────────────────────────────────────────────
  const loadDeadline = useCallback(async () => {
    setDeadlineLoading(true);
    try {
      const { data } = await api.get('/bakery-metrics/submission-deadline');
      if (data.success && data.deadline) {
        setDeadline(data.deadline);
      }
    } catch (err: any) {
      console.error('Error loading deadline:', err);
    } finally {
      setDeadlineLoading(false);
    }
  }, []);
  // ─── Load tips & guidelines ─────────────────────────────────────────────────
  const loadTips = useCallback(async () => {
    setTipsLoading(true);
    try {
      const { data } = await api.get('/bakery-metrics/tips-guidelines/all');
      if (data.success && data.tips) {
        setTips(data.tips);
      }
    } catch (err: any) {
      console.error('Error loading tips:', err);
    } finally {
      setTipsLoading(false);
    }
  }, []);
  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadWeeks();
    loadTargets();
    loadHistory();
    loadAutoWeekSetting();
    loadDeadline();
    loadTips();
  }, [loadWeeks, loadTargets, loadHistory, loadAutoWeekSetting, loadDeadline, loadTips]);

  // ─── Add week ─────────────────────────────────────────────────────────────
  const handleAddWeek = async () => {
    if (!startDate || !endDate || !generatedWeekName) {
      notify('Please select both start and end dates', 'warning');
      return;
    }
    setAddingWeek(true);
    try {
      const fmt = (d: string) => {
        const date = new Date(d + 'T00:00:00');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const y = date.getFullYear();
        return `${m}-${day}-${y}`;
      };
      const { data } = await api.post('/bakery-metrics/weeks', {
        start_date: fmt(startDate),
        end_date: fmt(endDate),
        week_name: generatedWeekName,
      });
      if (data.success) {
        notify('Week added successfully!', 'success');
        setStartDate('');
        setEndDate('');
        loadWeeks();
      }
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to add week', 'error');
    } finally {
      setAddingWeek(false);
    }
  };

  // ─── Delete week ──────────────────────────────────────────────────────────
  const handleDeleteWeek = async (weekId: string, weekName: string) => {
    if (!confirm(`Are you sure you want to delete week "${weekName}"?`)) return;
    setDeletingWeekId(weekId);
    try {
      const { data } = await api.delete(`/bakery-metrics/weeks/${weekId}`);
      if (data.success) {
        notify('Week deleted successfully', 'success');
        loadWeeks();
      }
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to delete week', 'error');
    } finally {
      setDeletingWeekId(null);
    }
  };

  // ─── Save KPI targets ────────────────────────────────────────────────────
  const handleSaveTargets = async () => {
    setSavingTargets(true);
    try {
      const { data } = await api.put('/bakery-metrics/kpi-targets', {
        oee_die_cut_1: oee.die_cut_1,
        oee_die_cut_2: oee.die_cut_2,
        oee_total: oee.total,
        volume_die_cut_1: volume.die_cut_1,
        volume_die_cut_2: volume.die_cut_2,
        volume_total: volume.total,
        waste_die_cut_1: waste.die_cut_1,
        waste_die_cut_2: waste.die_cut_2,
        waste_total: waste.total,
      });
      if (data.success) {
        notify(`Targets saved! ${data.total_changes} value(s) changed.`, 'success');
        loadHistory();
      }
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to save targets', 'error');
    } finally {
      setSavingTargets(false);
    }
  };

  // ─── Save deadline ────────────────────────────────────────────────────────
  const handleSaveDeadline = async () => {
    if (!deadline.trim()) {
      notify('Deadline cannot be empty', 'warning');
      return;
    }
    setSavingDeadline(true);
    try {
      const { data } = await api.put('/bakery-metrics/submission-deadline', { deadline: deadline.trim() });
      if (data.success) {
        notify(data.message || 'Deadline saved!', 'success');
      }
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to save deadline', 'error');
    } finally {
      setSavingDeadline(false);
    }
  };

  // ─── Tips helpers ───────────────────────────────────────────────────────────
  const colorOptions = ['green', 'orange', 'blue', 'red', 'purple', 'yellow'];
  const iconOptions = ['check', 'alert', 'clock', 'info', 'lightbulb', 'target'];

  const addTip = () => {
    setTips(prev => [
      ...prev,
      { title: '', description: '', color: 'blue', icon: 'info', sort_order: prev.length, is_active: true },
    ]);
  };

  const removeTip = (index: number) => {
    setTips(prev => prev.filter((_, i) => i !== index));
  };

  const updateTip = (index: number, field: keyof TipGuideline, value: any) => {
    setTips(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const handleSaveTips = async () => {
    const validTips = tips.filter(t => t.title.trim() && t.description.trim());
    if (validTips.length === 0) {
      notify('Add at least one tip with title and description', 'warning');
      return;
    }
    setSavingTips(true);
    try {
      const { data } = await api.put('/bakery-metrics/tips-guidelines', {
        tips: validTips.map((t, i) => ({ ...t, sort_order: i })),
      });
      if (data.success) {
        notify(data.message || 'Tips saved!', 'success');
        loadTips();
      }
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to save tips', 'error');
    } finally {
      setSavingTips(false);
    }
  };

  // ─── Access guard ─────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center py-12">
          <Loader2 className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center py-12">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Admin Access Required</h2>
          <p className="text-gray-500 dark:text-gray-400">You need Admin privileges to access this section.</p>
        </div>
      </div>
    );
  }

  // ─── Intersection observers for scroll animations ─────────────────────
  const weekSection = useInView(0.05);
  const kpiSection = useInView(0.05);
  const historySection = useInView(0.05);

  return (
    <div className="space-y-6">
      {/* ── CSS for animations ─────────────────────────────────────────────── */}
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(99,102,241,.3); }
          50% { border-color: rgba(99,102,241,.7); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-fade-up { animation: fadeInUp 0.5s ease-out both; }
        .animate-fade-left { animation: fadeInLeft 0.5s ease-out both; }
        .animate-fade-right { animation: fadeInRight 0.5s ease-out both; }
        .animate-slide-down { animation: slideDown 0.3s ease-out both; }
        .stagger-1 { animation-delay: 0.05s; }
        .stagger-2 { animation-delay: 0.1s; }
        .stagger-3 { animation-delay: 0.15s; }
        .stagger-4 { animation-delay: 0.2s; }
        .stagger-5 { animation-delay: 0.25s; }
        .stagger-6 { animation-delay: 0.3s; }
        .pulse-border-anim { animation: pulse-border 2s ease-in-out infinite; }
        .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 25px -5px rgba(0,0,0,0.1); }
        .shimmer-bg {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>

      {/* ── Notifications ──────────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-down backdrop-blur-sm ${
              n.type === 'success' ? 'bg-emerald-500/95 text-white' :
              n.type === 'error' ? 'bg-red-500/95 text-white' :
              n.type === 'warning' ? 'bg-amber-500/95 text-white' :
              'bg-blue-500/95 text-white'
            }`}
          >
            {n.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
             n.type === 'error' ? <AlertCircle className="w-4 h-4" /> :
             <Info className="w-4 h-4" />}
            {n.message}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* WEEK MANAGEMENT — full width, 2 col                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div
        ref={weekSection.ref}
        className={`grid grid-cols-1 xl:grid-cols-2 gap-5 transition-all duration-700 ${weekSection.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      >
        {/* ── Add New Week ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover-lift group relative overflow-hidden">
          {/* Header with auto-week toggle */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm group-hover:shadow-indigo-200 dark:group-hover:shadow-indigo-900/30 transition-shadow">
                <CalendarPlus className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Add New Week</h3>
            </div>

            {/* Auto-week toggle switch */}
            {autoWeekLoading ? (
              <div className="flex items-center gap-1.5 px-2 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
              </div>
            ) : (
              <button
                onClick={handleToggleAutoWeek}
                disabled={autoWeekToggling}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-300 active:scale-95 ${
                  autoWeekEnabled
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={autoWeekEnabled ? 'Auto-week ON — click to disable' : 'Auto-week OFF — click to enable'}
              >
                {autoWeekToggling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : autoWeekEnabled ? (
                  <Zap className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                <span>{autoWeekEnabled ? 'Auto' : 'Manual'}</span>
                {/* Toggle track */}
                <div className={`relative w-8 h-4 rounded-full transition-colors duration-300 ${autoWeekEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300 ${autoWeekEnabled ? 'translate-x-4.5 left-[18px]' : 'left-[2px]'}`} />
                </div>
              </button>
            )}
          </div>

          {/* Manual form (with overlay when auto is on) */}
          <div className="relative">
            <div className={`space-y-3 transition-all duration-300 ${autoWeekEnabled ? 'blur-[2px] opacity-40 pointer-events-none select-none' : ''}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={autoWeekEnabled}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={autoWeekEnabled}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Generated Name</label>
                <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-sm min-h-[36px] flex items-center">
                  {generatedWeekName || <span className="text-gray-400 italic text-xs">Auto-generated from dates</span>}
                </div>
              </div>
              <button
                onClick={handleAddWeek}
                disabled={addingWeek || !startDate || !endDate || autoWeekEnabled}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold text-sm hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-sm hover:shadow-md"
              >
                {addingWeek ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                {addingWeek ? 'Adding...' : '+ Add Week'}
              </button>
            </div>

            {/* Auto-week overlay */}
            {autoWeekEnabled && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 animate-fade-up">
                <div className="relative">
                  {/* Pulsing ring behind icon */}
                  <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="relative p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="mt-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">Auto Week Creation is ON</p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 text-center max-w-[240px] leading-relaxed">
                  A new Mon–Fri week is created automatically every <strong>Tuesday at 12:00 AM</strong>. Manual week creation is deactivated.
                </p>
                {autoWeekEnabledBy && (
                  <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                    Enabled by {autoWeekEnabledBy}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Active Weeks ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover-lift">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-sm">
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Active Weeks</h3>
            <span className="ml-auto text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-0.5 rounded-full">
              {weeks.length}
            </span>
          </div>

          {weeksLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : weeks.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">No active weeks found</p>
          ) : (
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
              {weeks.map((w, i) => (
                <div
                  key={w.id}
                  className={`flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all duration-200 group/week ${weekSection.isInView ? 'animate-fade-up' : 'opacity-0'}`}
                  style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{w.sheet_name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {formatDate(w.week_start)} → {formatDate(w.week_end)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteWeek(w.id, w.sheet_name)}
                    disabled={deletingWeekId === w.id}
                    className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover/week:opacity-100 disabled:opacity-50"
                    title="Delete week"
                  >
                    {deletingWeekId === w.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUBMISSION DEADLINE                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 transition-all duration-500">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-sm">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Submission Deadline</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Set the deadline for daily metric submissions — users see this on the Submit form</p>
            </div>
          </div>
          <button
            onClick={handleSaveDeadline}
            disabled={savingDeadline || deadlineLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg font-semibold text-sm hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-sm hover:shadow-md"
          >
            {savingDeadline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>

        {deadlineLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-orange-50/50 dark:bg-orange-900/10 rounded-xl p-4 border border-orange-100 dark:border-orange-800/30">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Deadline Text
              </label>
              <input
                type="text"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="e.g. End of Day, 5:00 PM, 3:00 PM EST"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all placeholder:text-gray-400"
              />
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">This will be displayed to users on the Submit Metrics form</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-600/30 flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Current Deadline</p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{deadline || 'Not Set'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TIPS & GUIDELINES                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 transition-all duration-500">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-yellow-500 to-lime-600 rounded-xl shadow-sm">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Tips & Guidelines</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Configure tips shown to users on the Submit Metrics form sidebar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addTip}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Tip
            </button>
            <button
              onClick={handleSaveTips}
              disabled={savingTips || tipsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-lime-600 text-white rounded-lg font-semibold text-sm hover:from-yellow-600 hover:to-lime-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-sm hover:shadow-md"
            >
              {savingTips ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All
            </button>
          </div>
        </div>

        {tipsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
          </div>
        ) : tips.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No tips configured yet</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Click &quot;Add Tip&quot; to create your first tip</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tips.map((tip, index) => (
              <div
                key={tip.id || `new-${index}`}
                className={`bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border ${tip.is_active ? 'border-gray-200 dark:border-gray-600/50' : 'border-dashed border-gray-300 dark:border-gray-600 opacity-60'} transition-all`}
              >
                <div className="flex items-start gap-3">
                  {/* Drag handle + number */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <span className="text-[10px] font-bold text-gray-400">#{index + 1}</span>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 space-y-3">
                    {/* Title + Color + Icon row */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Title</label>
                        <input
                          type="text"
                          value={tip.title}
                          onChange={(e) => updateTip(index, 'title', e.target.value)}
                          placeholder="e.g. OEE Best Practice"
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all placeholder:text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Color</label>
                        <select
                          value={tip.color}
                          onChange={(e) => updateTip(index, 'color', e.target.value)}
                          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                        >
                          {colorOptions.map(c => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Icon</label>
                        <select
                          value={tip.icon}
                          onChange={(e) => updateTip(index, 'icon', e.target.value)}
                          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                        >
                          {iconOptions.map(ic => (
                            <option key={ic} value={ic}>{ic.charAt(0).toUpperCase() + ic.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Description</label>
                      <input
                        type="text"
                        value={tip.description}
                        onChange={(e) => updateTip(index, 'description', e.target.value)}
                        placeholder="e.g. Target OEE ≥70%. Above 85% is excellent."
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      onClick={() => updateTip(index, 'is_active', !tip.is_active)}
                      className={`p-1.5 rounded-lg transition-all ${tip.is_active ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      title={tip.is_active ? 'Active — click to hide' : 'Hidden — click to show'}
                    >
                      {tip.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => removeTip(index)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all"
                      title="Remove tip"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Preview chip */}
                {tip.title && tip.description && (
                  <div className={`mt-3 flex items-start space-x-2.5 px-3 py-2 bg-${tip.color}-50 dark:bg-${tip.color}-900/20 rounded-lg border border-${tip.color}-200 dark:border-${tip.color}-700`}>
                    <div className={`w-5 h-5 bg-${tip.color}-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Lightbulb className="w-2.5 h-2.5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-gray-900 dark:text-gray-100">{tip.title}</h4>
                      <p className="text-[10px] text-gray-600 dark:text-gray-400">{tip.description}</p>
                    </div>
                    {!tip.is_active && (
                      <span className="ml-auto text-[9px] font-bold text-gray-400 bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">HIDDEN</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* KPI TARGETS (left) + HISTORY (right) — side by side                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_400px] gap-5">

        {/* ── LEFT: KPI Performance Targets ────────────────────────────────── */}
        <div
          ref={kpiSection.ref}
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 transition-all duration-700 ${kpiSection.isInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'}`}
        >
          {/* Header + Save */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">KPI Performance Targets</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Configure thresholds — dashboard applies color formatting automatically</p>
              </div>
            </div>
            <button
              onClick={handleSaveTargets}
              disabled={savingTargets || targetsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold text-sm hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-sm hover:shadow-md"
            >
              {savingTargets ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All
            </button>
          </div>

          {/* Color info banner */}
          <div className="mb-4 p-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/60 dark:border-amber-700/40 rounded-lg">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Values meeting targets → <span className="font-bold text-emerald-600">GREEN</span> &nbsp;|&nbsp; Below targets → <span className="font-bold text-red-600">RED</span> &nbsp;|&nbsp; Waste: lower is better
              </p>
            </div>
          </div>

          {targetsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── OEE Targets ────────────────────────────────────────────── */}
              <div className={`bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 hover-lift ${kpiSection.isInView ? 'animate-fade-up stagger-1' : 'opacity-0'}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                    <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">OEE Targets</h4>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Overall Equipment Effectiveness</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['die_cut_1', 'die_cut_2', 'total'] as const).map((key) => (
                    <div key={key} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/30 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                        {key === 'die_cut_1' ? 'Die Cut 1' : key === 'die_cut_2' ? 'Die Cut 2' : 'Total OEE'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={oee[key]}
                          onChange={(e) => setOee(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 pr-9 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">%</span>
                      </div>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1">&ge; value → GREEN</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Volume Targets ──────────────────────────────────────────── */}
              <div className={`bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800/30 hover-lift ${kpiSection.isInView ? 'animate-fade-up stagger-2' : 'opacity-0'}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                    <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">Volume Targets</h4>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Production output (lbs)</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: 'die_cut_1' as const, label: 'DC1 (shift)' },
                    { key: 'die_cut_2' as const, label: 'DC2 (shift)' },
                    { key: 'total' as const, label: 'Total (both)' },
                  ]).map(({ key, label }) => (
                    <div key={key} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-emerald-200/50 dark:border-emerald-700/30 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors">
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={volume[key]}
                          onChange={(e) => setVolume(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-semibold">lbs</span>
                      </div>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1">&ge; value → GREEN</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Waste Targets ───────────────────────────────────────────── */}
              <div className={`bg-red-50/50 dark:bg-red-900/10 rounded-xl p-4 border border-red-100 dark:border-red-800/30 hover-lift ${kpiSection.isInView ? 'animate-fade-up stagger-3' : 'opacity-0'}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-1.5 bg-red-100 dark:bg-red-900/40 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">Waste Targets</h4>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Material waste % (lower is better)</p>
                  </div>
                </div>

                {/* Waste info */}
                <div className="mb-3 p-2 bg-orange-50/80 dark:bg-orange-900/15 border border-orange-200/60 dark:border-orange-700/30 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 text-orange-500 flex-shrink-0" />
                    <p className="text-[10px] text-orange-700 dark:text-orange-400">
                      &le; target → <span className="font-bold text-emerald-600">GREEN</span> &nbsp;|&nbsp; &gt; target → <span className="font-bold text-red-600">RED</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: 'die_cut_1' as const, label: 'Die Cut 1' },
                    { key: 'die_cut_2' as const, label: 'Die Cut 2' },
                    { key: 'total' as const, label: 'Total Waste' },
                  ]).map(({ key, label }) => (
                    <div key={key} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-red-200/50 dark:border-red-700/30 hover:border-red-300 dark:hover:border-red-600 transition-colors">
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={waste[key]}
                          onChange={(e) => setWaste(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 pr-9 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">%</span>
                      </div>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1">&le; value → GREEN</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Target Update History ──────────────────────────────────── */}
        <div
          ref={historySection.ref}
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 transition-all duration-700 ${historySection.isInView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-br from-gray-600 to-gray-800 dark:from-gray-500 dark:to-gray-700 rounded-lg shadow-sm">
                <History className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Update History</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Recent KPI target changes</p>
              </div>
            </div>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No history records</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {history.map((h, i) => {
                const Icon = getMetricIcon(h.metric_type);
                const isIncrease = h.old_value !== null && h.new_value > h.old_value;
                return (
                  <div
                    key={h.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border-l-[3px] ${getMetricBorderColor(h.metric_type)} bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-all duration-200 group/hist ${historySection.isInView ? 'animate-fade-up' : 'opacity-0'}`}
                    style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}
                  >
                    <div className={`p-1.5 rounded-lg ${getMetricTypeColor(h.metric_type)} transition-transform group-hover/hist:scale-110`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {getMetricLabel(h.metric_type, h.metric_name)}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {h.old_value != null ? `${h.old_value}${h.metric_type === 'volume' ? '' : '%'}` : 'N/A'}
                        </span>
                        <ArrowRight className={`w-2.5 h-2.5 ${isIncrease ? 'text-emerald-500' : 'text-red-400'}`} />
                        <span className={`text-[10px] font-bold ${isIncrease ? 'text-emerald-600' : 'text-red-500'}`}>
                          {h.new_value}{h.metric_type === 'volume' ? ' lbs' : '%'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{h.changed_by || 'Unknown'}</p>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500">{formatDateTime(h.changed_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
