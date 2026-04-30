'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api, { apiWithExtendedTimeout } from '@/lib/api';
import {
  Users,
  Calendar,
  Loader2,
  Sparkles,
  Gauge,
  Package,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Zap,
  MessageSquare,
  Save,
  RefreshCw,
  Wand2,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  X,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TargetDay {
  weekName: string;
  dayOfWeek: string;
  targetDate: string;
  targetDateLabel: string;
  weekStart: string;
  weekEnd: string;
  currentDate: string;
  currentDateLabel: string;
  currentDayOfWeek: string;
  timeZone: string;
  serverNow: string;
  weekExists: boolean;
}

interface StandupReport {
  opening: string;
  oeeSection: {
    narrative: string;
    dieCut1: number | null;
    dieCut2: number | null;
    average: number | null;
    target: number;
    tone: 'strong' | 'mixed' | 'weak';
  };
  volumeSection: {
    narrative: string;
    dieCut1Lbs: number | null;
    dieCut2Lbs: number | null;
    totalLbs: number | null;
    target: number;
    tone: 'strong' | 'mixed' | 'weak';
  };
  wasteSection: {
    narrative: string;
    averagePct: number | null;
    dieCut1Pct: number | null;
    dieCut2Pct: number | null;
    target: number;
    tone: 'strong' | 'mixed' | 'weak';
  };
  issuesSection: {
    narrative: string;
    items: Array<{
      title: string;
      summary: string;
      line?: string | null;
      priority?: string;
      minutesLost?: number | null;
    }>;
  };
  startupSection: {
    narrative: string;
    items: Array<{ line: string; note: string }>;
  };
  closing: string;
  overallSentiment?: 'positive' | 'mixed' | 'cautious' | 'concerned';
  _meta?: { weekName: string; dayOfWeek: string; generatedAt: string; model: string };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtNum = (n: number | null | undefined, suffix = '') =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;

const parseDateLike = (value: string): Date => {
  const trimmed = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00Z`);
  }
  return new Date(trimmed);
};

const toneToClasses = (tone?: string) => {
  switch (tone) {
    case 'strong':
      return {
        accent: 'text-emerald-700 dark:text-emerald-300',
        chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/30',
        iconWrap: 'bg-gradient-to-br from-emerald-400/90 to-teal-500/90 text-white',
        icon: <TrendingUp className="w-4 h-4" />,
      };
    case 'weak':
      return {
        accent: 'text-rose-700 dark:text-rose-300',
        chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-400/30',
        iconWrap: 'bg-gradient-to-br from-rose-400/90 to-pink-500/90 text-white',
        icon: <TrendingDown className="w-4 h-4" />,
      };
    default:
      return {
        accent: 'text-slate-700 dark:text-slate-200',
        chip: 'bg-slate-500/15 text-slate-700 dark:text-slate-200 ring-1 ring-slate-400/30',
        iconWrap: 'bg-gradient-to-br from-slate-400/90 to-slate-600/90 text-white',
        icon: <Minus className="w-4 h-4" />,
      };
  }
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function BakeryStandupMeetingReport() {
  const [target, setTarget] = useState<TargetDay | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(true);
  const [report, setReport] = useState<StandupReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState<Date>(new Date());

  const [comments, setComments] = useState('');
  const [initialComments, setInitialComments] = useState('');
  const [commentsUpdatedBy, setCommentsUpdatedBy] = useState<string | null>(null);
  const [commentsUpdatedAt, setCommentsUpdatedAt] = useState<string | null>(null);
  const [savingComments, setSavingComments] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [generatedBy, setGeneratedBy] = useState<string | null>(null);
  const [source, setSource] = useState<'database' | 'generated' | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  // ─── Fetch target day + existing report on mount ──────────────────────
  const loadExisting = useCallback(async (t: TargetDay) => {
    try {
      const res = await api.get('/bakery-metrics/standup-report', {
        params: { weekName: t.weekName, dayOfWeek: t.dayOfWeek },
      });
      if (res.data?.exists && res.data?.data) {
        setReport(res.data.data);
        setComments(res.data.supervisorComments || '');
        setInitialComments(res.data.supervisorComments || '');
        setCommentsUpdatedBy(res.data.commentsUpdatedBy || null);
        setCommentsUpdatedAt(res.data.commentsUpdatedAt || null);
        setSavedAt(res.data.savedAt || null);
        setGeneratedBy(res.data.generatedBy || null);
        setSource('database');
      }
    } catch {
      // silent — no existing report
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingTarget(true);
      try {
        const res = await api.get('/bakery-metrics/standup-report/target-day');
        if (!active) return;
        if (res.data?.success) {
          const t: TargetDay = {
            weekName: res.data.weekName,
            dayOfWeek: res.data.dayOfWeek,
            targetDate: res.data.targetDate,
            targetDateLabel: res.data.targetDateLabel || '',
            weekStart: res.data.weekStart,
            weekEnd: res.data.weekEnd,
            currentDate: res.data.currentDate || res.data.targetDate,
            currentDateLabel: res.data.currentDateLabel || '',
            currentDayOfWeek: res.data.currentDayOfWeek || '',
            timeZone: res.data.timeZone || 'America/Chicago',
            serverNow: res.data.serverNow || new Date().toISOString(),
            weekExists: res.data.weekExists,
          };
          setTarget(t);
          if (t.serverNow) {
            const serverNow = new Date(t.serverNow);
            if (!Number.isNaN(serverNow.getTime())) {
              setClockNow(serverNow);
            }
          }
          await loadExisting(t);
        }
      } catch (err: any) {
        setErrorMsg('Failed to determine the target day for the standup report.');
      } finally {
        if (active) setLoadingTarget(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadExisting]);

  // ─── Generate / Regenerate ────────────────────────────────────────────
  const [progressMode, setProgressMode] = useState<null | 'generate' | 'regenerate'>(null);
  const [progressPct, setProgressPct] = useState(0);
  const progressRafRef = useRef<number | null>(null);
  const progressTargetRef = useRef(0);

  const animateProgressTo = useCallback((target: number) => {
    progressTargetRef.current = target;
    if (progressRafRef.current) return;
    const tick = () => {
      setProgressPct((cur) => {
        const tgt = progressTargetRef.current;
        if (cur >= tgt) {
          progressRafRef.current = null;
          return cur;
        }
        const step = Math.max(0.4, (tgt - cur) * 0.06);
        const next = Math.min(tgt, cur + step);
        progressRafRef.current = requestAnimationFrame(tick);
        return next;
      });
    };
    progressRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    };
  }, []);

  const handleGenerate = async (regenerate = false) => {
    if (!target) return;
    setGenerating(true);
    setErrorMsg(null);
    setProgressMode(regenerate ? 'regenerate' : 'generate');
    setProgressPct(0);
    progressTargetRef.current = 0;
    animateProgressTo(20);
    // Creep toward 85% while waiting for the AI response
    const creep = setInterval(() => {
      if (progressTargetRef.current < 85) {
        animateProgressTo(Math.min(85, progressTargetRef.current + 10));
      }
    }, 900);
    try {
      const data: any = await apiWithExtendedTimeout({
        method: 'POST',
        url: '/bakery-metrics/standup-report',
        data: {
          weekName: target.weekName,
          dayOfWeek: target.dayOfWeek,
          reportDate: target.targetDate,
          regenerate,
        },
      });
      clearInterval(creep);
      animateProgressTo(100);
      if (data?.success && data?.data) {
        setReport(data.data);
        setSource(data.source || 'generated');
        setSavedAt(data.savedAt || null);
        setGeneratedBy(data.generatedBy || null);
        if (typeof data.supervisorComments === 'string') {
          setComments(data.supervisorComments);
          setInitialComments(data.supervisorComments);
        }
        setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      } else {
        setErrorMsg(data?.error || 'Failed to generate the standup report.');
      }
    } catch (err: any) {
      clearInterval(creep);
      animateProgressTo(100);
      setErrorMsg(err?.response?.data?.error || 'Something went wrong while generating the report.');
    } finally {
      setGenerating(false);
      // Hold briefly at 100% so the user sees completion, then close
      setTimeout(() => {
        setProgressMode(null);
        setProgressPct(0);
        progressTargetRef.current = 0;
      }, 600);
    }
  };

  // ─── Save supervisor comments ─────────────────────────────────────────
  const saveComments = async () => {
    if (!target) return;
    setSavingComments(true);
    try {
      const res = await api.patch('/bakery-metrics/standup-report/comments', {
        weekName: target.weekName,
        dayOfWeek: target.dayOfWeek,
        comments,
      });
      if (res.data?.success) {
        setInitialComments(res.data.supervisorComments || '');
        setCommentsUpdatedBy(res.data.commentsUpdatedBy || null);
        setCommentsUpdatedAt(res.data.commentsUpdatedAt || null);
      }
    } catch {
      // no-op toast for now
    } finally {
      setSavingComments(false);
    }
  };

  const commentsDirty = comments !== initialComments;

  // ─── Delete saved report ─────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!target) {
      setErrorMsg('No target day resolved — cannot delete.');
      return;
    }
    console.log('[StandupReport] Delete clicked', { weekName: target.weekName, dayOfWeek: target.dayOfWeek });
    setDeleting(true);
    setErrorMsg(null);
    try {
      const resp = await api.post(
        '/bakery-metrics/standup-report/delete',
        { weekName: target.weekName, dayOfWeek: target.dayOfWeek },
        { timeout: 15000 },
      );
      console.log('[StandupReport] Delete response', resp?.data);
      // Reset local state so the user lands back on the Generate screen
      setReport(null);
      setComments('');
      setInitialComments('');
      setCommentsUpdatedBy(null);
      setCommentsUpdatedAt(null);
      setSavedAt(null);
      setGeneratedBy(null);
      setSource(null);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error('[StandupReport] Delete failed', err, err?.response?.data);
      const serverMsg = err?.response?.data?.error;
      const status = err?.response?.status;
      setErrorMsg(
        serverMsg
          ? `Delete failed (${status}): ${serverMsg}`
          : err?.message || 'Failed to delete the standup report.'
      );
    } finally {
      setDeleting(false);
    }
  };

  // ─── Pre-generation landing view ──────────────────────────────────────
  if (loadingTarget) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  const displayTimeZone = target?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const formattedTargetDate = target?.targetDateLabel
    || (target
      ? parseDateLike(target.targetDate).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : '');
  const formattedCurrentDate = target?.currentDateLabel
    || (target
      ? parseDateLike(target.currentDate).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : '');
  const liveSystemClock = clockNow.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone: displayTimeZone,
    timeZoneName: 'short',
  });

  return (
    <div className={`w-full px-2 sm:px-4 ${!report ? 'h-[calc(100vh-260px)] overflow-hidden flex flex-col items-center justify-center' : 'pb-12'}`}>
      {/* Top description — only when no report has been generated yet */}
      {!report && (
        <div className="text-center px-4 pb-6 w-full">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent animate-fade-in">
            Standup Meeting Report
          </h2>
          <p className="mt-3 max-w-2xl mx-auto text-sm text-gray-500/90 dark:text-gray-400/90 leading-relaxed animate-fade-in-delayed">
            Generate a daily performance report based on the previous production day. Numbers and issues are pulled live from the floor.
          </p>

          {target && (
            <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 shadow-sm">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-semibold text-gray-800 dark:text-gray-200">Previous working day: {formattedTargetDate}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 shadow-sm">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Current day: {formattedCurrentDate}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600 dark:text-gray-400">{target.weekName}</span>
              </span>
              {!target.weekExists && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Week sheet not yet created
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {target && (
        <div className={`w-full text-center text-[12px] text-gray-600 dark:text-gray-300 ${report ? 'mb-2' : 'mb-4'}`}>
          System clock ({displayTimeZone}): <span className="font-semibold text-gray-800 dark:text-gray-100">{liveSystemClock}</span>
        </div>
      )}

      {/* Generate button (centered) */}
      {!report && (
        <div className="flex flex-col items-center justify-center py-4 animate-pop-in">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 rounded-2xl blur-lg opacity-60 group-hover:opacity-90 transition-opacity animate-gradient-pulse" />
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating || !target}
              className="relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold text-base shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-70 disabled:cursor-wait"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating report…
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Generate Report
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="mt-6 max-w-md text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg px-4 py-3 animate-fade-in">
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* Report View */}
      {report && (
        <div ref={reportRef} className="space-y-5">
          {/* Header strip with regenerate */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white/60 dark:bg-gray-800/40 backdrop-blur-xl ring-1 ring-white/50 dark:ring-white/10 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] animate-slide-down">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-slate-400/90 to-slate-600/90 text-white shadow-sm">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold">
                {source === 'database' ? 'Saved report' : 'Report generated'}
              </span>
              {generatedBy && <span className="text-gray-500">· by {generatedBy}</span>}
              {savedAt && (
                <span className="text-gray-500">· {new Date(savedAt).toLocaleString()}</span>
              )}
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={generating || deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-white/70 dark:bg-gray-800/70 ring-1 ring-rose-200 dark:ring-rose-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 shadow-sm transition-colors active:scale-95 disabled:opacity-60"
              title="Delete this saved report"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete Report
            </button>
          </div>

          {/* Unified Report Card — all sections, dividers between them */}
          <div className="relative p-5 sm:p-6 rounded-2xl bg-white/60 dark:bg-gray-800/40 backdrop-blur-xl ring-1 ring-white/50 dark:ring-white/10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.25)] hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] transition-shadow animate-section-in">
            <div className="divide-y divide-black dark:divide-black">

              {/* Opening */}
              <ReportSection
                icon={<Users className="w-4 h-4" />}
                iconWrap="bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                iconAnim="animate-icon-bounce"
                label="Opening"
                accent="text-amber-700 dark:text-amber-300"
                first
              >
                <p className="text-[13px] text-gray-800 dark:text-gray-100 leading-relaxed">{report.opening}</p>
              </ReportSection>

              {/* OEE */}
              <ReportSection
                icon={<Gauge className="w-4 h-4" />}
                iconWrap={toneToClasses(report.oeeSection?.tone).iconWrap}
                iconAnim="animate-icon-spin-slow"
                label="OEE · Overall Equipment Effectiveness"
                accent={toneToClasses(report.oeeSection?.tone).accent}
                tone={report.oeeSection?.tone}
              >
                <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">
                  {report.oeeSection?.narrative}
                </p>
                <BulletList
                  items={[
                    { label: 'Die Cut 1', value: fmtNum(report.oeeSection?.dieCut1, '%'), target: report.oeeSection?.target, actual: report.oeeSection?.dieCut1 },
                    { label: 'Die Cut 2', value: fmtNum(report.oeeSection?.dieCut2, '%'), target: report.oeeSection?.target, actual: report.oeeSection?.dieCut2 },
                    { label: 'Average', value: fmtNum(report.oeeSection?.average, '%'), target: report.oeeSection?.target, actual: report.oeeSection?.average, highlight: true },
                  ]}
                  footer={<>Target: <span className="font-semibold">≥ {report.oeeSection?.target}%</span></>}
                />
              </ReportSection>

              {/* Volume */}
              <ReportSection
                icon={<Package className="w-4 h-4" />}
                iconWrap={toneToClasses(report.volumeSection?.tone).iconWrap}
                iconAnim="animate-icon-float"
                label="Volume · Production Output"
                accent={toneToClasses(report.volumeSection?.tone).accent}
                tone={report.volumeSection?.tone}
              >
                <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">
                  {report.volumeSection?.narrative}
                </p>
                <BulletList
                  items={[
                    { label: 'Die Cut 1', value: fmtNum(report.volumeSection?.dieCut1Lbs, ' lbs') },
                    { label: 'Die Cut 2', value: fmtNum(report.volumeSection?.dieCut2Lbs, ' lbs') },
                    { label: 'Total', value: fmtNum(report.volumeSection?.totalLbs, ' lbs'), highlight: true },
                  ]}
                  footer={<>Target: <span className="font-semibold">≥ {Number(report.volumeSection?.target).toLocaleString()} lbs</span></>}
                />
              </ReportSection>

              {/* Waste */}
              <ReportSection
                icon={<Trash2 className="w-4 h-4" />}
                iconWrap={toneToClasses(report.wasteSection?.tone).iconWrap}
                iconAnim="animate-icon-wiggle"
                label="Waste · Material Loss %"
                accent={toneToClasses(report.wasteSection?.tone).accent}
                tone={report.wasteSection?.tone}
              >
                <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">
                  {report.wasteSection?.narrative}
                </p>
                <BulletList
                  items={[
                    { label: 'Die Cut 1', value: fmtNum(report.wasteSection?.dieCut1Pct, '%'), target: report.wasteSection?.target, actual: report.wasteSection?.dieCut1Pct, reverse: true },
                    { label: 'Die Cut 2', value: fmtNum(report.wasteSection?.dieCut2Pct, '%'), target: report.wasteSection?.target, actual: report.wasteSection?.dieCut2Pct, reverse: true },
                    { label: 'Average', value: fmtNum(report.wasteSection?.averagePct, '%'), target: report.wasteSection?.target, actual: report.wasteSection?.averagePct, reverse: true, highlight: true },
                  ]}
                  footer={<>Target: <span className="font-semibold">≤ {report.wasteSection?.target}%</span></>}
                />
              </ReportSection>

              {/* Issues */}
              <ReportSection
                icon={<AlertTriangle className="w-4 h-4" />}
                iconWrap="bg-gradient-to-br from-rose-400 to-orange-500 text-white"
                iconAnim="animate-icon-pulse-bounce"
                label="Issues from Yesterday"
                accent="text-rose-700 dark:text-rose-300"
              >
                <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">
                  {report.issuesSection?.narrative}
                </p>
                {report.issuesSection?.items?.length > 0 ? (
                  <ul className="mt-2.5 space-y-1.5">
                    {report.issuesSection.items.map((it, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-[12.5px] text-gray-700 dark:text-gray-200 animate-fade-up"
                        style={{ animationDelay: `${0.05 + idx * 0.04}s` }}
                      >
                        <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">{it.title}</span>
                            {it.priority && (
                              <span className={`px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wide ${priorityColor(it.priority)}`}>
                                {it.priority}
                              </span>
                            )}
                            {it.line && <span className="px-1.5 py-[1px] rounded text-[9px] bg-slate-500/15 text-slate-600 dark:text-slate-300 font-semibold">{it.line}</span>}
                            {it.minutesLost != null && (
                              <span className="px-1.5 py-[1px] rounded text-[9px] bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold">
                                {it.minutesLost}m lost
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-gray-600 dark:text-gray-300 leading-snug">{it.summary}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="w-3.5 h-3.5" /> No issues were logged.
                  </div>
                )}
              </ReportSection>

              {/* Startup */}
              <ReportSection
                icon={<Zap className="w-4 h-4" />}
                iconWrap={(report.startupSection?.items?.length || 0) > 0
                  ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white'
                  : 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white'}
                iconAnim="animate-icon-flash"
                label="Today's Startup Indicators"
                accent={(report.startupSection?.items?.length || 0) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}
              >
                <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">
                  {report.startupSection?.narrative}
                </p>
                {report.startupSection?.items?.length > 0 && (
                  <ul className="mt-2.5 space-y-1">
                    {report.startupSection.items.map((it, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-[12.5px] animate-fade-up"
                        style={{ animationDelay: `${0.05 + idx * 0.04}s` }}
                      >
                        <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide text-[10px] mr-1.5">{it.line}</span>
                          <span className="text-gray-700 dark:text-gray-200">{it.note}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </ReportSection>

              {/* Closing */}
              <ReportSection
                icon={<Sparkles className="w-4 h-4" />}
                iconWrap="bg-gradient-to-br from-indigo-400 to-blue-500 text-white"
                iconAnim="animate-icon-twinkle"
                label="Closing"
                accent="text-indigo-700 dark:text-indigo-300"
              >
                <p className="text-[13px] text-gray-800 dark:text-gray-100 leading-relaxed">{report.closing}</p>
              </ReportSection>

            </div>
          </div>

          {/* Supervisor Comments */}
          <div className="relative p-5 rounded-2xl bg-white/60 dark:bg-gray-800/40 backdrop-blur-xl ring-1 ring-white/50 dark:ring-white/10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.25)] hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] transition-shadow animate-section-in" style={{ animationDelay: '0.35s' }}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Supervisor Comments</h3>
              {commentsUpdatedBy && commentsUpdatedAt && (
                <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
                  Last updated by <span className="font-semibold">{commentsUpdatedBy}</span> · {new Date(commentsUpdatedAt).toLocaleString()}
                </span>
              )}
            </div>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add supervisor follow-ups, actions, or notes from the meeting…"
              rows={5}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-colors resize-y"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              {commentsDirty && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">Unsaved changes</span>
              )}
              <button
                onClick={saveComments}
                disabled={savingComments || !commentsDirty}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingComments ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Comments
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="max-w-md text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg px-4 py-3 animate-fade-in">
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* ── Generation / Regeneration Progress Modal (Animated Checklist) */}
      {progressMode && (() => {
        const steps: Array<{ key: string; label: string; threshold: number; icon: any }> = [
          { key: 'pull',     label: 'Pulling latest Both Shifts metrics',     threshold: 20, icon: Gauge },
          { key: 'analyze',  label: 'Analyzing performance and issues',       threshold: 55, icon: TrendingUp },
          { key: 'draft',    label: 'Drafting your supervisor briefing',      threshold: 85, icon: Wand2 },
          { key: 'finalize', label: 'Finalizing and saving the report',       threshold: 100, icon: Save },
        ];
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/10 overflow-hidden animate-pop-in">
              <div className="px-5 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 animate-icon-twinkle" />
                <h3 className="text-sm font-bold">
                  {progressMode === 'regenerate' ? 'Regenerating Standup Report' : 'Generating Standup Report'}
                </h3>
              </div>
              <div className="p-5 space-y-4">
                {/* Checklist */}
                <ul className="space-y-2">
                  {steps.map((s, idx) => {
                    const prevThreshold = idx === 0 ? 0 : steps[idx - 1].threshold;
                    const isCompleted = progressPct >= s.threshold;
                    const isActive = !isCompleted && progressPct >= prevThreshold;
                    const Icon = s.icon;
                    return (
                      <li
                        key={s.key}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-all ${
                          isCompleted
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                            : isActive
                              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700 opacity-60'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-500 text-white'
                            : isActive
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : isActive ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <span className={`text-sm flex-1 ${
                          isCompleted
                            ? 'text-emerald-800 dark:text-emerald-200 font-medium'
                            : isActive
                              ? 'text-amber-800 dark:text-amber-200 font-semibold'
                              : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {s.label}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 animate-pulse">
                            Working…
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                            Done
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 transition-[width] duration-200 ease-out"
                    style={{ width: `${Math.max(4, Math.min(100, progressPct))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{target?.dayOfWeek} · {target?.weekName}</span>
                  <span className="tabular-nums font-semibold">{Math.round(progressPct)}%</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delete Confirmation Modal ────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/10 overflow-hidden animate-pop-in">
            <div className="px-5 py-3 bg-gradient-to-r from-rose-500 to-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-bold">Delete Standup Report?</h3>
              </div>
              <button
                onClick={() => !deleting && setShowDeleteConfirm(false)}
                disabled={deleting}
                className="p-1 rounded-lg hover:bg-white/15 disabled:opacity-50"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                This will permanently remove the saved standup report for{' '}
                <span className="font-semibold">{target?.dayOfWeek}</span>{' '}
                <span className="text-gray-500">({target?.weekName})</span> from the database. This action cannot be undone.
              </p>
              {commentsDirty || initialComments ? (
                <p className="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  Supervisor comments attached to this report will also be deleted.
                </p>
              ) : null}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-rose-500 to-red-600 rounded-lg shadow hover:from-rose-600 hover:to-red-700 active:scale-95 transition-all disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {deleting ? 'Deleting…' : 'Delete Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in { animation: fadeIn 0.5s ease-out both; }
        .animate-fade-in-delayed { animation: fadeIn 0.7s ease-out 0.15s both; }

        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.85) translateY(10px); }
          60% { opacity: 1; transform: scale(1.04) translateY(-2px); }
          100% { transform: scale(1) translateY(0); }
        }
        .animate-pop-in { animation: popIn 0.55s cubic-bezier(0.22, 1.2, 0.36, 1) both; }

        @keyframes gradientPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.04); }
        }
        .animate-gradient-pulse { animation: gradientPulse 2.8s ease-in-out infinite; }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down { animation: slideDown 0.4s ease-out both; }

        @keyframes sectionIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-section-in { animation: sectionIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fadeUp 0.4s ease-out both; }

        @keyframes gentlePop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .animate-gentle-pop { animation: gentlePop 3.2s ease-in-out infinite; }

        /* ─── Icon animation loops (varied) ───────────────────────────── */
        @keyframes iconSpinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-icon-spin-slow { animation: iconSpinSlow 6s linear infinite; transform-origin: center; }

        @keyframes iconFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-3px) rotate(-4deg); }
          75% { transform: translateY(2px) rotate(4deg); }
        }
        .animate-icon-float { animation: iconFloat 3.4s ease-in-out infinite; transform-origin: center; }

        @keyframes iconBounce {
          0%, 80%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-5px) scale(1.05); }
          60% { transform: translateY(-2px) scale(1.02); }
        }
        .animate-icon-bounce { animation: iconBounce 2.6s ease-in-out infinite; transform-origin: center; }

        @keyframes iconWiggle {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-12deg); }
          40% { transform: rotate(10deg); }
          60% { transform: rotate(-6deg); }
          80% { transform: rotate(4deg); }
        }
        .animate-icon-wiggle { animation: iconWiggle 2.8s ease-in-out infinite; transform-origin: center; }

        @keyframes iconPulseBounce {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.15); }
          30% { transform: scale(0.95); }
          45% { transform: scale(1.08); }
          60% { transform: scale(1); }
        }
        .animate-icon-pulse-bounce { animation: iconPulseBounce 2.4s ease-in-out infinite; transform-origin: center; }

        @keyframes iconFlash {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.12); filter: brightness(1.25); }
        }
        .animate-icon-flash { animation: iconFlash 1.8s ease-in-out infinite; transform-origin: center; }

        @keyframes iconTwinkle {
          0%, 100% { transform: rotate(0deg) scale(1); opacity: 1; }
          25% { transform: rotate(15deg) scale(1.1); opacity: 0.85; }
          50% { transform: rotate(0deg) scale(1); opacity: 1; }
          75% { transform: rotate(-15deg) scale(1.1); opacity: 0.85; }
        }
        .animate-icon-twinkle { animation: iconTwinkle 3s ease-in-out infinite; transform-origin: center; }
      `}</style>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────
function ReportSection({
  icon,
  iconWrap,
  iconAnim,
  label,
  accent,
  tone,
  first = false,
  children,
}: {
  icon: React.ReactNode;
  iconWrap: string;
  iconAnim?: string;
  label: string;
  accent: string;
  tone?: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${first ? 'pb-4' : 'py-4'} animate-fade-up`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`flex items-center justify-center w-7 h-7 rounded-lg shadow-sm ${iconWrap}`}>
          <span className={`inline-flex ${iconAnim || ''}`}>{icon}</span>
        </div>
        <h3 className={`text-[11px] font-bold uppercase tracking-wider ${accent}`}>{label}</h3>
        {tone && (
          <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${toneToClasses(tone).chip}`}>
            {toneToClasses(tone).icon}
            {tone}
          </span>
        )}
      </div>
      <div className="pl-9">{children}</div>
    </div>
  );
}

function BulletList({
  items,
  footer,
}: {
  items: Array<{
    label: string;
    value: string;
    target?: number;
    actual?: number | null;
    reverse?: boolean;
    highlight?: boolean;
  }>;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mt-2">
      <ul className="space-y-0.5">
        {items.map((it, idx) => {
          let status: 'met' | 'miss' | 'neutral' = 'neutral';
          if (it.target !== undefined && it.actual !== undefined && it.actual !== null && !Number.isNaN(it.actual)) {
            const met = it.reverse ? it.actual <= it.target : it.actual >= it.target;
            status = met ? 'met' : 'miss';
          }
          const dotColor =
            status === 'met' ? 'bg-emerald-500' : status === 'miss' ? 'bg-rose-500' : 'bg-slate-400';
          const valueColor =
            status === 'met'
              ? 'text-emerald-700 dark:text-emerald-300'
              : status === 'miss'
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-gray-800 dark:text-gray-100';
          return (
            <li
              key={idx}
              className="flex items-center gap-2 text-[12.5px] animate-fade-up"
              style={{ animationDelay: `${0.05 + idx * 0.04}s` }}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
              <span className="text-gray-600 dark:text-gray-400 min-w-[70px]">{it.label}</span>
              <span className={`font-bold tabular-nums ${valueColor} ${it.highlight ? 'text-[13px]' : ''}`}>{it.value}</span>
              {it.highlight && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 ml-1">avg</span>}
            </li>
          );
        })}
      </ul>
      {footer && (
        <div className="mt-1.5 pl-3.5 text-[10.5px] text-gray-500 dark:text-gray-400">{footer}</div>
      )}
    </div>
  );
}

function priorityColor(p?: string): string {
  const v = (p || '').toUpperCase();
  if (v === 'CRITICAL' || v === 'HIGH')
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200';
  if (v === 'MEDIUM') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
}
