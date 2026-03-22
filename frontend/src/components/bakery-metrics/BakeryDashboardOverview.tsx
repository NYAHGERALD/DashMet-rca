'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '@/lib/api';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart, ReferenceLine, LabelList, Area,
} from 'recharts';
import {
  Activity,
  Sun, Moon, RefreshCw,
  Loader2, Award, AlertTriangle, Calendar,
  X, Info,
} from 'lucide-react';
import BakeryPeriodOeeChart from './BakeryPeriodOeeChart';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
interface ChartMetrics {
  week: string;
  oee: number[];
  waste: number[];
  oeeAvg: number;
  wasteAvg: number;
  oeeFirstShift: number[];
  wasteFirstShift: number[];
  oeeSecondShift: number[];
  wasteSecondShift: number[];
  downtimeRatio: number;
  productionRate: number;
  totalProduction: number;
}

interface DashboardKpis {
  currentWeek: string;
  avgOEE: number;
  avgWaste: number;
  totalWaste: number;
  downtimeRatio: number;
  productionRate: number;
  uptimeValue: number;
  totalProduction: number;
  targets: { oee: number; waste: number; uptime: number };
  trends: {
    oee: { value: number; direction: string };
    waste: { value: number; direction: string };
    downtime: { value: number; direction: string };
    production: { value: number; direction: string };
  };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION CSS
// ═══════════════════════════════════════════════════════════════════════════════
const ANIMATION_STYLES = `
@keyframes dashFadeIn { from { opacity:0; transform:translateY(18px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
@keyframes dashPulseGlow { 0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,0.18); } 50% { box-shadow:0 0 18px 4px rgba(59,130,246,0.13); } }
.dash-section { animation: dashFadeIn 0.6s cubic-bezier(.22,1,.36,1) both; }
.dash-section-1 { animation-delay: 0.15s; }
.dash-section-2 { animation-delay: 0.3s; }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// STATS HELPER (non-zero only)
// ═══════════════════════════════════════════════════════════════════════════════
function computeStats(arr: number[], dayLabels: string[]) {
  const entries = arr.map((v, i) => ({ value: v, day: dayLabels[i] })).filter(e => e.value > 0);
  if (!entries.length) return { avg: 0, best: { value: 0, day: 'N/A' }, worst: { value: 0, day: 'N/A' }, count: 0 };
  const avg = Math.round((entries.reduce((s, e) => s + e.value, 0) / entries.length) * 10) / 10;
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  return { avg, best: sorted[0], worst: sorted[sorted.length - 1], count: entries.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM TOOLTIP
// ═══════════════════════════════════════════════════════════════════════════════
const ChartTooltip = ({ active, payload, label, metric, target, unit, higherIsBetter }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  const met = higherIsBetter ? val >= target : (val <= target && val > 0);
  const diff = Math.round(Math.abs(val - target) * 100) / 100;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[170px]" style={{ backdropFilter: 'blur(8px)' }}>
      <p className="text-xs font-bold text-gray-900 dark:text-white mb-1.5 flex items-center gap-1.5">
        <Calendar className="w-3 h-3 text-blue-500" /> {label}
      </p>
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${val === 0 ? 'bg-gray-300' : met ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{metric}: {val}{unit}</span>
      </div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Target: {target}{unit}</p>
      {val > 0 && (
        <p className={`text-[10px] font-semibold ${met ? 'text-green-600' : 'text-red-500'}`}>
          {met ? '✓' : '✗'} {met ? 'Target met' : 'Below target'} ({diff}{unit} {higherIsBetter ? (met ? 'above' : 'below') : (met ? 'below' : 'above')})
        </p>
      )}
      {val === 0 && <p className="text-[10px] text-gray-400 italic">No data submitted</p>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function BakeryDashboardOverview() {
  const [chartMetrics, setChartMetrics] = useState<ChartMetrics | null>(null);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewTab, setViewTab] = useState<'weekly' | 'range'>('weekly');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [committedStart, setCommittedStart] = useState('');
  const [committedEnd, setCommittedEnd] = useState('');
  const [errorModal, setErrorModal] = useState<{ show: boolean; title: string; message: string }>({
    show: false, title: '', message: '',
  });
  const [availableWeeks, setAvailableWeeks] = useState<{ sheetName: string; weekStart: string; weekEnd: string }[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('latest');
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const weekDropdownRef = useRef<HTMLDivElement>(null);

  /** Count weekdays (Mon–Fri) between two dates, inclusive */
  const countWeekdays = useCallback((start: Date, end: Date): number => {
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }, []);

  const MAX_WEEKDAYS = 108;

  const handleRangeSubmit = useCallback(() => {
    if (!rangeStart || !rangeEnd) {
      setErrorModal({ show: true, title: 'Missing Dates', message: 'Please select both a start and end date.' });
      return;
    }
    const s = new Date(rangeStart + 'T00:00:00');
    const e = new Date(rangeEnd + 'T00:00:00');
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      setErrorModal({ show: true, title: 'Invalid Date', message: 'Invalid date format.' });
      return;
    }
    if (e <= s) {
      setErrorModal({ show: true, title: 'Invalid Range', message: 'End date must be after start date.' });
      return;
    }
    // Enforce full-week alignment: start must be Monday (1), end must be Friday (5)
    const startDay = s.getDay(); // 0=Sun .. 6=Sat
    const endDay = e.getDay();
    if (startDay !== 1) {
      setErrorModal({
        show: true,
        title: 'Start Date Must Be a Monday',
        message: `Your start date (${rangeStart}) falls on a ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][startDay]}. The range must start on a Monday to align with full business weeks (Mon\u2013Fri). Please move your start date to the nearest Monday.`,
      });
      return;
    }
    if (endDay !== 5) {
      setErrorModal({
        show: true,
        title: 'End Date Must Be a Friday',
        message: `Your end date (${rangeEnd}) falls on a ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][endDay]}. The range must end on a Friday to align with full business weeks (Mon\u2013Fri). Please move your end date to the nearest Friday.`,
      });
      return;
    }
    const wd = countWeekdays(s, e);
    if (wd > MAX_WEEKDAYS) {
      setErrorModal({
        show: true,
        title: 'Range Too Long',
        message: `Your range spans ${wd} business days (${Math.ceil(wd / 5)} weeks). Max is 5 months (108 weekdays). Please shorten the range.`,
      });
      return;
    }
    setCommittedStart(rangeStart);
    setCommittedEnd(rangeEnd);
    setViewTab('range');
  }, [rangeStart, rangeEnd, countWeekdays]);

  const handleWeeklyClick = useCallback(() => {
    setViewTab('weekly');
  }, []);

  const handleClearRange = useCallback(() => {
    setRangeStart('');
    setRangeEnd('');
    setCommittedStart('');
    setCommittedEnd('');
    setViewTab('weekly');
  }, []);

  const loadData = useCallback(async (week: string = 'latest') => {
    try {
      const [chartRes, kpiRes] = await Promise.all([
        api.get(`/bakery-metrics/weekly-chart-metrics?week=${encodeURIComponent(week)}`),
        api.get('/bakery-metrics/dashboard-kpis'),
      ]);
      if (chartRes.data.success) setChartMetrics(chartRes.data);
      if (kpiRes.data.success) setKpis(kpiRes.data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch available weeks on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/bakery-metrics/weekly-sheets');
        if (res.data.success && res.data.sheets) {
          setAvailableWeeks(res.data.sheets);
        }
      } catch (err) {
        console.error('Error fetching available weeks:', err);
      }
    })();
  }, []);

  useEffect(() => { loadData(selectedWeek); }, [loadData, selectedWeek]);

  const handleWeekSelect = (weekName: string) => {
    setSelectedWeek(weekName);
    setWeekDropdownOpen(false);
    setRefreshing(true);
    setViewTab('weekly');
  };

  // Close week dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(e.target as Node)) {
        setWeekDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRefresh = () => { setRefreshing(true); loadData(selectedWeek); };

  // ─── ALL VALUES FROM API (no hardcoded fallbacks) ──────────────────────────
  const oeeTarget = kpis?.targets?.oee ?? 0;
  const wasteTarget = kpis?.targets?.waste ?? 0;
  const weekLabel = chartMetrics?.week || kpis?.currentWeek || '';

  // Format week "03-16-2026_03-20-2026" → "Mar 16 – Mar 20, 2026"
  const formattedWeek = useMemo(() => {
    if (!weekLabel) return '';
    const parts = weekLabel.split('_');
    if (parts.length !== 2) return weekLabel;
    const fmt = (d: string) => {
      const [m, day, y] = d.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[parseInt(m) - 1]} ${parseInt(day)}`;
    };
    const [, , y] = parts[1].split('-');
    return `${fmt(parts[0])} – ${fmt(parts[1])}, ${y}`;
  }, [weekLabel]);

  // ─── LOADING STATE ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin relative" />
        </div>
        <p className="text-gray-500 font-medium animate-pulse">Loading dashboard metrics...</p>
      </div>
    );
  }

  // ─── BUILD CHART DATA ─────────────────────────────────────────────────────
  const combinedChartData = DAYS.map((day, i) => ({
    day: day.slice(0, 3),
    dayFull: day,
    oee: chartMetrics?.oee[i] ?? 0,
    waste: chartMetrics?.waste[i] ?? 0,
    oeeTarget,
    wasteTarget,
  }));

  const firstShiftChartData = DAYS.map((day, i) => ({
    day: day.slice(0, 3),
    dayFull: day,
    oee: chartMetrics?.oeeFirstShift[i] ?? 0,
    waste: chartMetrics?.wasteFirstShift[i] ?? 0,
  }));

  const secondShiftChartData = DAYS.map((day, i) => ({
    day: day.slice(0, 3),
    dayFull: day,
    oee: chartMetrics?.oeeSecondShift[i] ?? 0,
    waste: chartMetrics?.wasteSecondShift[i] ?? 0,
  }));

  // ─── STATS FOR RIBBONS ─────────────────────────────────────────────────────
  const oeeStats = computeStats(chartMetrics?.oee ?? [], DAYS);
  const wasteStats = computeStats(chartMetrics?.waste ?? [], DAYS);
  const oee1Stats = computeStats(chartMetrics?.oeeFirstShift ?? [], DAYS);
  const waste1Stats = computeStats(chartMetrics?.wasteFirstShift ?? [], DAYS);
  const oee2Stats = computeStats(chartMetrics?.oeeSecondShift ?? [], DAYS);
  const waste2Stats = computeStats(chartMetrics?.wasteSecondShift ?? [], DAYS);

  // ─── BAR COLOR ─────────────────────────────────────────────────────────
  const getBarColor = (value: number, target: number, higherIsBetter: boolean) => {
    if (value === 0) return '#d1d5db';
    if (higherIsBetter) return value >= target ? '#22c55e' : '#ef4444';
    return value <= target ? '#22c55e' : '#ef4444';
  };

  // ─── ANIMATED BAR SHAPES (gradients + staggered SVG animate) ──────────
  const OeeBar = (props: any) => {
    const { x, y, width, height, payload, index } = props;
    const fill = getBarColor(payload.oee, oeeTarget, true);
    return (
      <g>
        <defs>
          <linearGradient id={`oeeGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity={1} />
            <stop offset="100%" stopColor={fill} stopOpacity={0.65} />
          </linearGradient>
        </defs>
        <rect x={x} y={y} width={width} height={height} rx={5} ry={5}
          fill={`url(#oeeGrad-${index})`}
          style={{ filter: payload.oee > 0 ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : 'none' }}
        >
          <animate attributeName="height" from="0" to={height} dur="0.8s" begin={`${(index ?? 0) * 0.1}s`} fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" />
          <animate attributeName="y" from={y + height} to={y} dur="0.8s" begin={`${(index ?? 0) * 0.1}s`} fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" />
        </rect>
      </g>
    );
  };

  const WasteBar = (props: any) => {
    const { x, y, width, height, payload, index } = props;
    const fill = getBarColor(payload.waste, wasteTarget, false);
    return (
      <g>
        <defs>
          <linearGradient id={`wasteGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity={1} />
            <stop offset="100%" stopColor={fill} stopOpacity={0.65} />
          </linearGradient>
        </defs>
        <rect x={x} y={y} width={width} height={height} rx={5} ry={5}
          fill={`url(#wasteGrad-${index})`}
          style={{ filter: payload.waste > 0 ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : 'none' }}
        >
          <animate attributeName="height" from="0" to={height} dur="0.8s" begin={`${(index ?? 0) * 0.1}s`} fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" />
          <animate attributeName="y" from={y + height} to={y} dur="0.8s" begin={`${(index ?? 0) * 0.1}s`} fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" />
        </rect>
      </g>
    );
  };

  // Shift-level bar shapes
  const shiftOeeBar = (props: any) => {
    const { x, y, width, height, payload, index } = props;
    const fill = getBarColor(payload.oee, oeeTarget, true);
    return (
      <rect x={x} y={y} width={width} height={height} rx={3} fill={fill}
        style={{ filter: payload.oee > 0 ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' : 'none' }}>
        <animate attributeName="height" from="0" to={height} dur="0.7s" begin={`${(index ?? 0) * 0.08}s`} fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" />
        <animate attributeName="y" from={y + height} to={y} dur="0.7s" begin={`${(index ?? 0) * 0.08}s`} fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" />
      </rect>
    );
  };

  const shiftWasteBar = (props: any) => {
    const { x, y, width, height, payload, index } = props;
    const fill = getBarColor(payload.waste, wasteTarget, false);
    return (
      <rect x={x} y={y} width={width} height={height} rx={3} fill={fill}
        style={{ filter: payload.waste > 0 ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' : 'none' }}>
        <animate attributeName="height" from="0" to={height} dur="0.7s" begin={`${(index ?? 0) * 0.08}s`} fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" />
        <animate attributeName="y" from={y + height} to={y} dur="0.7s" begin={`${(index ?? 0) * 0.08}s`} fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" />
      </rect>
    );
  };

  // ─── REFERENCE LINE LABEL ─────────────────────────────────────────────
  const TargetLabel = ({ value, viewBox, color }: any) => (
    <text x={(viewBox?.x ?? 0) + 4} y={(viewBox?.y ?? 0) - 4} fill={color || '#6366f1'} fontSize={10} fontWeight={700}>
      Target: {value}%
    </text>
  );

  // ─── STATS RIBBON ─────────────────────────────────────────────────────
  const StatsRibbon = ({ stats, metric, unit, higherIsBetter }: { stats: ReturnType<typeof computeStats>; metric: string; unit: string; higherIsBetter: boolean }) => {
    if (stats.count === 0) return null;
    // For waste (higherIsBetter=false): lowest value = best, highest value = worst
    const bestEntry = higherIsBetter ? stats.best : stats.worst;
    const worstEntry = higherIsBetter ? stats.worst : stats.best;
    // Did the worst entry meet the target?
    const worstMetTarget = higherIsBetter
      ? worstEntry.value >= oeeTarget
      : worstEntry.value <= wasteTarget;
    const worstLabel = worstMetTarget ? 'Low' : 'Worse';
    const worstBg = worstMetTarget ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20';
    const worstText = worstMetTarget ? 'text-blue-600 dark:text-blue-300' : 'text-red-600 dark:text-red-300';
    const worstIcon = worstMetTarget
      ? <Activity className="w-3 h-3 text-blue-500" />
      : <AlertTriangle className="w-3 h-3 text-red-400" />;
    // Avg meets target?
    const avgMetTarget = higherIsBetter
      ? stats.avg >= oeeTarget
      : (stats.avg <= wasteTarget && stats.avg > 0);
    const avgBg = avgMetTarget ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20';
    const avgText = avgMetTarget ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300';
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px]">
        <span className={`flex items-center gap-1 px-2 py-0.5 ${avgBg} ${avgText} rounded-full font-semibold`}>
          Avg: {stats.avg}{unit}
        </span>
        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full font-semibold">
          <Award className="w-3 h-3 text-green-500" /> Best: {bestEntry.day} ({bestEntry.value}{unit})
        </span>
        <span className={`flex items-center gap-1 px-2 py-0.5 ${worstBg} ${worstText} rounded-full font-semibold`}>
          {worstIcon} {worstLabel}: {worstEntry.day} ({worstEntry.value}{unit})
        </span>
        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
          {stats.count}/5 days
        </span>
      </div>
    );
  };





  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{ANIMATION_STYLES}</style>

      {/* ─── ERROR MODAL ──────────────────────────────────────────────────── */}
      {errorModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ animation: 'dashFadeIn 0.25s ease-out both' }}
          onClick={() => setErrorModal(prev => ({ ...prev, show: false }))}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/50 p-6 max-w-md w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{errorModal.title}</h3>
              </div>
              <button onClick={() => setErrorModal(prev => ({ ...prev, show: false }))}
                title="Close" className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">{errorModal.message}</p>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-5 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                  <p className="font-semibold">Valid range tips:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                    <li>Start date must be a <strong>Monday</strong></li>
                    <li>End date must be a <strong>Friday</strong></li>
                    <li>Each week = full Mon–Fri (no partial weeks)</li>
                    <li>Maximum <strong>5 months</strong> (~108 weekdays)</li>
                    <li>Sat &amp; Sun are <strong>not counted</strong></li>
                  </ul>
                </div>
              </div>
            </div>
            <button onClick={() => setErrorModal(prev => ({ ...prev, show: false }))}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-[0.98] shadow-md shadow-blue-500/20">
              Got It
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">

        {/* ─── PERFORMANCE OVERVIEW (Combined Charts) ─────────────────────── */}
        <div className="dash-section dash-section-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Performance Overview</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Weekly OEE and Waste performance across both shifts</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Weekly Chart button */}
              <button
                onClick={handleWeeklyClick}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                  viewTab === 'weekly'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                Weekly Chart
              </button>

              {/* Range submit button */}
              <button
                onClick={handleRangeSubmit}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                  viewTab === 'range'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                Period Range
              </button>

              {/* Compact date inputs — only for range tab */}
              <input
                type="date"
                value={rangeStart}
                onChange={e => setRangeStart(e.target.value)}
                title="Range start date"
                className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all w-[130px]"
              />
              <span className="text-xs text-gray-400">–</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={e => setRangeEnd(e.target.value)}
                title="Range end date"
                className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all w-[130px]"
              />

              {/* Clear range (X) — shown when in range view */}
              {viewTab === 'range' && (
                <button
                  onClick={handleClearRange}
                  title="Clear range and go back to weekly"
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Week dropdown + refresh — only in weekly view */}
              {viewTab === 'weekly' && (
                <div className="flex items-center gap-2">
                  <div className="relative" ref={weekDropdownRef}>
                    <button
                      onClick={() => setWeekDropdownOpen(!weekDropdownOpen)}
                      title="Select a week to view"
                      className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 hover:border-blue-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer min-w-[210px]"
                    >
                      <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="truncate">
                        {selectedWeek === 'latest' ? (formattedWeek || 'Current Week') : (() => {
                          const parts = selectedWeek.split('_');
                          if (parts.length !== 2) return selectedWeek;
                          const fmt = (d: string) => { const [m, day] = d.split('-'); const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[parseInt(m)-1]} ${parseInt(day)}`; };
                          const [,,y] = parts[1].split('-');
                          return `${fmt(parts[0])} \u2013 ${fmt(parts[1])}, ${y}`;
                        })()}
                      </span>
                      <svg className={`w-3 h-3 ml-auto flex-shrink-0 transition-transform ${weekDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {weekDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-[240px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="max-h-[280px] overflow-y-auto">
                          <button
                            onClick={() => handleWeekSelect('latest')}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                              selectedWeek === 'latest'
                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            Current Week {formattedWeek ? `(${formattedWeek})` : ''}
                          </button>
                          {availableWeeks.map((w) => {
                            const parts = w.sheetName.split('_');
                            if (parts.length !== 2) return null;
                            const fmt = (d: string) => { const [m, day] = d.split('-'); const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[parseInt(m)-1]} ${parseInt(day)}`; };
                            const [,,y] = parts[1].split('-');
                            const label = `${fmt(parts[0])} \u2013 ${fmt(parts[1])}, ${y}`;
                            const isSelected = selectedWeek === w.sheetName;
                            return (
                              <button
                                key={w.sheetName}
                                onClick={() => handleWeekSelect(w.sheetName)}
                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors border-t border-gray-100 dark:border-gray-700/50 ${
                                  isSelected
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    title="Refresh data"
                    className="inline-flex items-center gap-1.5 p-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-95 disabled:opacity-60 shadow-md shadow-blue-500/20"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {viewTab === 'weekly' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
            {/* Combined OEE Chart */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
              <ResponsiveContainer width="100%" height={290}>
                <ComposedChart data={combinedChartData} margin={{ top: 25, right: 15, left: -5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="oeeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} />
                  <YAxis domain={[0, 120]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip content={<ChartTooltip metric="OEE" target={oeeTarget} unit="%" higherIsBetter={true} />} />
                  <Legend formatter={(v: string) => v === 'oee' ? 'OEE (%)' : 'Performance Trend'} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={oeeTarget} stroke="#6366f1" strokeDasharray="6 4" strokeWidth={1.5} label={<TargetLabel value={oeeTarget} color="#6366f1" />} />
                  <Area dataKey="oee" name="trend" type="monotone" fill="url(#oeeAreaGrad)" stroke="transparent" />
                  <Bar dataKey="oee" shape={<OeeBar />} barSize={42} animationDuration={1200} animationEasing="ease-out">
                    <LabelList dataKey="oee" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#1f2937' }} />
                  </Bar>
                  <Line dataKey="oee" name="trend" type="monotone" stroke="#f97316" strokeWidth={2.5}
                    dot={{ r: 5, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7, stroke: '#f97316', strokeWidth: 2, fill: '#fff' }}
                    animationDuration={1600} animationEasing="ease-in-out"
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <StatsRibbon stats={oeeStats} metric="OEE" unit="%" higherIsBetter={true} />
            </div>

            {/* Combined Waste Chart */}
            <div className="bg-orange-50/30 dark:bg-orange-900/10 rounded-lg p-3 border border-orange-100 dark:border-orange-900/30">
              <ResponsiveContainer width="100%" height={290}>
                <ComposedChart data={combinedChartData} margin={{ top: 25, right: 15, left: -5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="wasteAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} />
                  <YAxis domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.4), 5)]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip content={<ChartTooltip metric="Waste" target={wasteTarget} unit="%" higherIsBetter={false} />} />
                  <Legend formatter={(v: string) => v === 'waste' ? 'Waste (%)' : 'Performance Trend'} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={wasteTarget} stroke="#6366f1" strokeDasharray="6 4" strokeWidth={1.5} label={<TargetLabel value={wasteTarget} color="#6366f1" />} />
                  <Area dataKey="waste" name="trend" type="monotone" fill="url(#wasteAreaGrad)" stroke="transparent" />
                  <Bar dataKey="waste" shape={<WasteBar />} barSize={42} animationDuration={1200} animationEasing="ease-out">
                    <LabelList dataKey="waste" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#1f2937' }} />
                  </Bar>
                  <Line dataKey="waste" name="trend" type="monotone" stroke="#f97316" strokeWidth={2.5}
                    dot={{ r: 5, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7, stroke: '#f97316', strokeWidth: 2, fill: '#fff' }}
                    animationDuration={1600} animationEasing="ease-in-out"
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <StatsRibbon stats={wasteStats} metric="Waste" unit="%" higherIsBetter={false} />
            </div>
          </div>
          )}

          {viewTab === 'range' && committedStart && committedEnd && (
            <div className="mt-3">
              <BakeryPeriodOeeChart startDate={committedStart} endDate={committedEnd} />
            </div>
          )}

        </div>

        {/* ─── SHIFT PERFORMANCE ──────────────────────────────────────────── */}
        {viewTab === 'weekly' && (
        <div className="dash-section dash-section-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* First Shift */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg">
                <Sun className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">First Shift Performance</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{formattedWeek || 'Current week'} operational metrics</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* 1st Shift OEE */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 border border-gray-100 dark:border-gray-700">
                <ResponsiveContainer width="100%" height={190}>
                  <ComposedChart data={firstShiftChartData} margin={{ top: 18, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#6b7280' }} />
                    <YAxis domain={[0, 120]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: '#6b7280' }} />
                    <Tooltip content={<ChartTooltip metric="OEE" target={oeeTarget} unit="%" higherIsBetter={true} />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 9 }} formatter={() => 'OEE (1st Shift)'} />
                    <ReferenceLine y={oeeTarget} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1} />
                    <Bar dataKey="oee" barSize={24} shape={shiftOeeBar} animationDuration={1000} animationEasing="ease-out">
                      <LabelList dataKey="oee" position="top" style={{ fontSize: 8, fontWeight: 700, fill: '#374151' }} />
                    </Bar>
                    <Line dataKey="oee" type="monotone" stroke="#f97316" strokeWidth={1.5}
                      dot={{ r: 3, fill: '#f97316', stroke: '#fff', strokeWidth: 1 }}
                      animationDuration={1400} animationEasing="ease-in-out"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <StatsRibbon stats={oee1Stats} metric="OEE" unit="%" higherIsBetter={true} />
              </div>
              {/* 1st Shift Waste */}
              <div className="bg-red-50/30 dark:bg-red-900/10 rounded-lg p-2 border border-red-100 dark:border-red-900/20">
                <ResponsiveContainer width="100%" height={190}>
                  <ComposedChart data={firstShiftChartData} margin={{ top: 18, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#6b7280' }} />
                    <YAxis domain={[0, (dm: number) => Math.max(Math.ceil(dm * 1.4), 5)]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: '#6b7280' }} />
                    <Tooltip content={<ChartTooltip metric="Waste" target={wasteTarget} unit="%" higherIsBetter={false} />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 9 }} formatter={() => 'Waste (1st Shift)'} />
                    <ReferenceLine y={wasteTarget} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1} />
                    <Bar dataKey="waste" barSize={24} shape={shiftWasteBar} animationDuration={1000} animationEasing="ease-out">
                      <LabelList dataKey="waste" position="top" style={{ fontSize: 8, fontWeight: 700, fill: '#374151' }} />
                    </Bar>
                    <Line dataKey="waste" type="monotone" stroke="#f97316" strokeWidth={1.5}
                      dot={{ r: 3, fill: '#f97316', stroke: '#fff', strokeWidth: 1 }}
                      animationDuration={1400} animationEasing="ease-in-out"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <StatsRibbon stats={waste1Stats} metric="Waste" unit="%" higherIsBetter={false} />
              </div>
            </div>
          </div>

          {/* Second Shift */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <Moon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Second Shift Performance</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{formattedWeek || 'Current week'} operational metrics</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* 2nd Shift OEE */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 border border-gray-100 dark:border-gray-700">
                <ResponsiveContainer width="100%" height={190}>
                  <ComposedChart data={secondShiftChartData} margin={{ top: 18, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#6b7280' }} />
                    <YAxis domain={[0, 120]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: '#6b7280' }} />
                    <Tooltip content={<ChartTooltip metric="OEE" target={oeeTarget} unit="%" higherIsBetter={true} />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 9 }} formatter={() => 'OEE (2nd Shift)'} />
                    <ReferenceLine y={oeeTarget} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1} />
                    <Bar dataKey="oee" barSize={24} shape={shiftOeeBar} animationDuration={1000} animationEasing="ease-out">
                      <LabelList dataKey="oee" position="top" style={{ fontSize: 8, fontWeight: 700, fill: '#374151' }} />
                    </Bar>
                    <Line dataKey="oee" type="monotone" stroke="#f97316" strokeWidth={1.5}
                      dot={{ r: 3, fill: '#f97316', stroke: '#fff', strokeWidth: 1 }}
                      animationDuration={1400} animationEasing="ease-in-out"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <StatsRibbon stats={oee2Stats} metric="OEE" unit="%" higherIsBetter={true} />
              </div>
              {/* 2nd Shift Waste */}
              <div className="bg-green-50/30 dark:bg-green-900/10 rounded-lg p-2 border border-green-100 dark:border-green-900/20">
                <ResponsiveContainer width="100%" height={190}>
                  <ComposedChart data={secondShiftChartData} margin={{ top: 18, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#6b7280' }} />
                    <YAxis domain={[0, (dm: number) => Math.max(Math.ceil(dm * 1.4), 5)]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: '#6b7280' }} />
                    <Tooltip content={<ChartTooltip metric="Waste" target={wasteTarget} unit="%" higherIsBetter={false} />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 9 }} formatter={() => 'Waste (2nd Shift)'} />
                    <ReferenceLine y={wasteTarget} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1} />
                    <Bar dataKey="waste" barSize={24} shape={shiftWasteBar} animationDuration={1000} animationEasing="ease-out">
                      <LabelList dataKey="waste" position="top" style={{ fontSize: 8, fontWeight: 700, fill: '#374151' }} />
                    </Bar>
                    <Line dataKey="waste" type="monotone" stroke="#f97316" strokeWidth={1.5}
                      dot={{ r: 3, fill: '#f97316', stroke: '#fff', strokeWidth: 1 }}
                      animationDuration={1400} animationEasing="ease-in-out"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <StatsRibbon stats={waste2Stats} metric="Waste" unit="%" higherIsBetter={false} />
              </div>
            </div>
          </div>
        </div>
        )}

      </div>
    </>
  );
}
