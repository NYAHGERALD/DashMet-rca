'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api, { apiWithExtendedTimeout } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
  ComposedChart,
} from 'recharts';
import {
  FileText,
  Calendar,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Gauge,
  Wrench,
  Clock,
  ChevronDown,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Zap,
  Award,
  Factory,
  FileBarChart,
  Shield,
  Users,
  Settings,
  PackageCheck,
  RefreshCw,
  Database,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExecutiveSummary {
  opening: string;
  keyMetrics: string;
  issueHighlight: string;
  outlook: string;
}

interface DieCutOee {
  firstShift: number | null;
  secondShift: number | null;
  combined: number | null;
  assessment: string;
}

interface OeeAnalysis {
  overallStatus: string;
  narrative: string;
  dieCut1: DieCutOee;
  dieCut2: DieCutOee;
  overall: { firstShift: number | null; secondShift: number | null; combined: number | null };
  target: number;
  gapAnalysis: string;
}

interface WasteShift { wastePct: number; wasteLbs: number; }

interface WasteMachine {
  firstShift: WasteShift;
  secondShift: WasteShift;
  combined: WasteShift;
  assessment: string;
  // Fallback flat fields from older response format
  wastePct?: number;
  wasteLbs?: number;
}

interface WasteAnalysis {
  overallStatus: string;
  narrative: string;
  dieCut1: WasteMachine;
  dieCut2: WasteMachine;
  totalWasteLbs: number;
  totalWastePct: number;
  target: number;
}

interface ProductionMachine { firstShift: number; secondShift: number; total: number; }

interface ProductionOutput {
  narrative: string;
  totalPounds: number;
  dieCut1: ProductionMachine;
  dieCut2: ProductionMachine;
  previousDayTotal: number | null;
  dayOverDayChange: string;
  comparisonToPreviousDay: string;
}

interface ShiftDetail {
  oee: number | null;
  production: number;
  wastePct: number;
  strengths: string;
  concerns: string;
}

interface ShiftPerformance {
  narrative: string;
  firstShift: ShiftDetail;
  secondShift: ShiftDetail;
  betterShift: string;
  shiftGap: string;
}

interface CriticalIssue {
  issueNumber: string;
  title: string;
  priority: string;
  status: string;
  equipment: string | null;
  minutesLost: number | null;
  rootCauseAssessment: string;
  productionImpact: string;
  recommendedAction: string;
  timeframe: string;
}

interface IssueAnalysis {
  totalIssuesToday: number;
  carryOverCount: number;
  resolvedCount: number;
  totalMinutesLost: number;
  narrative: string;
  criticalIssues: CriticalIssue[];
  equipmentCorrelation: string;
  downtimeImpact: string;
}

interface ChangeMetric {
  direction: string;
  delta: number | null;
  detail: string;
}

interface PreviousDayComparison {
  narrative: string;
  oeeChange: ChangeMetric;
  wasteChange: ChangeMetric;
  productionChange: ChangeMetric;
}

interface Recommendation {
  priority: string;
  category: string;
  title: string;
  description: string;
  expectedImpact: string;
  owner: string;
  timeframe: string;
}

interface ScoreBreakdown {
  oeeScore: number;
  wasteScore: number;
  productionScore: number;
  issueManagementScore: number;
}

interface OverallAssessment {
  grade: string;
  gradeLabel: string;
  scoreBreakdown: ScoreBreakdown;
  closingStatement: string;
}

interface ReportData {
  reportTitle: string;
  executiveSummary: ExecutiveSummary;
  oeeAnalysis: OeeAnalysis;
  wasteAnalysis: WasteAnalysis;
  productionOutput: ProductionOutput;
  shiftPerformance: ShiftPerformance;
  issueAnalysis: IssueAnalysis;
  previousDayComparison: PreviousDayComparison;
  recommendations: Recommendation[];
  overallAssessment: OverallAssessment;
  _meta?: {
    weekName: string;
    dayOfWeek: string;
    previousDay: string | null;
    generatedAt: string;
    model: string;
    hasMetrics: boolean;
    currentIssueCount: number;
    carryOverIssueCount: number;
  };
  _rawMetrics?: {
    firstShift: any;
    secondShift: any;
    bothShifts: any;
  };
}

interface WeekOption {
  id: string;
  sheet_name: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ─── Colors ──────────────────────────────────────────────────────────────────
const COLORS = {
  shift1: '#2563eb',
  shift2: '#7c3aed',
  success: '#059669',
  warning: '#d97706',
  danger: '#ef4444',
  target: '#ef4444',
  dieCut1: '#2563eb',
  dieCut2: '#f59e0b',
  primary: '#1e40af',
  secondary: '#7c3aed',
};

// ─── Grade helpers ───────────────────────────────────────────────────────────
function gradeColor(grade: string) {
  switch (grade) {
    case 'A': return { bg: 'bg-emerald-500', ring: 'ring-emerald-200' };
    case 'B': return { bg: 'bg-blue-500', ring: 'ring-blue-200' };
    case 'C': return { bg: 'bg-amber-500', ring: 'ring-amber-200' };
    case 'D': return { bg: 'bg-orange-500', ring: 'ring-orange-200' };
    case 'F': return { bg: 'bg-red-500', ring: 'ring-red-200' };
    default: return { bg: 'bg-gray-500', ring: 'ring-gray-200' };
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'on_target': return { label: 'On Target', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', icon: <CheckCircle className="w-3.5 h-3.5" /> };
    case 'below_target': return { label: 'Below Target', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', icon: <AlertTriangle className="w-3.5 h-3.5" /> };
    case 'critical': return { label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', icon: <XCircle className="w-3.5 h-3.5" /> };
    default: return { label: 'N/A', color: 'bg-gray-100 text-gray-600', icon: <Minus className="w-3.5 h-3.5" /> };
  }
}

function changeIndicator(direction: string) {
  if (direction === 'up') return { icon: <ArrowUp className="w-4 h-4" />, color: 'text-emerald-600 dark:text-emerald-400' };
  if (direction === 'down') return { icon: <ArrowDown className="w-4 h-4" />, color: 'text-red-600 dark:text-red-400' };
  return { icon: <Minus className="w-4 h-4" />, color: 'text-gray-500 dark:text-gray-400' };
}

function priorityConfig(p: string) {
  switch (p) {
    case 'high': return { color: 'bg-red-600 text-white', label: 'HIGH' };
    case 'medium': return { color: 'bg-amber-500 text-white', label: 'MEDIUM' };
    case 'low': return { color: 'bg-blue-500 text-white', label: 'LOW' };
    default: return { color: 'bg-gray-500 text-white', label: p.toUpperCase() };
  }
}

function ownerIcon(owner: string) {
  switch (owner) {
    case 'Maintenance': return <Wrench className="w-3.5 h-3.5" />;
    case 'Production': return <Factory className="w-3.5 h-3.5" />;
    case 'Quality': return <Shield className="w-3.5 h-3.5" />;
    case 'Engineering': return <Settings className="w-3.5 h-3.5" />;
    case 'Management': return <Users className="w-3.5 h-3.5" />;
    default: return <PackageCheck className="w-3.5 h-3.5" />;
  }
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {typeof entry.value === 'number'
              ? (entry.name?.toLowerCase().includes('lbs') || entry.name?.toLowerCase().includes('production')
                ? `${entry.value.toLocaleString()} lbs`
                : `${entry.value}%`)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ number, icon, title, badge }: { number: number; icon: React.ReactNode; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold flex-shrink-0">
          {number}
        </div>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{title}</h3>
        </div>
      </div>
      {badge}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, subtitle, trend, trendLabel }: { label: string; value: string; subtitle?: string; trend?: 'up' | 'down' | 'flat'; trendLabel?: string }) {
  const trendColor = trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-gray-500';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-100 dark:border-gray-600/50">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      {trend && trendLabel && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BakeryOperationalDailyReport() {
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingReport, setCheckingReport] = useState(false);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportSource, setReportSource] = useState<'database' | 'generated' | null>(null);
  const [reportSavedAt, setReportSavedAt] = useState<string | null>(null);
  const [reportGeneratedBy, setReportGeneratedBy] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const weekDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(e.target as Node)) {
        setWeekDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch weeks on mount
  useEffect(() => {
    const fetchWeeks = async () => {
      try {
        const res = await api.get('/bakery-metrics/weeks');
        const weekData = res.data?.weeks || res.data || [];
        setWeeks(weekData);
        if (weekData.length > 0) setSelectedWeek(weekData[0].sheet_name);
      } catch (err) {
        console.error('Failed to load weeks:', err);
      } finally {
        setLoadingWeeks(false);
      }
    };
    fetchWeeks();
  }, []);

  // Auto-select current day
  useEffect(() => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (DAYS.includes(today)) setSelectedDay(today);
    else setSelectedDay('Friday');
  }, []);

  // Auto-check for saved report when week/day changes
  useEffect(() => {
    if (!selectedWeek || !selectedDay) return;
    let cancelled = false;
    const checkSaved = async () => {
      setCheckingReport(true);
      setReport(null);
      setReportSource(null);
      setReportSavedAt(null);
      setReportGeneratedBy(null);
      setError('');
      try {
        const res = await api.get('/bakery-metrics/operational-daily-report', {
          params: { weekName: selectedWeek, dayOfWeek: selectedDay },
        });
        if (cancelled) return;
        if (res.data?.exists && res.data?.data) {
          setReport(res.data.data);
          setReportSource('database');
          setReportSavedAt(res.data.savedAt || null);
          setReportGeneratedBy(res.data.generatedBy || null);
        }
      } catch {
        // Silently ignore — user can still generate
      } finally {
        if (!cancelled) setCheckingReport(false);
      }
    };
    checkSaved();
    return () => { cancelled = true; };
  }, [selectedWeek, selectedDay]);

  const handleGenerate = useCallback(async (regenerate = false) => {
    if (!selectedWeek || !selectedDay) { setError('Please select both a week and a day.'); return; }
    setLoading(true);
    setError('');
    setReport(null);
    setReportSource(null);
    setShowRegenerateConfirm(false);
    try {
      const result = await apiWithExtendedTimeout<{ success: boolean; data?: ReportData; error?: string; source?: string; savedAt?: string; generatedBy?: string }>(
        { method: 'POST', url: '/bakery-metrics/operational-daily-report', data: { weekName: selectedWeek, dayOfWeek: selectedDay, regenerate } },
        300000
      );
      if (result.success && result.data) {
        setReport(result.data);
        setReportSource((result.source as 'database' | 'generated') || 'generated');
        setReportSavedAt(result.savedAt || null);
        setReportGeneratedBy(result.generatedBy || null);
      }
      else setError(result.error || 'Failed to generate report.');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  }, [selectedWeek, selectedDay]);

  // ─── Chart Data Builders ──────────────────────────────────────────────────
  const oeeChartData = report?.oeeAnalysis ? [
    { name: 'Die Cut 1', '1st Shift': report.oeeAnalysis.dieCut1.firstShift ?? 0, '2nd Shift': report.oeeAnalysis.dieCut1.secondShift ?? 0, Combined: report.oeeAnalysis.dieCut1.combined ?? 0 },
    { name: 'Die Cut 2', '1st Shift': report.oeeAnalysis.dieCut2.firstShift ?? 0, '2nd Shift': report.oeeAnalysis.dieCut2.secondShift ?? 0, Combined: report.oeeAnalysis.dieCut2.combined ?? 0 },
    { name: 'Overall', '1st Shift': report.oeeAnalysis.overall.firstShift ?? 0, '2nd Shift': report.oeeAnalysis.overall.secondShift ?? 0, Combined: report.oeeAnalysis.overall.combined ?? 0 },
  ] : [];

  const wasteChartData = report?.wasteAnalysis ? [
    { name: 'Die Cut 1', '1st Shift': report.wasteAnalysis.dieCut1?.firstShift?.wastePct ?? 0, '2nd Shift': report.wasteAnalysis.dieCut1?.secondShift?.wastePct ?? 0, Combined: report.wasteAnalysis.dieCut1?.combined?.wastePct ?? report.wasteAnalysis.dieCut1?.wastePct ?? 0 },
    { name: 'Die Cut 2', '1st Shift': report.wasteAnalysis.dieCut2?.firstShift?.wastePct ?? 0, '2nd Shift': report.wasteAnalysis.dieCut2?.secondShift?.wastePct ?? 0, Combined: report.wasteAnalysis.dieCut2?.combined?.wastePct ?? report.wasteAnalysis.dieCut2?.wastePct ?? 0 },
  ] : [];

  const productionChartData = report?.productionOutput ? [
    { name: '1st Shift', 'Die Cut 1': report.productionOutput.dieCut1.firstShift, 'Die Cut 2': report.productionOutput.dieCut2.firstShift },
    { name: '2nd Shift', 'Die Cut 1': report.productionOutput.dieCut1.secondShift, 'Die Cut 2': report.productionOutput.dieCut2.secondShift },
    { name: 'Total', 'Die Cut 1': report.productionOutput.dieCut1.total, 'Die Cut 2': report.productionOutput.dieCut2.total },
  ] : [];

  const shiftComparisonData = report?.shiftPerformance ? [
    { name: 'OEE (%)', '1st Shift': report.shiftPerformance.firstShift.oee ?? 0, '2nd Shift': report.shiftPerformance.secondShift.oee ?? 0 },
    { name: 'Waste (%)', '1st Shift': report.shiftPerformance.firstShift.wastePct, '2nd Shift': report.shiftPerformance.secondShift.wastePct },
  ] : [];

  const scoreData = report?.overallAssessment?.scoreBreakdown ? [
    { name: 'OEE', score: report.overallAssessment.scoreBreakdown.oeeScore, fill: COLORS.primary },
    { name: 'Waste', score: report.overallAssessment.scoreBreakdown.wasteScore, fill: COLORS.warning },
    { name: 'Production', score: report.overallAssessment.scoreBreakdown.productionScore, fill: COLORS.success },
    { name: 'Issues', score: report.overallAssessment.scoreBreakdown.issueManagementScore, fill: COLORS.secondary },
  ] : [];

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ═══ Controls Bar ═══ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Week Period</label>
            <div className="relative" ref={weekDropdownRef}>
              <button type="button" onClick={() => !loadingWeeks && !loading && setWeekDropdownOpen(!weekDropdownOpen)} disabled={loadingWeeks || loading}
                className="w-full flex items-center justify-between bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 cursor-pointer text-left">
                <span className="truncate">{loadingWeeks ? 'Loading weeks...' : selectedWeek || 'Select Week'}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${weekDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {weekDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {weeks.length === 0 && <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No weeks available</div>}
                  {weeks.map(w => (
                    <button key={w.id} type="button" onClick={() => { setSelectedWeek(w.sheet_name); setWeekDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${selectedWeek === w.sheet_name ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                      {w.sheet_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Day of Week</label>
            <div className="relative">
              <select title="Select day" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} disabled={loading}
                className="w-full appearance-none bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 pr-8 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 cursor-pointer">
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <button onClick={() => handleGenerate(false)} disabled={loading || checkingReport || !selectedWeek || !selectedDay}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-semibold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Generating...</>) : checkingReport ? (<><Loader2 className="w-4 h-4 animate-spin" />Checking...</>) : (<><FileBarChart className="w-4 h-4" />Generate Report</>)}
          </button>

          {report && reportSource === 'database' && (
            <button onClick={() => setShowRegenerateConfirm(true)} disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              <RefreshCw className="w-4 h-4" />Regenerate
            </button>
          )}
        </div>

        {loading && (
          <div className="mt-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 flex-shrink-0">
                <div className="absolute inset-0 rounded-full border-2 border-blue-200 dark:border-blue-800" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin" />
                <Activity className="absolute inset-0 m-auto w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Generating Management Report</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Compiling production data, analyzing metrics, and formatting for Level 3 review...</p>
              </div>
            </div>
            <div className="mt-4 w-full bg-blue-100 dark:bg-blue-900/40 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Report source indicator */}
        {report && reportSource === 'database' && !loading && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-700 dark:text-emerald-300 text-sm">
              <span className="font-medium">Saved report loaded</span>
              {reportGeneratedBy && <> &middot; Generated by {reportGeneratedBy}</>}
              {reportSavedAt && <> &middot; {new Date(reportSavedAt).toLocaleString()}</>}
            </p>
          </div>
        )}
      </div>

      {/* ═══ Regenerate Confirmation Modal ═══ */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Regenerate Report?</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              A report already exists for <span className="font-semibold text-gray-900 dark:text-white">{selectedDay}</span> of week <span className="font-semibold text-gray-900 dark:text-white">{selectedWeek}</span>.
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-5">
              Regenerating will permanently override the current report. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowRegenerateConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => handleGenerate(true)}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Yes, Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Empty State ═══ */}
      {!report && !loading && !error && !checkingReport && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Daily Operations Report</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Select a week and day to view a saved report or generate a new AI-powered production analysis report formatted for Level 3 organizational reviews.
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ═══ REPORT CONTENT ═══ */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {report && (
        <div className="space-y-6 animate-in fade-in duration-500">

          {/* ══════════════════ REPORT HEADER ══════════════════ */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-lg p-6 text-white">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <FileBarChart className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Level 3 Operations Review</p>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{report.reportTitle}</h1>
                {report._meta && (
                  <p className="mt-2 text-xs text-gray-400 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Generated {new Date(report._meta.generatedAt).toLocaleString()}
                  </p>
                )}
              </div>
              {report.overallAssessment && (
                <div className="flex items-center gap-3">
                  <div className={`w-16 h-16 rounded-2xl ${gradeColor(report.overallAssessment.grade).bg} flex items-center justify-center shadow-lg ring-4 ${gradeColor(report.overallAssessment.grade).ring}`}>
                    <span className="text-3xl font-black text-white">{report.overallAssessment.grade}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{report.overallAssessment.gradeLabel}</p>
                    <p className="text-xs text-gray-400">Overall Grade</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════ 1. EXECUTIVE SUMMARY ══════════════════ */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <SectionHeader number={1} icon={<Activity className="w-5 h-5 text-blue-600" />} title="Executive Summary" />
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <p className="font-medium text-gray-900 dark:text-white">{report.executiveSummary?.opening}</p>
              <p>{report.executiveSummary?.keyMetrics}</p>
              <p>{report.executiveSummary?.issueHighlight}</p>
              <p className="italic text-gray-600 dark:text-gray-400 border-l-4 border-blue-500 pl-3">{report.executiveSummary?.outlook}</p>
            </div>
          </div>

          {/* ══════════════════ 2. OEE PERFORMANCE ══════════════════ */}
          {report.oeeAnalysis && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <SectionHeader number={2} icon={<Gauge className="w-5 h-5 text-indigo-600" />} title="OEE Performance Analysis"
                badge={<span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(report.oeeAnalysis.overallStatus).color}`}>
                  {statusBadge(report.oeeAnalysis.overallStatus).icon} {statusBadge(report.oeeAnalysis.overallStatus).label}
                </span>} />

              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{report.oeeAnalysis.narrative}</p>

              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 mb-6">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">OEE by Machine &amp; Shift (Target: {report.oeeAnalysis.target}%)</p>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={oeeChartData} barGap={4} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={report.oeeAnalysis.target} stroke={COLORS.target} strokeDasharray="6 4" strokeWidth={2} label={{ value: `Target ${report.oeeAnalysis.target}%`, position: 'right', fill: COLORS.target, fontSize: 11 }} />
                    <Bar dataKey="1st Shift" fill={COLORS.shift1} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="2nd Shift" fill={COLORS.shift2} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Combined" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 dark:border-gray-600">
                      <th className="py-3 px-4 text-left font-bold text-gray-700 dark:text-gray-300">Machine</th>
                      <th className="py-3 px-4 text-center font-bold text-gray-700 dark:text-gray-300">1st Shift</th>
                      <th className="py-3 px-4 text-center font-bold text-gray-700 dark:text-gray-300">2nd Shift</th>
                      <th className="py-3 px-4 text-center font-bold text-gray-700 dark:text-gray-300">Combined</th>
                      <th className="py-3 px-4 text-left font-bold text-gray-700 dark:text-gray-300">Assessment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {[{ label: 'Die Cut 1', data: report.oeeAnalysis.dieCut1 }, { label: 'Die Cut 2', data: report.oeeAnalysis.dieCut2 }].map(({ label, data }) => (
                      <tr key={label} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                        <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">{label}</td>
                        <td className="py-3 px-4 text-center font-mono">{data.firstShift != null ? `${data.firstShift}%` : '—'}</td>
                        <td className="py-3 px-4 text-center font-mono">{data.secondShift != null ? `${data.secondShift}%` : '—'}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold">{data.combined != null ? `${data.combined}%` : '—'}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs leading-relaxed">{data.assessment}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 dark:bg-gray-700/50 font-bold">
                      <td className="py-3 px-4 text-gray-900 dark:text-white">Overall</td>
                      <td className="py-3 px-4 text-center font-mono">{report.oeeAnalysis.overall.firstShift != null ? `${report.oeeAnalysis.overall.firstShift}%` : '—'}</td>
                      <td className="py-3 px-4 text-center font-mono">{report.oeeAnalysis.overall.secondShift != null ? `${report.oeeAnalysis.overall.secondShift}%` : '—'}</td>
                      <td className="py-3 px-4 text-center font-mono">{report.oeeAnalysis.overall.combined != null ? `${report.oeeAnalysis.overall.combined}%` : '—'}</td>
                      <td className="py-3 px-4" />
                    </tr>
                  </tbody>
                </table>
              </div>

              {report.oeeAnalysis.gapAnalysis && (
                <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-1">Gap Analysis</p>
                  <p className="text-sm text-indigo-800 dark:text-indigo-200">{report.oeeAnalysis.gapAnalysis}</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════ 3. WASTE ANALYSIS ══════════════════ */}
          {report.wasteAnalysis && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <SectionHeader number={3} icon={<AlertTriangle className="w-5 h-5 text-amber-600" />} title="Waste Analysis"
                badge={<span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(report.wasteAnalysis.overallStatus).color}`}>
                  {statusBadge(report.wasteAnalysis.overallStatus).icon} {statusBadge(report.wasteAnalysis.overallStatus).label}
                </span>} />

              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{report.wasteAnalysis.narrative}</p>

              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 mb-6">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Waste % by Machine &amp; Shift (Target: ≤{report.wasteAnalysis.target}%)</p>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={wasteChartData} barGap={4} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis domain={[0, 'auto']} tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={report.wasteAnalysis.target} stroke={COLORS.target} strokeDasharray="6 4" strokeWidth={2} label={{ value: `Target ${report.wasteAnalysis.target}%`, position: 'right', fill: COLORS.target, fontSize: 11 }} />
                    <Bar dataKey="1st Shift" fill={COLORS.shift1} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="2nd Shift" fill={COLORS.shift2} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Combined" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-100 dark:border-gray-600/50">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Die Cut 1</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.wasteAnalysis.dieCut1?.combined?.wastePct ?? report.wasteAnalysis.dieCut1?.wastePct ?? 0}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{(report.wasteAnalysis.dieCut1?.combined?.wasteLbs ?? report.wasteAnalysis.dieCut1?.wasteLbs ?? 0).toLocaleString()} lbs</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">{report.wasteAnalysis.dieCut1?.assessment}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-100 dark:border-gray-600/50">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Die Cut 2</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.wasteAnalysis.dieCut2?.combined?.wastePct ?? report.wasteAnalysis.dieCut2?.wastePct ?? 0}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{(report.wasteAnalysis.dieCut2?.combined?.wasteLbs ?? report.wasteAnalysis.dieCut2?.wasteLbs ?? 0).toLocaleString()} lbs</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">{report.wasteAnalysis.dieCut2?.assessment}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Total Waste</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{report.wasteAnalysis.totalWastePct}%</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{report.wasteAnalysis.totalWasteLbs.toLocaleString()} lbs</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">Target: ≤{report.wasteAnalysis.target}%</p>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════ 4. PRODUCTION OUTPUT ══════════════════ */}
          {report.productionOutput && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <SectionHeader number={4} icon={<Factory className="w-5 h-5 text-green-600" />} title="Production Output" />

              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{report.productionOutput.narrative}</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Output by Machine &amp; Shift (lbs)</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={productionChartData} barGap={4} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Die Cut 1" name="Die Cut 1 (lbs)" fill={COLORS.dieCut1} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Die Cut 2" name="Die Cut 2 (lbs)" fill={COLORS.dieCut2} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-3 content-start">
                  <KpiCard label="Total Output" value={`${report.productionOutput.totalPounds.toLocaleString()} lbs`}
                    trend={report.productionOutput.comparisonToPreviousDay === 'improved' ? 'up' : report.productionOutput.comparisonToPreviousDay === 'declined' ? 'down' : 'flat'}
                    trendLabel={report.productionOutput.dayOverDayChange} />
                  <KpiCard label="Die Cut 1" value={`${report.productionOutput.dieCut1.total.toLocaleString()} lbs`}
                    subtitle={`1st: ${report.productionOutput.dieCut1.firstShift.toLocaleString()} | 2nd: ${report.productionOutput.dieCut1.secondShift.toLocaleString()}`} />
                  <KpiCard label="Die Cut 2" value={`${report.productionOutput.dieCut2.total.toLocaleString()} lbs`}
                    subtitle={`1st: ${report.productionOutput.dieCut2.firstShift.toLocaleString()} | 2nd: ${report.productionOutput.dieCut2.secondShift.toLocaleString()}`} />
                  {report.productionOutput.previousDayTotal != null && (
                    <KpiCard label="Previous Day" value={`${report.productionOutput.previousDayTotal.toLocaleString()} lbs`} subtitle="Baseline comparison" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════ 5. SHIFT PERFORMANCE ══════════════════ */}
          {report.shiftPerformance && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <SectionHeader number={5} icon={<Users className="w-5 h-5 text-purple-600" />} title="Shift Performance Comparison" />

              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{report.shiftPerformance.narrative}</p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Head-to-Head</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={shiftComparisonData} layout="vertical" barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} width={70} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="1st Shift" fill={COLORS.shift1} radius={[0, 4, 4, 0]} barSize={20} />
                      <Bar dataKey="2nd Shift" fill={COLORS.shift2} radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={`rounded-xl p-4 border-2 ${report.shiftPerformance.betterShift === 'first' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600' : 'border-gray-200 bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">1st Shift (Shift A)</p>
                    {report.shiftPerformance.betterShift === 'first' && <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">TOP</span>}
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">OEE</span><span className="font-bold text-gray-900 dark:text-white">{report.shiftPerformance.firstShift.oee ?? '—'}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Production</span><span className="font-bold text-gray-900 dark:text-white">{report.shiftPerformance.firstShift.production.toLocaleString()} lbs</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Waste</span><span className="font-bold text-gray-900 dark:text-white">{report.shiftPerformance.firstShift.wastePct}%</span></div>
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-emerald-700 dark:text-emerald-400 mb-1"><span className="font-semibold">Strengths:</span> {report.shiftPerformance.firstShift.strengths}</p>
                      <p className="text-red-700 dark:text-red-400"><span className="font-semibold">Concerns:</span> {report.shiftPerformance.firstShift.concerns}</p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl p-4 border-2 ${report.shiftPerformance.betterShift === 'second' ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-600' : 'border-gray-200 bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">2nd Shift (Shift B)</p>
                    {report.shiftPerformance.betterShift === 'second' && <span className="text-[10px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">TOP</span>}
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">OEE</span><span className="font-bold text-gray-900 dark:text-white">{report.shiftPerformance.secondShift.oee ?? '—'}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Production</span><span className="font-bold text-gray-900 dark:text-white">{report.shiftPerformance.secondShift.production.toLocaleString()} lbs</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Waste</span><span className="font-bold text-gray-900 dark:text-white">{report.shiftPerformance.secondShift.wastePct}%</span></div>
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-emerald-700 dark:text-emerald-400 mb-1"><span className="font-semibold">Strengths:</span> {report.shiftPerformance.secondShift.strengths}</p>
                      <p className="text-red-700 dark:text-red-400"><span className="font-semibold">Concerns:</span> {report.shiftPerformance.secondShift.concerns}</p>
                    </div>
                  </div>
                </div>
              </div>

              {report.shiftPerformance.shiftGap && (
                <div className="mt-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                  <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-1">Shift Gap Analysis</p>
                  <p className="text-sm text-purple-800 dark:text-purple-200">{report.shiftPerformance.shiftGap}</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════ 6. DAY-OVER-DAY COMPARISON ══════════════════ */}
          {report.previousDayComparison && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <SectionHeader number={6} icon={<Calendar className="w-5 h-5 text-cyan-600" />} title="Day-over-Day Comparison" />

              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{report.previousDayComparison.narrative}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  { label: 'OEE', data: report.previousDayComparison.oeeChange, goodDirection: 'up' as const },
                  { label: 'Waste', data: report.previousDayComparison.wasteChange, goodDirection: 'down' as const },
                  { label: 'Production', data: report.previousDayComparison.productionChange, goodDirection: 'up' as const },
                ]).map(({ label, data, goodDirection }) => {
                  const isGood = (goodDirection === 'up' && data.direction === 'up') || (goodDirection === 'down' && data.direction === 'down');
                  const isBad = (goodDirection === 'up' && data.direction === 'down') || (goodDirection === 'down' && data.direction === 'up');
                  const bgColor = isGood ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700' : isBad ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600';
                  const ind = changeIndicator(data.direction);
                  return (
                    <div key={label} className={`rounded-xl p-4 border ${bgColor}`}>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{label}</p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={ind.color}>{ind.icon}</span>
                        <span className={`text-xl font-bold ${ind.color}`}>{data.delta != null ? `${data.delta > 0 ? '+' : ''}${data.delta}%` : 'N/A'}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{data.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════ 7. ISSUE ANALYSIS ══════════════════ */}
          {report.issueAnalysis && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <SectionHeader number={7} icon={<Wrench className="w-5 h-5 text-red-600" />} title="Issue &amp; Downtime Analysis" />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <KpiCard label="Issues Today" value={String(report.issueAnalysis.totalIssuesToday)} />
                <KpiCard label="Carry-Over" value={String(report.issueAnalysis.carryOverCount)} />
                <KpiCard label="Resolved" value={String(report.issueAnalysis.resolvedCount)} />
                <KpiCard label="Minutes Lost" value={String(report.issueAnalysis.totalMinutesLost)} subtitle="Total downtime" />
              </div>

              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{report.issueAnalysis.narrative}</p>

              {report.issueAnalysis.criticalIssues?.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" /> Critical Issues Requiring Action
                  </h4>
                  <div className="space-y-3">
                    {report.issueAnalysis.criticalIssues.map((issue, i) => (
                      <div key={i} className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-5">
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{issue.priority?.toUpperCase()}</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">[{issue.issueNumber}] {issue.title}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full font-semibold uppercase">{issue.status}</span>
                        </div>
                        {issue.equipment && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Equipment: <span className="font-medium text-gray-700 dark:text-gray-300">{issue.equipment}</span> {issue.minutesLost != null && <span className="ml-2">| {issue.minutesLost} min lost</span>}</p>}
                        <div className="space-y-2 text-xs">
                          <div className="bg-white/60 dark:bg-gray-800/40 rounded-lg p-3">
                            <p className="font-bold text-red-700 dark:text-red-300 mb-0.5">Root Cause Assessment</p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{issue.rootCauseAssessment}</p>
                          </div>
                          <div className="bg-white/60 dark:bg-gray-800/40 rounded-lg p-3">
                            <p className="font-bold text-amber-700 dark:text-amber-300 mb-0.5">Production Impact</p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{issue.productionImpact}</p>
                          </div>
                          <div className="bg-white/60 dark:bg-gray-800/40 rounded-lg p-3">
                            <p className="font-bold text-emerald-700 dark:text-emerald-300 mb-0.5">Recommended Action <span className="text-[10px] ml-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">{issue.timeframe}</span></p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{issue.recommendedAction}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {report.issueAnalysis.equipmentCorrelation && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-100 dark:border-gray-600/50">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Equipment Correlation</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{report.issueAnalysis.equipmentCorrelation}</p>
                  </div>
                )}
                {report.issueAnalysis.downtimeImpact && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-100 dark:border-gray-600/50">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Downtime Impact on Production</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{report.issueAnalysis.downtimeImpact}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════ 8. RECOMMENDATIONS ══════════════════ */}
          {report.recommendations?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <SectionHeader number={8} icon={<Zap className="w-5 h-5 text-yellow-600" />} title={`Action Items & Recommendations (${report.recommendations.length})`} />

              <div className="space-y-3">
                {report.recommendations.map((rec, i) => {
                  const pc = priorityConfig(rec.priority);
                  return (
                    <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-sm transition-shadow">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-sm font-bold text-gray-900 dark:text-white mr-auto">{i + 1}. {rec.title}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${pc.color}`}>{pc.label}</span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase flex items-center gap-1">
                          {ownerIcon(rec.owner)} {rec.owner}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[10px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {rec.timeframe}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">{rec.description}</p>
                      <div className="flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                        <Target className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">{rec.expectedImpact}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════ 9. OVERALL ASSESSMENT ══════════════════ */}
          {report.overallAssessment && (
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-lg p-6 text-white">
              <SectionHeader number={9} icon={<Award className="w-5 h-5 text-yellow-400" />} title="Overall Assessment &amp; Closing"
                badge={
                  <div className={`w-12 h-12 rounded-xl ${gradeColor(report.overallAssessment.grade).bg} flex items-center justify-center shadow-lg`}>
                    <span className="text-2xl font-black text-white">{report.overallAssessment.grade}</span>
                  </div>
                } />

              {report.overallAssessment.scoreBreakdown && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {scoreData.map(({ name, score, fill }) => (
                    <div key={name} className="bg-white/10 rounded-xl p-3 text-center">
                      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">{name}</p>
                      <div className="relative w-full bg-white/10 rounded-full h-2.5 mb-1">
                        <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${score * 10}%`, background: fill }} />
                      </div>
                      <p className="text-lg font-bold text-white">{score}<span className="text-xs text-gray-400">/10</span></p>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <p className="text-sm text-gray-200 leading-relaxed">{report.overallAssessment.closingStatement}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
