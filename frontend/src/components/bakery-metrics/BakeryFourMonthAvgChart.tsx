'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import api from '@/lib/api';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, LabelList, ComposedChart, Line,
} from 'recharts';
import {
  Calendar, Loader2,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
interface PeriodData {
  periodLabel: string;
  periodNum: number;
  dieCut1Oee: number;
  dieCut2Oee: number;
  avgOee: number;
  weekCount: number;
  hasData: boolean;
  startDate: string;
  endDate: string;
}

interface YtdData {
  dieCut1Oee: number;
  dieCut2Oee: number;
  avgOee: number;
  totalDays: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════════
const FOUR_MONTH_STYLES = `
@keyframes blinkOutline4m {
  0%, 100% { stroke-opacity: 1; }
  50% { stroke-opacity: 0.2; }
}
@keyframes fourMonthFadeIn {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.four-month-section { animation: fourMonthFadeIn 0.5s cubic-bezier(.22,1,.36,1) both; }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM TOOLTIP
// ═══════════════════════════════════════════════════════════════════════════════
const FourMonthTooltip = ({ active, payload, label, oeeTarget }: any) => {
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
// CUSTOM BAR SHAPES
// ═══════════════════════════════════════════════════════════════════════════════
const DC1Bar4m = (props: any) => {
  const { x, y, width, height, value, oeeTarget } = props;
  if (!height || height <= 0) return null;
  const belowTarget = value < oeeTarget && value > 0;
  const gradId = `dc1Grad4m_${x}_${y}`;
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
          style={{ animation: 'blinkOutline4m 1s ease-in-out infinite' }}
        />
      )}
      <text x={x + width / 2} y={y + height + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#1e40af">
        DC1
      </text>
    </g>
  );
};

const DC2Bar4m = (props: any) => {
  const { x, y, width, height, value, oeeTarget } = props;
  if (!height || height <= 0) return null;
  const belowTarget = value < oeeTarget && value > 0;
  const gradId = `dc2Grad4m_${x}_${y}`;
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
          style={{ animation: 'blinkOutline4m 1s ease-in-out infinite' }}
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
export default function BakeryFourMonthAvgChart() {
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [ytd, setYtd] = useState<YtdData | null>(null);
  const [oeeTarget, setOeeTarget] = useState(70);
  const [businessYearStart, setBusinessYearStart] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // ─── FETCH DATA ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoaded(false);
    try {
      const res = await api.get('/bakery-metrics/four-month-avg-ytd');
      if (res.data.success) {
        setPeriods(res.data.periods || []);
        setYtd(res.data.ytd || null);
        setOeeTarget(res.data.oeeTarget ?? 70);
        setBusinessYearStart(res.data.businessYearStart || '');
        setLoaded(true);
      }
    } catch (err) {
      console.error('Four-month average YTD fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── CHART DATA ─────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const items: {
      label: string;
      subLabel: string;
      dieCut1Oee: number;
      dieCut2Oee: number;
      dc1Trend: number | null;
      dc2Trend: number | null;
      isYtd: boolean;
    }[] = [];

    for (const p of periods) {
      items.push({
        label: p.periodLabel,
        subLabel: `Period ${p.periodNum}`,
        dieCut1Oee: p.dieCut1Oee,
        dieCut2Oee: p.dieCut2Oee,
        dc1Trend: p.dieCut1Oee || null,
        dc2Trend: p.dieCut2Oee || null,
        isYtd: false,
      });
    }

    // Add YTD summary bar
    if (ytd) {
      items.push({
        label: 'YTD',
        subLabel: 'Year to Date',
        dieCut1Oee: ytd.dieCut1Oee,
        dieCut2Oee: ytd.dieCut2Oee,
        dc1Trend: ytd.dieCut1Oee || null,
        dc2Trend: ytd.dieCut2Oee || null,
        isYtd: true,
      });
    }

    return items;
  }, [periods, ytd]);

  // ─── CUSTOM XAXIS TICK ─────────────────────────────────────────────────
  const renderCustomTick = (props: any) => {
    const { x, y, index } = props;
    const entry = chartData[index];
    if (!entry) return <g />;

    return (
      <g transform={`translate(${x},${y})`}>
        {/* Period label — bold */}
        <text x={0} y={0} dy={4} textAnchor="middle" fontSize={13} fontWeight={800} fill={entry.isYtd ? '#6366f1' : '#000000'}>
          {entry.label}
        </text>
        {/* Sub-label */}
        <text x={0} y={18} textAnchor="middle" fontSize={10} fontWeight={600} fill={entry.isYtd ? '#818cf8' : '#6b7280'}>
          {entry.subLabel}
        </text>
      </g>
    );
  };

  // Custom dots
  const renderDc1Dot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload?.dieCut1Oee) return <circle cx={0} cy={0} r={0} fill="transparent" />;
    const below = payload.dieCut1Oee < oeeTarget;
    return (
      <circle cx={cx} cy={cy} r={7}
        fill={below ? '#ef4444' : '#3b82f6'} stroke="#fff" strokeWidth={2}
      />
    );
  };

  const renderDc2Dot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload?.dieCut2Oee) return <circle cx={0} cy={0} r={0} fill="transparent" />;
    const below = payload.dieCut2Oee < oeeTarget;
    return (
      <circle cx={cx} cy={cy} r={7}
        fill={below ? '#ef4444' : '#10b981'} stroke="#fff" strokeWidth={2}
      />
    );
  };

  // Format business year range
  const formattedYearRange = useMemo(() => {
    if (!businessYearStart) return '';
    const start = new Date(businessYearStart + 'T00:00:00');
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);
    const now = new Date();
    const effectiveEnd = end > now ? now : end;
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return `${fmt(start)}  –  ${fmt(effectiveEnd)}`;
  }, [businessYearStart]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{FOUR_MONTH_STYLES}</style>

      {/* ─── LOADING STATE ────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500 animate-pulse">Loading 4-month average data...</p>
        </div>
      )}

      {/* ─── CHART ─────────────────────────────────────────────────────────── */}
      {loaded && (
        <div className="four-month-section mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                4-Month Average OEE — Die Cut 1 vs Die Cut 2
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Business year divided into 4-month periods • {periods.filter(p => p.hasData).length} period{periods.filter(p => p.hasData).length !== 1 ? 's' : ''} with data
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
              <p className="text-2xl font-black text-black dark:text-white tracking-tight">
                OEE Target: {oeeTarget}%
              </p>
            </div>
            {formattedYearRange && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                <p className="text-xs font-bold text-gray-900 dark:text-white tracking-wide">
                  {formattedYearRange}
                </p>
              </div>
            )}
          </div>

          {chartData.length === 0 || !chartData.some(d => d.dieCut1Oee > 0 || d.dieCut2Oee > 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <Calendar className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No data found for the current business year</p>
              <p className="text-xs mt-1">Data will appear as weekly submissions are recorded</p>
            </div>
          ) : (
            <div className="w-full">
              <ResponsiveContainer width="100%" height={490}>
                <ComposedChart data={chartData} margin={{ top: 30, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    tick={renderCustomTick}
                    interval={0}
                    tickMargin={18}
                    height={70}
                  />
                  <YAxis
                    domain={[0, 120]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <Tooltip content={<FourMonthTooltip oeeTarget={oeeTarget} />} />

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
                    barSize={52}
                    shape={(props: any) => <DC1Bar4m {...props} oeeTarget={oeeTarget} />}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    <LabelList
                      dataKey="dieCut1Oee"
                      position="top"
                      style={{ fontSize: 11, fontWeight: 700, fill: '#1e40af' }}
                      formatter={(v: number) => v > 0 ? `${v}%` : ''}
                    />
                  </Bar>

                  {/* Die Cut 2 Bars */}
                  <Bar
                    dataKey="dieCut2Oee"
                    name="Die Cut 2"
                    barSize={52}
                    shape={(props: any) => <DC2Bar4m {...props} oeeTarget={oeeTarget} />}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    <LabelList
                      dataKey="dieCut2Oee"
                      position="top"
                      style={{ fontSize: 11, fontWeight: 700, fill: '#047857' }}
                      formatter={(v: number) => v > 0 ? `${v}%` : ''}
                    />
                  </Bar>

                  {/* DC1 Trend Line */}
                  <Line
                    dataKey="dc1Trend"
                    name="DC1 Trend"
                    type="monotone"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={renderDc1Dot}
                    activeDot={{ r: 9, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
                    connectNulls
                    animationDuration={1600}
                    animationEasing="ease-in-out"
                  />

                  {/* DC2 Trend Line */}
                  <Line
                    dataKey="dc2Trend"
                    name="DC2 Trend"
                    type="monotone"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={renderDc2Dot}
                    activeDot={{ r: 9, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                    connectNulls
                    animationDuration={1600}
                    animationEasing="ease-in-out"
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

              {/* ─── PERIOD SUMMARY CARDS ──────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {periods.map((p, i) => (
                  <div key={i} className={`rounded-lg border p-3 text-center ${p.hasData ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600' : 'bg-gray-50/50 border-gray-100 dark:bg-gray-800/50 dark:border-gray-700 opacity-50'}`}>
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Period {p.periodNum}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{p.periodLabel}</p>
                    {p.hasData ? (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <span className="inline-block w-2 h-2 rounded-sm bg-blue-500" />
                          <span className="text-gray-600 dark:text-gray-300">DC1: <strong>{p.dieCut1Oee}%</strong></span>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
                          <span className="text-gray-600 dark:text-gray-300">DC2: <strong>{p.dieCut2Oee}%</strong></span>
                        </div>
                        <p className="text-[10px] text-gray-400">{p.weekCount} week{p.weekCount !== 1 ? 's' : ''}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2 italic">No data yet</p>
                    )}
                  </div>
                ))}
                {ytd && (
                  <div className="rounded-lg border-2 border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 p-3 text-center">
                    <p className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Year to Date</p>
                    <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">YTD Average</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <span className="inline-block w-2 h-2 rounded-sm bg-blue-500" />
                        <span className="text-indigo-600 dark:text-indigo-300">DC1: <strong>{ytd.dieCut1Oee}%</strong></span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
                        <span className="text-indigo-600 dark:text-indigo-300">DC2: <strong>{ytd.dieCut2Oee}%</strong></span>
                      </div>
                      <p className="text-[10px] text-indigo-400">Overall: {ytd.avgOee}%</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
