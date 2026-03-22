'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import api from '@/lib/api';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart, ReferenceLine, LabelList,
} from 'recharts';
import {
  Calendar, Loader2,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
interface WeekData {
  weekName: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  dieCut1Oee: number;
  dieCut2Oee: number;
  avgOee: number;
  dieCut1Waste: number;
  dieCut2Waste: number;
  avgWaste: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════════
const PERIOD_CHART_STYLES = `
@keyframes blinkOutline {
  0%, 100% { stroke-opacity: 1; }
  50% { stroke-opacity: 0.2; }
}
@keyframes periodFadeIn {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes modalSlideIn {
  from { opacity: 0; transform: scale(0.92) translateY(20px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes modalOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.period-chart-section { animation: periodFadeIn 0.5s cubic-bezier(.22,1,.36,1) both; }
.period-modal-overlay { animation: modalOverlayIn 0.25s ease-out both; }
.period-modal-content { animation: modalSlideIn 0.35s cubic-bezier(.22,1,.36,1) both; }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clip a week's start/end to the user-selected range, then count
 * business days (Mon-Fri) and return the day-of-month range.
 */
function getClippedWeekInfo(
  weekStart: string,
  weekEnd: string,
  rangeStart: string,
  rangeEnd: string,
): { dayStart: number; dayEnd: number; businessDays: number } {
  const ws = new Date(weekStart + 'T00:00:00Z');
  const we = new Date(weekEnd + 'T00:00:00Z');
  const rs = new Date(rangeStart + 'T00:00:00Z');
  const re = new Date(rangeEnd + 'T00:00:00Z');

  // Clip to the user-selected range
  const effectiveStart = ws < rs ? rs : ws;
  const effectiveEnd = we > re ? re : we;

  // Count weekdays (Mon=1 .. Fri=5)
  let bizDays = 0;
  const cursor = new Date(effectiveStart);
  while (cursor <= effectiveEnd) {
    const dow = cursor.getUTCDay(); // 0=Sun .. 6=Sat
    if (dow >= 1 && dow <= 5) bizDays++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    dayStart: effectiveStart.getUTCDate(),
    dayEnd: effectiveEnd.getUTCDate(),
    businessDays: Math.min(bizDays, 5), // cap at 5
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM TOOLTIP
// ═══════════════════════════════════════════════════════════════════════════════
const PeriodChartTooltip = ({ active, payload, label, oeeTarget }: any) => {
  if (!active || !payload?.length) return null;
  const dc1 = payload.find((p: any) => p.dataKey === 'dieCut1Oee')?.value ?? 0;
  const dc2 = payload.find((p: any) => p.dataKey === 'dieCut2Oee')?.value ?? 0;
  const dc1Met = dc1 >= oeeTarget;
  const dc2Met = dc2 >= oeeTarget;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 min-w-[220px] backdrop-blur-sm">
      <p className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 pb-2">
        <Calendar className="w-3 h-3 text-blue-500" /> {label}
      </p>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Die Cut 1:</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white ml-auto">{dc1}%</span>
          <span className={`text-[10px] font-semibold ${dc1Met ? 'text-green-600' : 'text-red-500'}`}>
            {dc1Met ? '✓' : '✗'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Die Cut 2:</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white ml-auto">{dc2}%</span>
          <span className={`text-[10px] font-semibold ${dc2Met ? 'text-green-600' : 'text-red-500'}`}>
            {dc2Met ? '✓' : '✗'}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        Target: {oeeTarget}%
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM BAR SHAPES — red blinking outline when below target
// ═══════════════════════════════════════════════════════════════════════════════
const DieCut1Bar = (props: any) => {
  const { x, y, width, height, value, oeeTarget } = props;
  if (!height || height <= 0) return null;
  const belowTarget = value < oeeTarget && value > 0;
  const gradId = `dc1Grad_${x}_${y}`;
  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4}
        fill={`url(#${gradId})`}
      />
      {belowTarget && (
        <rect x={x - 2.5} y={y - 2.5} width={width + 5} height={height + 5} rx={6} ry={6}
          fill="none" stroke="#ef4444" strokeWidth={4.5}
          style={{ animation: 'blinkOutline 1s ease-in-out infinite' }}
        />
      )}
      <text x={x + width / 2} y={y + height + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#1e40af">
        DC1
      </text>
    </g>
  );
};

const DieCut2Bar = (props: any) => {
  const { x, y, width, height, value, oeeTarget } = props;
  if (!height || height <= 0) return null;
  const belowTarget = value < oeeTarget && value > 0;
  const gradId = `dc2Grad_${x}_${y}`;
  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4}
        fill={`url(#${gradId})`}
      />
      {belowTarget && (
        <rect x={x - 2.5} y={y - 2.5} width={width + 5} height={height + 5} rx={6} ry={6}
          fill="none" stroke="#ef4444" strokeWidth={4.5}
          style={{ animation: 'blinkOutline 1s ease-in-out infinite' }}
        />
      )}
      <text x={x + width / 2} y={y + height + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#047857">
        DC2
      </text>
    </g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WASTE TOOLTIP
// ═══════════════════════════════════════════════════════════════════════════════
const PeriodWasteTooltip = ({ active, payload, label, wasteTarget }: any) => {
  if (!active || !payload?.length) return null;
  const dc1 = payload.find((p: any) => p.dataKey === 'dieCut1Waste')?.value ?? 0;
  const dc2 = payload.find((p: any) => p.dataKey === 'dieCut2Waste')?.value ?? 0;
  // For waste: lower is better, so ≤ target = met
  const dc1Met = dc1 <= wasteTarget && dc1 > 0;
  const dc2Met = dc2 <= wasteTarget && dc2 > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 min-w-[220px] backdrop-blur-sm">
      <p className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 pb-2">
        <Calendar className="w-3 h-3 text-orange-500" /> {label}
      </p>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">DC1 Waste:</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white ml-auto">{dc1}%</span>
          {dc1 > 0 && (
            <span className={`text-[10px] font-semibold ${dc1Met ? 'text-green-600' : 'text-red-500'}`}>
              {dc1Met ? '✓' : '✗'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">DC2 Waste:</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white ml-auto">{dc2}%</span>
          {dc2 > 0 && (
            <span className={`text-[10px] font-semibold ${dc2Met ? 'text-green-600' : 'text-red-500'}`}>
              {dc2Met ? '✓' : '✗'}
            </span>
          )}
        </div>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        Target: ≤{wasteTarget}% (lower is better)
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WASTE BAR SHAPES — red blinking outline when ABOVE target (lower is better)
// ═══════════════════════════════════════════════════════════════════════════════
const WasteDC1Bar = (props: any) => {
  const { x, y, width, height, value, wasteTarget } = props;
  if (!height || height <= 0) return null;
  const aboveTarget = value > wasteTarget && value > 0;
  const gradId = `wdc1Grad_${x}_${y}`;
  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4}
        fill={`url(#${gradId})`}
      />
      {aboveTarget && (
        <rect x={x - 2.5} y={y - 2.5} width={width + 5} height={height + 5} rx={6} ry={6}
          fill="none" stroke="#ef4444" strokeWidth={4.5}
          style={{ animation: 'blinkOutline 1s ease-in-out infinite' }}
        />
      )}
      <text x={x + width / 2} y={y + height + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#1e40af">
        DC1
      </text>
    </g>
  );
};

const WasteDC2Bar = (props: any) => {
  const { x, y, width, height, value, wasteTarget } = props;
  if (!height || height <= 0) return null;
  const aboveTarget = value > wasteTarget && value > 0;
  const gradId = `wdc2Grad_${x}_${y}`;
  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4}
        fill={`url(#${gradId})`}
      />
      {aboveTarget && (
        <rect x={x - 2.5} y={y - 2.5} width={width + 5} height={height + 5} rx={6} ry={6}
          fill="none" stroke="#ef4444" strokeWidth={4.5}
          style={{ animation: 'blinkOutline 1s ease-in-out infinite' }}
        />
      )}
      <text x={x + width / 2} y={y + height + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#047857">
        DC2
      </text>
    </g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS WEEK NUMBER CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Calculate the business calendar week number for a given date.
 * Week 1 starts on the configured calendar year start date.
 */
function getBusinessWeekNumber(
  dateStr: string,
  calStartMonth: number, // 1-12
  calStartDay: number,   // 1-31
): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  const year = d.getUTCFullYear();

  // Build this year's and last year's business year start
  const thisYearStart = new Date(Date.UTC(year, calStartMonth - 1, calStartDay));
  const prevYearStart = new Date(Date.UTC(year - 1, calStartMonth - 1, calStartDay));

  // The business year start that applies is the most recent one <= d
  const bizYearStart = d >= thisYearStart ? thisYearStart : prevYearStart;

  const diffMs = d.getTime() - bizYearStart.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

interface BakeryPeriodOeeChartProps {
  startDate: string;
  endDate: string;
}

export default function BakeryPeriodOeeChart({ startDate, endDate }: BakeryPeriodOeeChartProps) {
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  const [oeeTarget, setOeeTarget] = useState(70);
  const [wasteTarget, setWasteTarget] = useState(3);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [calConfig, setCalConfig] = useState<{ month: number; day: number } | null>(null);

  // ─── FETCH CALENDAR YEAR CONFIG ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/organizations/calendar-config');
        if (res.data.success && res.data.data) {
          setCalConfig({
            month: res.data.data.calendarYearStartMonth ?? 1,
            day: res.data.data.calendarYearStartDay ?? 1,
          });
        }
      } catch {
        // Fallback: Jan 1 (standard calendar year)
        setCalConfig({ month: 1, day: 1 });
      }
    })();
  }, []);

  // ─── AUTO-FETCH when dates change ─────────────────────────────────────────
  const fetchData = useCallback(async (start: string, end: string) => {
    if (!start || !end) return;
    setLoading(true);
    setLoaded(false);
    try {
      const res = await api.get(`/bakery-metrics/period-oee-comparison?start=${start}&end=${end}`);
      if (res.data.success) {
        setWeekData(res.data.weeks || []);
        setOeeTarget(res.data.oeeTarget ?? 70);
        setWasteTarget(res.data.wasteTarget ?? 3);
        setLoaded(true);
      }
    } catch (err) {
      console.error('Period OEE fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchData(startDate, endDate);
    }
  }, [startDate, endDate, fetchData]);

  // ─── CHART DATA ──────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return weekData.map(w => {
      const dc1Below = w.dieCut1Oee > 0 && w.dieCut1Oee < oeeTarget;
      const dc2Below = w.dieCut2Oee > 0 && w.dieCut2Oee < oeeTarget;
      // Compute business week number from calendar year config
      const weekNum = calConfig
        ? getBusinessWeekNumber(w.weekStart, calConfig.month, calConfig.day)
        : null;
      // Compute clipped day range & business day count
      const clip = getClippedWeekInfo(w.weekStart, w.weekEnd, startDate, endDate);
      return {
        weekLabel: weekNum ? `W${weekNum}` : w.weekLabel,
        dayRangeLabel: `[${clip.dayStart} - ${clip.dayEnd}]`,
        dayCountLabel: clip.businessDays === 1 ? '1 DAY' : `${clip.businessDays} DAYS`,
        dieCut1Oee: w.dieCut1Oee,
        dieCut2Oee: w.dieCut2Oee,
        // Normal trend: value when AT or ABOVE target
        dc1TrendNormal: !dc1Below && w.dieCut1Oee > 0 ? w.dieCut1Oee : null,
        dc2TrendNormal: !dc2Below && w.dieCut2Oee > 0 ? w.dieCut2Oee : null,
        // Red trend: value when BELOW target
        dc1TrendRed: dc1Below ? w.dieCut1Oee : null,
        dc2TrendRed: dc2Below ? w.dieCut2Oee : null,
        // Full trend (for continuous line)
        dc1Trend: w.dieCut1Oee || null,
        dc2Trend: w.dieCut2Oee || null,
        // Waste data
        dieCut1Waste: w.dieCut1Waste,
        dieCut2Waste: w.dieCut2Waste,
        dc1WasteTrend: w.dieCut1Waste || null,
        dc2WasteTrend: w.dieCut2Waste || null,
        // Waste above target = bad (red)
        dc1WasteAbove: (w.dieCut1Waste > 0 && w.dieCut1Waste > wasteTarget) ? w.dieCut1Waste : null,
        dc2WasteAbove: (w.dieCut2Waste > 0 && w.dieCut2Waste > wasteTarget) ? w.dieCut2Waste : null,
      };
    });
  }, [weekData, oeeTarget, wasteTarget, calConfig, startDate, endDate]);

  // ─── CUSTOM XAXIS TICK ─────────────────────────────────────────────────
  const renderCustomTick = (props: any) => {
    const { x, y, index } = props;
    const entry = chartData[index];
    if (!entry) return <g />;

    // Width to match both bars (2 × 36 + ~4 gap = 76)
    const bracketW = 76;
    const half = bracketW / 2;
    const rangeY = 22; // vertical position for the bracket line

    // Extract just the numbers from dayRangeLabel e.g. "[13 - 17]" -> "13 - 17"
    const rangeInner = entry.dayRangeLabel.replace(/[\[\]]/g, '');

    return (
      <g transform={`translate(${x},${y})`}>
        {/* Week number — bold black */}
        <text x={0} y={0} dy={4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#000000">
          {entry.weekLabel}
        </text>

        {/* Left bracket — large bold */}
        <text x={-half} y={rangeY} textAnchor="middle" fontSize={16} fontWeight={900} fill="#000000">
          [
        </text>
        {/* Day range numbers — bold black centered */}
        <text x={0} y={rangeY} textAnchor="middle" fontSize={11} fontWeight={700} fill="#000000">
          {rangeInner}
        </text>
        {/* Right bracket — large bold */}
        <text x={half} y={rangeY} textAnchor="middle" fontSize={16} fontWeight={900} fill="#000000">
          ]
        </text>
      </g>
    );
  };

  // Custom dot that turns red if point is below target
  const renderDc1Dot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload?.dieCut1Oee) return <circle cx={0} cy={0} r={0} fill="transparent" />;
    const below = payload.dieCut1Oee < oeeTarget;
    return (
      <circle cx={cx} cy={cy} r={6}
        fill={below ? '#ef4444' : '#3b82f6'} stroke="#fff" strokeWidth={2}
      />
    );
  };

  const renderDc2Dot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload?.dieCut2Oee) return <circle cx={0} cy={0} r={0} fill="transparent" />;
    const below = payload.dieCut2Oee < oeeTarget;
    return (
      <circle cx={cx} cy={cy} r={6}
        fill={below ? '#ef4444' : '#10b981'} stroke="#fff" strokeWidth={2}
      />
    );
  };

  // Waste dot renderers — red when ABOVE waste target (lower is better)
  const renderDc1WasteDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload?.dieCut1Waste) return <circle cx={0} cy={0} r={0} fill="transparent" />;
    const above = payload.dieCut1Waste > wasteTarget;
    return (
      <circle cx={cx} cy={cy} r={6}
        fill={above ? '#ef4444' : '#3b82f6'} stroke="#fff" strokeWidth={2}
      />
    );
  };

  const renderDc2WasteDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload?.dieCut2Waste) return <circle cx={0} cy={0} r={0} fill="transparent" />;
    const above = payload.dieCut2Waste > wasteTarget;
    return (
      <circle cx={cx} cy={cy} r={6}
        fill={above ? '#ef4444' : '#10b981'} stroke="#fff" strokeWidth={2}
      />
    );
  };

  // Format date range in readable words
  const formattedRange = useMemo(() => {
    if (!startDate || !endDate) return '';
    const fmt = (d: string) => {
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    };
    return `${fmt(startDate)}  –  ${fmt(endDate)}`;
  }, [startDate, endDate]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{PERIOD_CHART_STYLES}</style>

      {/* ─── LOADING STATE ────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500 animate-pulse">Loading period data...</p>
        </div>
      )}

      {/* ─── FULL-WIDTH OEE COMPARISON CHART ──────────────────────────────── */}
      {loaded && (
        <>
        <div className="period-chart-section mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                OEE Comparison — Die Cut 1 vs Die Cut 2
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Weekly average OEE (Both Shifts) • {weekData.length} week{weekData.length !== 1 ? 's' : ''} shown
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
              <p className="text-2xl font-black text-black dark:text-white tracking-tight">
                OEE Target: {oeeTarget}%
              </p>
            </div>
            {formattedRange && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                <p className="text-xs font-bold text-gray-900 dark:text-white tracking-wide">
                  {formattedRange}
                </p>
              </div>
            )}
          </div>

          {weekData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <Calendar className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No data found for the selected period</p>
              <p className="text-xs mt-1">Try adjusting your date range</p>
            </div>
          ) : (
            <div className="w-full">
              <ResponsiveContainer width="100%" height={490}>
                <ComposedChart data={chartData} margin={{ top: 30, right: 20, left: 0, bottom: 10 }}>
                  <defs>
                    {/* DC1 trend gradient — segments will use conditional coloring */}
                    <linearGradient id="dc1TrendGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                    <linearGradient id="dc2TrendGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="weekLabel"
                    tick={renderCustomTick}
                    interval={0}
                    tickMargin={18}
                    height={90}
                  />
                  <YAxis
                    domain={[0, 120]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <Tooltip content={<PeriodChartTooltip oeeTarget={oeeTarget} />} />

                  {/* Target reference line (dotted) */}
                  <ReferenceLine
                    y={oeeTarget}
                    stroke="#6366f1"
                    strokeDasharray="8 4"
                    strokeWidth={2}
                    label={{
                      value: `Target ${oeeTarget}%`,
                      position: 'insideTopRight',
                      fill: '#6366f1',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />

                  {/* Die Cut 1 Bars */}
                  <Bar
                    dataKey="dieCut1Oee"
                    name="Die Cut 1"
                    barSize={36}
                    shape={(props: any) => <DieCut1Bar {...props} oeeTarget={oeeTarget} />}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    <LabelList
                      dataKey="dieCut1Oee"
                      position="top"
                      style={{ fontSize: 10, fontWeight: 700, fill: '#1e40af' }}
                      formatter={(v: number) => v > 0 ? `${v}%` : ''}
                    />
                  </Bar>

                  {/* Die Cut 2 Bars */}
                  <Bar
                    dataKey="dieCut2Oee"
                    name="Die Cut 2"
                    barSize={36}
                    shape={(props: any) => <DieCut2Bar {...props} oeeTarget={oeeTarget} />}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    <LabelList
                      dataKey="dieCut2Oee"
                      position="top"
                      style={{ fontSize: 10, fontWeight: 700, fill: '#047857' }}
                      formatter={(v: number) => v > 0 ? `${v}%` : ''}
                    />
                  </Bar>

                  {/* Die Cut 1 Trend Line (blue — full) */}
                  <Line
                    dataKey="dc1Trend"
                    name="DC1 Trend"
                    type="monotone"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={renderDc1Dot}
                    activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
                    connectNulls
                    animationDuration={1600}
                    animationEasing="ease-in-out"
                  />

                  {/* Die Cut 1 Red Overlay — only below-target segments */}
                  <Line
                    dataKey="dc1TrendRed"
                    name="dc1Red"
                    type="monotone"
                    stroke="#ef4444"
                    strokeWidth={3}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                    legendType="none"
                    animationDuration={1600}
                  />

                  {/* Die Cut 2 Trend Line (green — full) */}
                  <Line
                    dataKey="dc2Trend"
                    name="DC2 Trend"
                    type="monotone"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={renderDc2Dot}
                    activeDot={{ r: 8, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                    connectNulls
                    animationDuration={1600}
                    animationEasing="ease-in-out"
                  />

                  {/* Die Cut 2 Red Overlay — only below-target segments */}
                  <Line
                    dataKey="dc2TrendRed"
                    name="dc2Red"
                    type="monotone"
                    stroke="#ef4444"
                    strokeWidth={3}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                    legendType="none"
                    animationDuration={1600}
                  />

                  <Legend
                    content={() => (
                      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-3 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ background: 'linear-gradient(to bottom, #60a5fa, #2563eb)' }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">Die Cut 1</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ background: 'linear-gradient(to bottom, #34d399, #059669)' }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">Die Cut 2</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-5 border-t-2 border-solid" style={{ borderColor: '#3b82f6' }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">DC1 Trend</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-5 border-t-2 border-solid" style={{ borderColor: '#10b981' }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">DC2 Trend</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: '#6366f1' }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">Target ({oeeTarget}%)</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-red-500 animate-pulse" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">Below Target</span>
                        </span>
                      </div>
                    )}
                  />
                </ComposedChart>
              </ResponsiveContainer>


            </div>
          )}
        </div>

        {/* ─── FULL-WIDTH WASTE COMPARISON CHART ─────────────────────────────── */}
        <div className="period-chart-section mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Waste Comparison — Die Cut 1 vs Die Cut 2
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Weekly average Waste % (Both Shifts) • {weekData.length} week{weekData.length !== 1 ? 's' : ''} shown
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
              <p className="text-2xl font-black text-black dark:text-white tracking-tight">
                Waste Target: ≤{wasteTarget}%
              </p>
            </div>
            {formattedRange && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                <p className="text-xs font-bold text-gray-900 dark:text-white tracking-wide">
                  {formattedRange}
                </p>
              </div>
            )}
          </div>

          {weekData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <Calendar className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No waste data found for the selected period</p>
              <p className="text-xs mt-1">Try adjusting your date range</p>
            </div>
          ) : (
            <div className="w-full">
              <ResponsiveContainer width="100%" height={490}>
                <ComposedChart data={chartData} margin={{ top: 30, right: 20, left: 0, bottom: 10 }}>
                  <defs>
                    <linearGradient id="dc1WasteTrendGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                    <linearGradient id="dc2WasteTrendGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="weekLabel"
                    tick={renderCustomTick}
                    interval={0}
                    tickMargin={18}
                    height={90}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <Tooltip content={<PeriodWasteTooltip wasteTarget={wasteTarget} />} />

                  {/* Waste target reference line (dotted) */}
                  <ReferenceLine
                    y={wasteTarget}
                    stroke="#f59e0b"
                    strokeDasharray="8 4"
                    strokeWidth={2}
                    label={{
                      value: `Target ≤${wasteTarget}%`,
                      position: 'insideTopRight',
                      fill: '#f59e0b',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />

                  {/* DC1 Waste Bars */}
                  <Bar
                    dataKey="dieCut1Waste"
                    name="DC1 Waste"
                    barSize={36}
                    shape={(props: any) => <WasteDC1Bar {...props} wasteTarget={wasteTarget} />}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    <LabelList
                      dataKey="dieCut1Waste"
                      position="top"
                      style={{ fontSize: 10, fontWeight: 700, fill: '#1e40af' }}
                      formatter={(v: number) => v > 0 ? `${v}%` : ''}
                    />
                  </Bar>

                  {/* DC2 Waste Bars */}
                  <Bar
                    dataKey="dieCut2Waste"
                    name="DC2 Waste"
                    barSize={36}
                    shape={(props: any) => <WasteDC2Bar {...props} wasteTarget={wasteTarget} />}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    <LabelList
                      dataKey="dieCut2Waste"
                      position="top"
                      style={{ fontSize: 10, fontWeight: 700, fill: '#047857' }}
                      formatter={(v: number) => v > 0 ? `${v}%` : ''}
                    />
                  </Bar>

                  {/* DC1 Waste Trend Line */}
                  <Line
                    dataKey="dc1WasteTrend"
                    name="DC1 Waste Trend"
                    type="monotone"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={renderDc1WasteDot}
                    activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
                    connectNulls
                    animationDuration={1600}
                    animationEasing="ease-in-out"
                  />

                  {/* DC1 Waste Red Overlay — only above-target segments */}
                  <Line
                    dataKey="dc1WasteAbove"
                    name="dc1WasteRed"
                    type="monotone"
                    stroke="#ef4444"
                    strokeWidth={3}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                    legendType="none"
                    animationDuration={1600}
                  />

                  {/* DC2 Waste Trend Line */}
                  <Line
                    dataKey="dc2WasteTrend"
                    name="DC2 Waste Trend"
                    type="monotone"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={renderDc2WasteDot}
                    activeDot={{ r: 8, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                    connectNulls
                    animationDuration={1600}
                    animationEasing="ease-in-out"
                  />

                  {/* DC2 Waste Red Overlay — only above-target segments */}
                  <Line
                    dataKey="dc2WasteAbove"
                    name="dc2WasteRed"
                    type="monotone"
                    stroke="#ef4444"
                    strokeWidth={3}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                    legendType="none"
                    animationDuration={1600}
                  />

                  <Legend
                    content={() => (
                      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-3 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ background: 'linear-gradient(to bottom, #60a5fa, #2563eb)' }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">DC1 Waste</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ background: 'linear-gradient(to bottom, #34d399, #059669)' }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">DC2 Waste</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-5 border-t-2 border-solid" style={{ borderColor: '#3b82f6' }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">DC1 Trend</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-5 border-t-2 border-solid" style={{ borderColor: '#10b981' }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">DC2 Trend</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: '#f59e0b' }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">Target (≤{wasteTarget}%)</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-red-500 animate-pulse" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">Above Target</span>
                        </span>
                      </div>
                    )}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        </>
      )}
    </>
  );
}
