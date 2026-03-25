'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api, { apiWithExtendedTimeout } from '@/lib/api';
import LoadingState from '@/components/ui/LoadingState';
import {
  Sparkles,
  Lightbulb,
  Target,
  CheckSquare,
  Loader2,
  Info,
  RotateCcw,
  Calendar,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Zap,
  Shield,
  Clock,
  ChevronRight,
  BarChart3,
  Gauge,
  Wrench,
  Users,
  Flame,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Trash2,
  Star,
  CircleDot,
  Factory,
  Layers,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface InsightItem {
  severity: 'critical' | 'warning' | 'positive' | 'info';
  category: string;
  title: string;
  description: string;
  impact: string;
}

interface RecommendationItem {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  expectedImpact: string;
  timeframe: string;
}

interface FollowUpItem {
  title: string;
  description: string;
  dueDate: string;
  assignTo: string;
}

interface AnalysisBlock {
  status: string;
  summary: string;
  trend?: string;
  trendDetail?: string;
}

interface MachineAnalysis {
  dc1Status: string;
  dc2Status: string;
  summary: string;
  imbalanceDetected: boolean;
  imbalanceDetail: string;
}

interface ShiftAnalysis {
  firstShiftStatus: string;
  secondShiftStatus: string;
  summary: string;
  gapDetected: boolean;
  gapDetail: string;
}

interface WeeklyComparison {
  oeeChange: number;
  wasteChange: number;
  productionChange: number;
  summary: string;
}

interface DailyHighlights {
  bestDay: string;
  worstDay: string;
  pattern: string;
}

interface WasteReduction {
  currentLevel: number;
  targetLevel: number;
  topContributor: string;
  rootCauseHypothesis: string;
  savingsEstimate: string;
}

interface YearOverYear {
  available: boolean;
  oeeChange?: number;
  wasteChange?: number;
  summary: string;
}

interface DayMetrics {
  day: string;
  oeeAvg: number;
  wasteAvg: number;
  dc1Oee: number;
  dc2Oee: number;
  production: number;
}

interface ChartData {
  currentWeek: {
    weekName: string;
    days: DayMetrics[];
    avgOee: number;
    avgWaste: number;
    avgProduction: number;
    dc1AvgOee: number;
    dc2AvgOee: number;
  };
  previousWeeks: Array<{
    weekName: string;
    avgOee: number;
    avgWaste: number;
  }>;
  targets: {
    oee: { total: number };
    waste: { total: number };
    volume: { total: number };
  };
}

interface AiMeta {
  weekName: string;
  weekStart: string;
  weekEnd: string;
  daysWithData: number;
  totalWeeksInSystem: number;
  generatedAt: string;
  model: string;
}

interface AiInsightsData {
  healthScore: number;
  healthLabel: string;
  executiveSummary: string;
  oeeAnalysis: AnalysisBlock;
  wasteAnalysis: AnalysisBlock;
  machineAnalysis: MachineAnalysis;
  shiftAnalysis: ShiftAnalysis;
  keyInsights: InsightItem[];
  recommendations: RecommendationItem[];
  followUps: FollowUpItem[];
  weeklyComparison: WeeklyComparison;
  yearOverYear: YearOverYear;
  dailyHighlights: DailyHighlights;
  wasteReduction: WasteReduction;
  _meta: AiMeta;
  _chartData: ChartData;
}

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ─── Skeleton Loader ────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
      <Skeleton className="h-5 w-1/3 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-4/5 mb-2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// ─── Health Score Gauge Component ───────────────────────────────────────────
function HealthGauge({ score, label }: { score: number; label: string }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const circumference = 2 * Math.PI * 54;
  const progress = (animatedScore / 100) * circumference;
  const offset = circumference - progress;

  const getColor = () => {
    if (animatedScore >= 80) return { stroke: '#10b981', bg: 'from-emerald-500/10 to-emerald-500/5', text: 'text-emerald-600 dark:text-emerald-400' };
    if (animatedScore >= 60) return { stroke: '#3b82f6', bg: 'from-blue-500/10 to-blue-500/5', text: 'text-blue-600 dark:text-blue-400' };
    if (animatedScore >= 40) return { stroke: '#f59e0b', bg: 'from-amber-500/10 to-amber-500/5', text: 'text-amber-600 dark:text-amber-400' };
    return { stroke: '#ef4444', bg: 'from-red-500/10 to-red-500/5', text: 'text-red-600 dark:text-red-400' };
  };
  const color = getColor();

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-200 dark:text-gray-700" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={color.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black ${color.text} transition-colors`}>
            {animatedScore}
          </span>
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Score</span>
        </div>
      </div>
      <span className={`mt-2 text-sm font-bold ${color.text}`}>{label}</span>
    </div>
  );
}

// ─── Trend Icon ─────────────────────────────────────────────────────────────
function TrendIcon({ trend, size = 16 }: { trend: string; size?: number }) {
  if (trend === 'improving') return <TrendingUp size={size} className="text-emerald-500" />;
  if (trend === 'declining') return <TrendingDown size={size} className="text-red-500" />;
  return <Minus size={size} className="text-gray-400" />;
}

// ─── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    on_target: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    below_target: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    above_target: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    strong: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    average: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    weak: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  };
  const formatted = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`text-sm px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${config[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
      {formatted}
    </span>
  );
}

// ─── Performance Chart (Animated bars + trend line + target + grid) ────────────
function PerformanceChart({ data, metric, target, gradientId }: {
  data: DayMetrics[];
  metric: 'oeeAvg' | 'wasteAvg';
  target: number;
  gradientId: string;
}) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimate(true), 150); return () => clearTimeout(t); }, []);

  const isWaste = metric === 'wasteAvg';
  const values = data.map(d => d[metric]);
  const maxVal = Math.max(...values, target) * 1.2 || 1;

  // Green / Red palette
  const GREEN = '#10b981';
  const GREEN_LIGHT = '#6ee7b7';
  const RED = '#ef4444';
  const RED_LIGHT = '#fca5a5';

  // SVG dimensions — compact
  const W = 360;
  const H = 130;
  const PAD = { top: 22, right: 12, bottom: 22, left: 34 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Grid lines (4 horizontal)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => ({
    y: PAD.top + chartH * (1 - p),
    label: (maxVal * p).toFixed(1),
  }));

  // Bar geometry
  const barCount = data.length;
  const barGroupW = chartW / barCount;
  const barW = Math.min(barGroupW * 0.5, 38);

  // Target line Y
  const targetY = PAD.top + chartH - (target / maxVal) * chartH;

  // Trend line points (connecting bar tops)
  const trendPoints = data.map((d, i) => {
    const val = d[metric];
    const cx = PAD.left + barGroupW * i + barGroupW / 2;
    const cy = PAD.top + chartH - (val / maxVal) * chartH;
    const good = isWaste ? val <= target : val >= target;
    return { x: cx, y: cy, val, good };
  });

  // Path through points
  const trendPath = trendPoints.length >= 2
    ? `M${trendPoints.map(p => `${p.x},${p.y}`).join(' L')}`
    : '';

  return (
    <div className="mt-2 -mx-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Green gradient for on-target */}
          <linearGradient id={`${gradientId}-green`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity="0.9" />
            <stop offset="100%" stopColor={GREEN_LIGHT} stopOpacity="0.65" />
          </linearGradient>
          {/* Red gradient for off-target */}
          <linearGradient id={`${gradientId}-red`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED} stopOpacity="0.9" />
            <stop offset="100%" stopColor={RED_LIGHT} stopOpacity="0.65" />
          </linearGradient>
          {/* Shadow for bars */}
          <filter id={`${gradientId}-shadow`}>
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Background */}
        <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} rx="4" fill="#f9fafb" opacity="0.5" />

        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={g.y} x2={PAD.left + chartW} y2={g.y}
              stroke="#e5e7eb" strokeWidth="0.5" />
            <text x={PAD.left - 3} y={g.y + 3} textAnchor="end" fontSize="7" fill="#9ca3af" fontFamily="system-ui">
              {parseFloat(g.label).toFixed(0)}%
            </text>
          </g>
        ))}

        {/* Target reference line */}
        <line x1={PAD.left} y1={targetY} x2={PAD.left + chartW} y2={targetY}
          stroke="#6b7280" strokeWidth="1" strokeDasharray="6,4" opacity="0.5" />

        {/* Bars */}
        {data.map((d, i) => {
          const val = d[metric];
          const barHeight = (val / maxVal) * chartH;
          const x = PAD.left + barGroupW * i + (barGroupW - barW) / 2;
          const y = PAD.top + chartH - barHeight;
          const isGood = isWaste ? val <= target : val >= target;

          return (
            <g key={i}>
              {/* Animated bar */}
              <rect
                x={x} y={animate ? y : PAD.top + chartH}
                width={barW} height={animate ? barHeight : 0}
                rx="3" ry="3"
                fill={`url(#${gradientId}-${isGood ? 'green' : 'red'})`}
                filter={`url(#${gradientId}-shadow)`}
                className="transition-all duration-700 ease-out"
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <title>{d.day}: {val.toFixed(1)}%</title>
              </rect>

              {/* Value label above bar */}
              <text
                x={x + barW / 2} y={animate ? y - 4 : PAD.top + chartH - 4}
                textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="system-ui"
                fill={isGood ? GREEN : RED}
                className="transition-all duration-700 ease-out"
                style={{ transitionDelay: `${i * 120}ms` }}
                opacity={animate ? 1 : 0}
              >
                {val.toFixed(1)}%
              </text>

              {/* Day label */}
              <text x={PAD.left + barGroupW * i + barGroupW / 2} y={H - 5}
                textAnchor="middle" fontSize="8.5" fill="#6b7280" fontWeight="600" fontFamily="system-ui">
                {d.day.substring(0, 3)}
              </text>
            </g>
          );
        })}

        {/* Trend line connecting tops */}
        {trendPath && (
          <path
            d={trendPath} fill="none"
            stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            opacity={animate ? 0.45 : 0}
            strokeDasharray="4,3"
            className="transition-opacity duration-1000"
            style={{ transitionDelay: '500ms' }}
          />
        )}

        {/* Trend dots */}
        {trendPoints.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={animate ? p.y : PAD.top + chartH}
            r="2.5" fill="white" stroke={p.good ? GREEN : RED} strokeWidth="1.5"
            className="transition-all duration-700 ease-out"
            style={{ transitionDelay: `${i * 120 + 200}ms` }}
            opacity={animate ? 1 : 0}
          />
        ))}
      </svg>
    </div>
  );
}

// ─── Weekly Trend Chart (multi-week sparkline with area fill + labels) ──────
function WeeklyTrendChart({ values, labels, lowerIsBetter = false }: {
  values: number[];
  labels: string[];
  lowerIsBetter?: boolean;
}) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimate(true), 300); return () => clearTimeout(t); }, []);

  if (values.length < 2) return null;

  const GREEN = '#10b981';
  const RED = '#ef4444';
  const GRAY = '#9ca3af';

  // Overall last-segment trend for the header badge
  const lastVal = values[values.length - 1];
  const prevVal = values[values.length - 2];
  const trending = lastVal > prevVal ? 'up' : lastVal < prevVal ? 'down' : 'flat';
  const isGoodOverall = trending === 'flat' ? true : lowerIsBetter ? trending === 'down' : trending === 'up';
  const overallColor = isGoodOverall ? GREEN : RED;

  const W = 320;
  const H = 58;
  const PAD = { top: 12, right: 10, bottom: 14, left: 10 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const min = Math.min(...values) * 0.85;
  const max = Math.max(...values) * 1.1 || 1;
  const range = max - min || 1;

  const pts = values.map((v, i) => ({
    x: PAD.left + (i / (values.length - 1)) * cW,
    y: PAD.top + cH - ((v - min) / range) * cH,
    val: v,
  }));

  // Per-segment color: green if movement is good, red if bad, gray if flat
  const segmentColor = (i: number): string => {
    if (i === 0) return GRAY; // first point has no previous
    const diff = pts[i].val - pts[i - 1].val;
    if (Math.abs(diff) < 0.01) return GRAY;
    const isGood = lowerIsBetter ? diff < 0 : diff > 0;
    return isGood ? GREEN : RED;
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-sm text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Weekly Trend</p>
        <div className="flex items-center gap-1">
          {trending === 'up' && <TrendingUp size={10} className={isGoodOverall ? 'text-emerald-500' : 'text-red-500'} />}
          {trending === 'down' && <TrendingDown size={10} className={isGoodOverall ? 'text-emerald-500' : 'text-red-500'} />}
          {trending === 'flat' && <Minus size={10} className="text-gray-400" />}
          <span className={`text-sm font-bold`} style={{ color: overallColor }}>
            {lastVal.toFixed(1)}%
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`trend-grad-green-${lowerIsBetter ? 'w' : 'o'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity="0.18" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`trend-grad-red-${lowerIsBetter ? 'w' : 'o'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED} stopOpacity="0.18" />
            <stop offset="100%" stopColor={RED} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Per-segment colored area fills + lines */}
        {pts.map((p, i) => {
          if (i === 0) return null;
          const prev = pts[i - 1];
          const color = segmentColor(i);
          const gradKey = color === GREEN ? 'green' : 'red';
          const suffix = lowerIsBetter ? 'w' : 'o';
          const segArea = `M${prev.x},${prev.y} L${p.x},${p.y} L${p.x},${PAD.top + cH} L${prev.x},${PAD.top + cH} Z`;
          const segLine = `M${prev.x},${prev.y} L${p.x},${p.y}`;
          return (
            <g key={`seg-${i}`} opacity={animate ? 1 : 0} className="transition-opacity duration-700">
              <path d={segArea} fill={color === GRAY ? 'transparent' : `url(#trend-grad-${gradKey}-${suffix})`} />
              <path d={segLine} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
            </g>
          );
        })}

        {/* Points with values */}
        {pts.map((p, i) => {
          const dotColor = i === 0 ? GRAY : segmentColor(i);
          return (
            <g key={i} opacity={animate ? 1 : 0} className="transition-opacity duration-500" style={{ transitionDelay: `${i * 100}ms` }}>
              {/* Outer glow */}
              <circle cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4.5 : 3} fill={dotColor} opacity="0.15" />
              {/* Dot */}
              <circle cx={p.x} cy={p.y} r={i === pts.length - 1 ? 3 : 2}
                fill="white" stroke={dotColor} strokeWidth={i === pts.length - 1 ? 2 : 1.2} />
              {/* Value label */}
              <text
                x={p.x} y={p.y - 6} textAnchor="middle"
                fontSize={i === pts.length - 1 ? '7' : '6'} fontWeight={i === pts.length - 1 ? '800' : '600'}
                fill={i === pts.length - 1 ? dotColor : '#9ca3af'} fontFamily="system-ui"
              >
                {p.val.toFixed(1)}%
              </text>
              {/* Week label */}
              {labels[i] && (
                <text x={p.x} y={H - 2} textAnchor="middle" fontSize="6" fill="#9ca3af" fontFamily="system-ui">
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Change Indicator ───────────────────────────────────────────────────────
function ChangeIndicator({ value, invertColor = false, suffix = '%' }: { value: number; invertColor?: boolean; suffix?: string }) {
  const isPositive = invertColor ? value < 0 : value > 0;
  const isZero = Math.abs(value) < 0.01;
  if (isZero) return <span className="text-sm text-gray-400 font-medium">—</span>;
  return (
    <span className={`text-sm font-bold flex items-center gap-0.5 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function BakeryMetricsInsights() {
  // ─── State ──────────────────────────────────────────────────────────────
  const [weekOptions, setWeekOptions] = useState<string[]>([]);
  const [weekFilter, setWeekFilter] = useState('');
  const [insights, setInsights] = useState<AiInsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedInfo, setCachedInfo] = useState<{ cached: boolean; generatedBy?: string; cachedAt?: string } | null>(null);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    insights: true,
    recommendations: true,
    followUps: true,
  });

  const weekDropdownRef = useRef<HTMLDivElement>(null);
  const notifId = useRef(0);

  // ─── Notifications ──────────────────────────────────────────────────────
  const showNotification = useCallback((message: string, type: Notification['type']) => {
    const id = ++notifId.current;
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  // ─── Click outside dropdown ─────────────────────────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(e.target as Node)) {
        setWeekDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ─── LocalStorage tasks ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bakery_ai_completed_tasks');
      if (stored) setCompletedTasks(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const toggleTask = (taskKey: string) => {
    setCompletedTasks(prev => {
      const next = prev.includes(taskKey) ? prev.filter(k => k !== taskKey) : [...prev, taskKey];
      localStorage.setItem('bakery_ai_completed_tasks', JSON.stringify(next));
      return next;
    });
  };

  const clearTasks = () => {
    if (!confirm('Reset all task completions?')) return;
    setCompletedTasks([]);
    localStorage.removeItem('bakery_ai_completed_tasks');
    showNotification('Task completions cleared', 'info');
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Load Week Options ─────────────────────────────────────────────────
  const loadWeekOptions = useCallback(async () => {
    try {
      const res = await api.get('/bakery-metrics/week-options');
      if (res.data?.success && res.data.weeks) {
        setWeekOptions(res.data.weeks);
        if (res.data.weeks.length > 0 && !weekFilter) {
          setWeekFilter(res.data.default_week || res.data.weeks[0]);
        }
      }
    } catch { /* use empty */ }
  }, [weekFilter]);

  // ─── Load Cached Insights (GET — no GPT call) ─────────────────────────
  const loadInsights = useCallback(async (week?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (week && week !== 'latest') params.append('week', week);

      const res = await api.get(`/bakery-metrics/ai-insights-v2?${params.toString()}`);
      if (res.data?.success && res.data.data) {
        setInsights(res.data.data);
        setCachedInfo({
          cached: true,
          generatedBy: res.data.data?._meta?.generatedBy,
          cachedAt: res.data.data?._meta?.cachedAt,
        });
      } else {
        // No cached data — don't show error, show empty state
        setInsights(null);
        setCachedInfo({ cached: false });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to connect to service');
      setInsights(null);
      setCachedInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Generate / Re-analyze (POST — calls GPT, saves to DB) ─────────────
  const reAnalyze = useCallback(async (week?: string) => {
    setAnalyzing(true);
    setError(null);
    try {
      const data: any = await apiWithExtendedTimeout({
        method: 'POST',
        url: '/bakery-metrics/ai-insights-v2/analyze',
        data: { week: week || weekFilter },
      }, 300000); // 5 min timeout for reasoning models
      if (data?.success && data.data) {
        setInsights(data.data);
        setCachedInfo({
          cached: false,
          generatedBy: data.data?._meta?.generatedBy || 'You',
          cachedAt: new Date().toISOString(),
        });
        const action = data.action === 'REGENERATED' ? 'Re-analysis' : 'Analysis';
        showNotification(`${action} complete — saved to database`, 'success');
      } else {
        setError(data?.error || 'Failed to generate insights');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to connect to AI service');
    } finally {
      setAnalyzing(false);
    }
  }, [weekFilter, showNotification]);

  // ─── Initial load ──────────────────────────────────────────────────────
  useEffect(() => { loadWeekOptions(); }, [loadWeekOptions]);
  useEffect(() => { if (weekFilter) loadInsights(weekFilter); }, [weekFilter]); // eslint-disable-line

  // ─── Chart data helpers ────────────────────────────────────────────────
  const chartData = insights?._chartData;
  const meta = insights?._meta;

  const trendOeeValues = useMemo(() => {
    if (!chartData) return [];
    const prev = [...(chartData.previousWeeks || [])].reverse().map(w => w.avgOee);
    return [...prev, chartData.currentWeek?.avgOee || 0];
  }, [chartData]);

  const trendWasteValues = useMemo(() => {
    if (!chartData) return [];
    const prev = [...(chartData.previousWeeks || [])].reverse().map(w => w.avgWaste);
    return [...prev, chartData.currentWeek?.avgWaste || 0];
  }, [chartData]);

  const trendLabels = useMemo(() => {
    if (!chartData) return [];
    const prev = [...(chartData.previousWeeks || [])].reverse().map(w => {
      const n = w.weekName || '';
      return n.length > 6 ? n.slice(0, 6) : n;
    });
    return [...prev, 'Current'];
  }, [chartData]);

  // ─── Severity config ──────────────────────────────────────────────────
  const severityConfig: Record<string, { bg: string; border: string; icon: React.ElementType; iconColor: string }> = {
    critical: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-500', icon: AlertCircle, iconColor: 'text-red-500' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-500', icon: AlertTriangle, iconColor: 'text-amber-500' },
    positive: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-500', icon: CheckSquare, iconColor: 'text-emerald-500' },
    info: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-500', icon: Info, iconColor: 'text-blue-500' },
  };

  const priorityConfig: Record<string, { bg: string; text: string }> = {
    high: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
    medium: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
    low: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  };

  const categoryIcons: Record<string, React.ElementType> = {
    maintenance: Wrench,
    process: Layers,
    training: Users,
    quality: Shield,
    scheduling: Clock,
    oee: Gauge,
    waste: Trash2,
    production: Factory,
    machine: Zap,
    shift: Users,
    general: Info,
  };

  // ─── Notification config ──────────────────────────────────────────────
  const notifCfg: Record<string, string> = {
    success: 'bg-emerald-500 border-emerald-400 text-white',
    error: 'bg-red-500 border-red-400 text-white',
    warning: 'bg-amber-500 border-amber-400 text-white',
    info: 'bg-blue-500 border-blue-400 text-white',
  };
  const alertIcons: Record<string, React.ElementType> = {
    success: CheckSquare,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4 relative">
      {/* ═══ Notifications ═══ */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(n => {
          const Ic = alertIcons[n.type] || Info;
          return (
            <div key={n.id} className={`px-4 py-3 rounded-xl shadow-lg max-w-xs border ${notifCfg[n.type]} animate-slide-in-right`}>
              <div className="flex items-center space-x-2">
                <Ic className="w-4 h-4 text-white flex-shrink-0" />
                <span className="text-sm font-semibold text-white">{n.message}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ HEADER BAR ═══ */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 lg:p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI-Powered Production Intelligence
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Deep analysis powered by GPT • Real-time data from your bakery operations
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Week Dropdown */}
            <div ref={weekDropdownRef} className="relative">
              <button
                onClick={() => setWeekDropdownOpen(!weekDropdownOpen)}
                className="inline-flex items-center px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-w-[180px] justify-between"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Calendar className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                  {weekFilter || 'Select Week'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform ${weekDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {weekDropdownOpen && (
                <div className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-[280px] overflow-y-auto">
                  {weekOptions.map(w => (
                    <button
                      key={w}
                      onClick={() => { setWeekFilter(w); setWeekDropdownOpen(false); }}
                      className={`block w-full text-left px-3 py-2 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors ${
                        weekFilter === w ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Re-analyze button */}
            <button
              onClick={() => reAnalyze(weekFilter)}
              disabled={loading || analyzing}
              className="inline-flex items-center px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50"
            >
              {analyzing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
              {analyzing ? 'Analyzing...' : insights ? 'Re-analyze' : 'Generate Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ CACHE INFO BAR ═══ */}
      {!loading && !analyzing && cachedInfo?.cached && cachedInfo.generatedBy && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Cached analysis
            </span>
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              — Last analyzed by <span className="font-bold">{cachedInfo.generatedBy}</span>
              {cachedInfo.cachedAt && (
                <> on {new Date(cachedInfo.cachedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</>
              )}
            </span>
          </div>
        </div>
      )}

      {/* ═══ LOADING STATE (initial cache load) ═══ */}
      {loading && !analyzing && (
        <div className="bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 animate-fade-in">
          <LoadingState message="Checking for saved results" title="Loading cached analysis..." icon="data" color="purple" fullScreen={false} />
        </div>
      )}

      {/* ═══ ANALYZING STATE (GPT call in progress) ═══ */}
      {analyzing && (
        <div className="space-y-4 animate-fade-in">
          {/* AI thinking animation */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl shadow-lg border border-purple-200 dark:border-purple-800 p-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm font-bold text-purple-700 dark:text-purple-300">AI is analyzing your production data...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">Examining OEE, waste patterns, machine performance, and shift comparisons</p>
          </div>
          {/* Skeleton grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      )}

      {/* ═══ NO CACHE STATE — show prompt to generate ═══ */}
      {!loading && !analyzing && !error && !insights && cachedInfo?.cached === false && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl shadow-lg border border-purple-200 dark:border-purple-800 p-8 text-center animate-fade-in">
          <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-purple-700 dark:text-purple-300">No analysis found for this week</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">Click the button below to generate an AI-powered analysis. Once generated, it will be saved and shared with all users.</p>
          <button
            onClick={() => reAnalyze(weekFilter)}
            className="mt-4 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <Sparkles className="w-4 h-4 inline mr-1.5" /> Generate Analysis
          </button>
        </div>
      )}

      {/* ═══ ERROR STATE ═══ */}
      {!loading && !analyzing && error && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl shadow-lg border border-red-200 dark:border-red-800 p-6 text-center animate-fade-in">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-red-700 dark:text-red-300">Analysis Failed</p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1 max-w-md mx-auto">{error}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => loadInsights(weekFilter)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Load Cached
            </button>
            <button
              onClick={() => reAnalyze(weekFilter)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Retry Analysis
            </button>
          </div>
        </div>
      )}

      {/* ═══ INSIGHTS CONTENT ═══ */}
      {!loading && !analyzing && insights && (
        <div className="space-y-4 animate-fade-in">

          {/* ──── ROW 1: Executive Summary + Health Gauge ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Health Score Gauge */}
            <div className="lg:col-span-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 flex flex-col items-center justify-center">
              <HealthGauge score={insights.healthScore} label={insights.healthLabel} />
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Plant Health Score</p>
                {meta && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{meta.weekName}</p>
                )}
              </div>
            </div>

            {/* Executive Summary */}
            <div className="lg:col-span-9 bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-800 dark:to-purple-900/10 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                  <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Executive Summary</h4>
              </div>
              <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">{insights.executiveSummary}</p>

              {/* Quick Stats Row */}
              {chartData && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="bg-white/60 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Avg OEE</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{chartData.currentWeek.avgOee}%</p>
                    {insights.weeklyComparison && <ChangeIndicator value={insights.weeklyComparison.oeeChange} />}
                  </div>
                  <div className="bg-white/60 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Avg Waste</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{chartData.currentWeek.avgWaste}%</p>
                    {insights.weeklyComparison && <ChangeIndicator value={insights.weeklyComparison.wasteChange} invertColor />}
                  </div>
                  <div className="bg-white/60 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">DC1 OEE</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{chartData.currentWeek.dc1AvgOee}%</p>
                  </div>
                  <div className="bg-white/60 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">DC2 OEE</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{chartData.currentWeek.dc2AvgOee}%</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ──── ROW 2: OEE Analysis + Waste Analysis ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* OEE Analysis */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                    <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">OEE Performance</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Target: {chartData?.targets.oee.total}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {insights.oeeAnalysis?.trend && <TrendIcon trend={insights.oeeAnalysis.trend} />}
                  <StatusBadge status={insights.oeeAnalysis?.status || 'info'} />
                </div>
              </div>
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">{insights.oeeAnalysis?.summary}</p>
              {insights.oeeAnalysis?.trendDetail && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2 italic">{insights.oeeAnalysis.trendDetail}</p>
              )}
              {/* Mini daily chart */}
              {chartData?.currentWeek?.days && chartData.currentWeek.days.length > 0 && (
                <PerformanceChart data={chartData.currentWeek.days} metric="oeeAvg" target={chartData.targets.oee.total} gradientId="oee-bar-grad" />
              )}
            </div>

            {/* Waste Analysis */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-100 dark:bg-orange-900/40 rounded-lg">
                    <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Waste Management</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Target: ≤{chartData?.targets.waste.total}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {insights.wasteAnalysis?.trend && <TrendIcon trend={insights.wasteAnalysis.trend === 'improving' ? 'improving' : insights.wasteAnalysis.trend === 'declining' ? 'declining' : 'stable'} />}
                  <StatusBadge status={insights.wasteAnalysis?.status || 'info'} />
                </div>
              </div>
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">{insights.wasteAnalysis?.summary}</p>
              {insights.wasteAnalysis?.trendDetail && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2 italic">{insights.wasteAnalysis.trendDetail}</p>
              )}
              {/* Mini daily chart */}
              {chartData?.currentWeek?.days && chartData.currentWeek.days.length > 0 && (
                <PerformanceChart data={chartData.currentWeek.days} metric="wasteAvg" target={chartData.targets.waste.total} gradientId="waste-bar-grad" />
              )}
            </div>
          </div>

          {/* ──── ROW 3: Machine Analysis + Shift Analysis ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Machine Analysis */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/40 rounded-lg">
                  <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Machine Effectiveness</h4>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-400">Die Cut 1</span>
                    <StatusBadge status={insights.machineAnalysis?.dc1Status || 'average'} />
                  </div>
                  <p className="text-xl font-black text-gray-900 dark:text-white">{chartData?.currentWeek.dc1AvgOee || 0}%</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">OEE Average</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-400">Die Cut 2</span>
                    <StatusBadge status={insights.machineAnalysis?.dc2Status || 'average'} />
                  </div>
                  <p className="text-xl font-black text-gray-900 dark:text-white">{chartData?.currentWeek.dc2AvgOee || 0}%</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">OEE Average</p>
                </div>
              </div>

              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">{insights.machineAnalysis?.summary}</p>
              {insights.machineAnalysis?.imbalanceDetected && (
                <div className="mt-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">{insights.machineAnalysis.imbalanceDetail}</p>
                </div>
              )}
            </div>

            {/* Shift Analysis */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-violet-100 dark:bg-violet-900/40 rounded-lg">
                  <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Shift Comparison</h4>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-400">1st Shift</span>
                    <StatusBadge status={insights.shiftAnalysis?.firstShiftStatus || 'average'} />
                  </div>
                  <p className="text-xl font-black text-gray-900 dark:text-white">{chartData?.currentWeek ? Math.round((chartData.currentWeek.days.reduce((s, d) => s + d.oeeAvg, 0) / Math.max(chartData.currentWeek.days.length, 1)) * 10) / 10 : 0}%</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">OEE Average</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-400">2nd Shift</span>
                    <StatusBadge status={insights.shiftAnalysis?.secondShiftStatus || 'average'} />
                  </div>
                  <p className="text-xl font-black text-gray-900 dark:text-white">—</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">OEE Average</p>
                </div>
              </div>

              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">{insights.shiftAnalysis?.summary}</p>
              {insights.shiftAnalysis?.gapDetected && (
                <div className="mt-2 flex items-start gap-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg p-2">
                  <Activity className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-violet-700 dark:text-violet-300 font-medium">{insights.shiftAnalysis.gapDetail}</p>
                </div>
              )}
            </div>
          </div>

          {/* ──── ROW 4: Weekly Comparison + Waste Reduction + Daily Highlights ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Weekly Comparison */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Weekly Comparison</h4>
              </div>
              {insights.weeklyComparison && (
                <>
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">OEE Change</span>
                      <ChangeIndicator value={insights.weeklyComparison.oeeChange} />
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Waste Change</span>
                      <ChangeIndicator value={insights.weeklyComparison.wasteChange} invertColor />
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Production</span>
                      <ChangeIndicator value={insights.weeklyComparison.productionChange} />
                    </div>
                  </div>
                  <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">{insights.weeklyComparison.summary}</p>
                </>
              )}
              {insights.yearOverYear?.available && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Year-over-Year</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{insights.yearOverYear.summary}</p>
                </div>
              )}
            </div>

            {/* Waste Reduction Advisor */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-rose-100 dark:bg-rose-900/40 rounded-lg">
                  <Flame className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Waste Reduction Advisor</h4>
              </div>
              {insights.wasteReduction && (
                <>
                  {/* Waste gauge bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Current: {insights.wasteReduction.currentLevel}%</span>
                      <span className="font-medium text-gray-600 dark:text-gray-400">Target: {insights.wasteReduction.targetLevel}%</span>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          insights.wasteReduction.currentLevel <= insights.wasteReduction.targetLevel
                            ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                            : 'bg-gradient-to-r from-red-400 to-red-500'
                        }`}
                        style={{ width: `${Math.min((insights.wasteReduction.currentLevel / (insights.wasteReduction.targetLevel * 2)) * 100, 100)}%` }}
                      />
                      {/* Target marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-gray-800 dark:bg-white"
                        style={{ left: `${Math.min((insights.wasteReduction.targetLevel / (insights.wasteReduction.targetLevel * 2)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-300">Top Contributor:</span>
                      <span className="text-gray-600 dark:text-gray-400 ml-1">{insights.wasteReduction.topContributor}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-300">Root Cause:</span>
                      <span className="text-gray-600 dark:text-gray-400 ml-1">{insights.wasteReduction.rootCauseHypothesis}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-300">Est. Savings:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 ml-1 font-semibold">{insights.wasteReduction.savingsEstimate}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Daily Highlights */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                  <Star className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Daily Highlights</h4>
              </div>
              {insights.dailyHighlights && (
                <div className="space-y-3">
                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg p-3 border-l-3 border-emerald-500">
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-0.5">🏆 Best Day</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{insights.dailyHighlights.bestDay}</p>
                  </div>
                  <div className="bg-red-50/50 dark:bg-red-900/10 rounded-lg p-3 border-l-3 border-red-500">
                    <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-0.5">⚠️ Worst Day</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{insights.dailyHighlights.worstDay}</p>
                  </div>
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-3 border-l-3 border-blue-500">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-0.5">📊 Pattern</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{insights.dailyHighlights.pattern}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ──── ROW 5: Key Insights (full width, collapsible) ──── */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
            <button
              onClick={() => toggleSection('insights')}
              className="w-full flex items-center justify-between mb-3"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                  <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Key Performance Insights</h4>
                <span className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
                  {insights.keyInsights?.length || 0}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.insights ? 'rotate-180' : ''}`} />
            </button>
            {expandedSections.insights && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.keyInsights && insights.keyInsights.length > 0 ? (
                  insights.keyInsights.map((item, i) => {
                    const cfg = severityConfig[item.severity] || severityConfig.info;
                    const CatIcon = categoryIcons[item.category] || Info;
                    return (
                      <div
                        key={i}
                        className={`${cfg.bg} rounded-xl p-4 border-l-4 ${cfg.border} transition-all hover:shadow-md`}
                        style={{ animationDelay: `${i * 50}ms` }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <CatIcon className={`w-4 h-4 ${cfg.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.title}</p>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                item.severity === 'critical' ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' :
                                item.severity === 'warning' ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' :
                                item.severity === 'positive' ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200' :
                                'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                              }`}>{item.severity}</span>
                            </div>
                            <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">{item.description}</p>
                            {item.impact && (
                              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1.5 italic flex items-center gap-1">
                                <CircleDot className="w-3 h-3" /> {item.impact}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-center py-6">
                    <Lightbulb className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No insights generated</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ──── ROW 6: Recommendations + Follow-ups ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recommendations */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
              <button
                onClick={() => toggleSection('recommendations')}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                    <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Recommendations</h4>
                  <span className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
                    {insights.recommendations?.length || 0}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.recommendations ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.recommendations && (
                <div className="space-y-3">
                  {insights.recommendations && insights.recommendations.length > 0 ? (
                    insights.recommendations.map((rec, i) => {
                      const pCfg = priorityConfig[rec.priority] || priorityConfig.medium;
                      const CatIcon = categoryIcons[rec.category] || Target;
                      return (
                        <div key={i} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3.5 hover:shadow-md transition-all border border-gray-100 dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              <CatIcon className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{rec.title}</p>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${pCfg.bg} ${pCfg.text}`}>
                                  {rec.priority}
                                </span>
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-medium">
                                  {rec.timeframe?.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">{rec.description}</p>
                              {rec.expectedImpact && (
                                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" /> {rec.expectedImpact}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6">
                      <Target className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No recommendations</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Follow-up Tracker */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
              <button
                onClick={() => toggleSection('followUps')}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                    <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Follow-up Tracker</h4>
                  {insights.followUps && insights.followUps.length > 0 && (
                    <span className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
                      {completedTasks.length}/{insights.followUps.length} done
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {completedTasks.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); clearTasks(); }}
                      className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 rounded-md transition-colors"
                    >
                      <RotateCcw className="w-3 h-3 inline mr-0.5" /> Reset
                    </button>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.followUps ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {expandedSections.followUps && (
                <>
                  {/* Progress bar */}
                  {insights.followUps && insights.followUps.length > 0 && (
                    <div className="mb-3">
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-500"
                          style={{ width: `${(completedTasks.length / insights.followUps.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2.5">
                    {insights.followUps && insights.followUps.length > 0 ? (
                      insights.followUps.map((fu, i) => {
                        const taskKey = `${meta?.weekName || ''}_${fu.title}`;
                        const done = completedTasks.includes(taskKey);
                        return (
                          <div key={i} className={`bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 transition-all ${done ? 'opacity-50' : ''}`}>
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={done}
                                onChange={() => toggleTask(taskKey)}
                                title={`Mark "${fu.title}" as ${done ? 'incomplete' : 'complete'}`}
                                className="mt-0.5 rounded border-gray-300 dark:border-gray-500 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                              />
                              <div className="flex-1">
                                <p className={`text-sm font-bold ${done ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                  {fu.title}
                                </p>
                                <p className={`text-sm mt-0.5 ${done ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {fu.description}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-sm px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium">
                                    <Clock className="w-3 h-3 inline mr-0.5" />{fu.dueDate?.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-sm px-1.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 font-medium">
                                    <Users className="w-3 h-3 inline mr-0.5" />{fu.assignTo?.replace(/_/g, ' ')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6">
                        <CheckSquare className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No follow-up items</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Spacer so content doesn't hide behind fixed footer */}
          <div className="h-20" />
        </div>
      )}

      {/* ──── FIXED FOOTER ──── */}
      {insights && meta && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/80 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] border-t border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">📄 Analysis Report</h4>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>Week: <span className="font-semibold text-gray-800 dark:text-gray-200">{meta.weekName}</span></span>
                <span>Period: <span className="font-semibold text-gray-800 dark:text-gray-200">{meta.weekStart} → {meta.weekEnd}</span></span>
                <span>Days: <span className="font-semibold text-gray-800 dark:text-gray-200">{meta.daysWithData}/5</span></span>
                <span>Generated: <span className="font-semibold text-gray-800 dark:text-gray-200">{new Date(meta.generatedAt).toLocaleString()}</span></span>
                {meta.generatedBy && <span>Generated by: <span className="font-semibold text-gray-800 dark:text-gray-200">{meta.generatedBy}</span></span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">AI Engine Active</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EMPTY STATE (no loading, no error, no data) ═══ */}
      {!loading && !error && !insights && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Sparkles className="w-12 h-12 text-purple-300 dark:text-purple-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">Ready for AI Analysis</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Select a week and click &quot;Generate Analysis&quot; to get comprehensive AI-powered insights about your bakery production performance.
          </p>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
      `}</style>
    </div>
  );
}
