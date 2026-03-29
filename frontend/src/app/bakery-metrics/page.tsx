'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Wheat, FileBarChart, LayoutDashboard, ArrowLeft, FileText, BarChart3, Calendar, Clock, RefreshCw, FileSpreadsheet, Sparkles, History, ClipboardList, X, Plus, Lightbulb, Check, AlertTriangle, Info, Target, Trophy } from 'lucide-react';
import BakeryMetricsForm from '@/components/bakery-metrics/BakeryMetricsForm';
import BakeryMetricsReport from '@/components/bakery-metrics/BakeryMetricsReport';
import BakeryMetricsInsights from '@/components/bakery-metrics/BakeryMetricsInsightsV2';
import BakeryDashboardOverview from '@/components/bakery-metrics/BakeryDashboardOverview';

type Tab = 'dashboard' | 'report' | 'insights';

export default function BakeryMetricsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Form step tracking
  const [formStep, setFormStep] = useState({ current: 1, total: 3 });
  const handleStepChange = useCallback((step: number, total: number) => {
    setFormStep({ current: step, total });
  }, []);

  // Report filter tracking
  const [reportFilter, setReportFilter] = useState({ week: '', day: '', totalRecords: 0, isWeekSummary: false });
  const handleFilterInfo = useCallback((info: { week: string; day: string; totalRecords: number; isWeekSummary: boolean }) => {
    setReportFilter(info);
  }, []);

  // Report action trigger (refresh / export)
  const [reportAction, setReportAction] = useState<{ type: 'refresh' | 'pdf' | 'excel'; ts: number } | undefined>();

  // Recent Submissions modal trigger
  const [recentSubsTrigger, setRecentSubsTrigger] = useState(0);

  // Data Completeness Tracker modal trigger
  const [trackerModalTrigger, setTrackerModalTrigger] = useState(0);

  // Submit Metrics modal (centered)
  const [showFormModal, setShowFormModal] = useState(false);
  const [prefillWeekDay, setPrefillWeekDay] = useState<{ weekName: string; dayOfWeek: string; ts: number } | null>(null);

  // Handle Fill Now from tracker — open form modal with prefilled week/day
  const handleFillNow = (weekName: string, dayOfWeek: string) => {
    setPrefillWeekDay({ weekName, dayOfWeek, ts: Date.now() });
    setShowFormModal(true);
  };

  // Tips & Guidelines modal
  const [showTipsPanel, setShowTipsPanel] = useState(false);
  const [tipsClosing, setTipsClosing] = useState(false);
  const [tipsCountdown, setTipsCountdown] = useState(10);
  const tipsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownTipsRef = useRef(false);

  // Animated close — zoom-out + fly off
  const closeTips = useCallback(() => {
    if (tipsClosing) return;
    setTipsClosing(true);
    setTimeout(() => {
      setShowTipsPanel(false);
      setTipsClosing(false);
    }, 700);
  }, [tipsClosing]);
  const [showCongratsBanner, setShowCongratsBanner] = useState(false);
  const [tipsData, setTipsData] = useState<{ title: string; description: string; color: string; icon: string }[]>([
    { title: 'OEE Best Practice', description: 'Target OEE ≥70%. Above 85% is excellent.', color: 'green', icon: 'check' },
    { title: 'Waste Control', description: 'Keep waste below 3.75% to avoid process issues.', color: 'orange', icon: 'alert' },
    { title: 'Submission Timing', description: 'Submit by end of day for accurate reporting.', color: 'blue', icon: 'clock' },
  ]);

  // Fetch tips from API
  useEffect(() => {
    const fetchTips = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'}/bakery-metrics/tips-guidelines`);
        if (res.ok) {
          const data = await res.json();
          const tips = Array.isArray(data) ? data : data?.tips;
          if (Array.isArray(tips) && tips.length > 0) setTipsData(tips);
        }
      } catch {}
    };
    fetchTips();
  }, []);

  // Auto-open tips ONLY on first visit to Report tab after login
  useEffect(() => {
    if (activeTab === 'report' && !hasShownTipsRef.current) {
      hasShownTipsRef.current = true;
      setShowTipsPanel(true);
    }
  }, [activeTab]);

  // Congrats callback from BakeryMetricsReport
  const handleCongratsChange = useCallback((val: boolean) => {
    setShowCongratsBanner(val);
  }, []);

  // Countdown timer (10s) — reset on open, clear on close
  useEffect(() => {
    if (tipsTimerRef.current) clearTimeout(tipsTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    tipsTimerRef.current = null;
    countdownRef.current = null;

    if (showTipsPanel) {
      setTipsCountdown(10);
      countdownRef.current = setInterval(() => {
        setTipsCountdown(prev => {
          if (prev <= 1) {
            closeTips();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (tipsTimerRef.current) clearTimeout(tipsTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [showTipsPanel, closeTips]);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'report', label: 'View Reports', icon: FileBarChart },
    { id: 'insights', label: 'AI Insights', icon: Sparkles },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 w-full flex flex-col">
        {/* Sticky Header + Tabs */}
        <div className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-0">
            {/* Header row: back + title left, dynamic content right */}
            <div className="mb-3 flex items-start justify-between gap-3">
              {/* Left: Back + Title */}
              <div className="flex items-start gap-3 min-w-0">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="mt-0.5 p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors active:scale-95 flex-shrink-0"
                  title="Back to Dashboard"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Wheat className="w-6 h-6 text-amber-600" />
                    Bakery Metrics
                  </h1>
                  <p className="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Submit and review daily bakery production metrics
                  </p>
                </div>
              </div>

              {/* Center: Submit Metrics + Data Completeness buttons (only on report tab) */}
              {activeTab === 'report' && <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => setShowFormModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm hover:from-blue-600 hover:to-indigo-700 transition-all active:scale-95"
                  title="Submit Daily Metrics"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Submit Metrics
                </button>
                <button
                  onClick={() => setTrackerModalTrigger(Date.now())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-bold shadow-sm hover:from-amber-600 hover:to-orange-600 transition-all active:scale-95"
                  title="Open Data Completeness Tracker"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Data Completeness
                </button>
              </div>}

              {/* Right: Dynamic tab context */}
              <div className="flex-shrink-0 hidden sm:block">
                {activeTab === 'report' && (
                  <div className="flex flex-col items-end gap-2">
                    {/* Status badges + action buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-md text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live Data
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                        <Calendar className="w-3 h-3" /> {reportFilter.isWeekSummary ? `Week Summary (${reportFilter.week})` : reportFilter.week || 'Current Week'}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                        <Clock className="w-3 h-3" /> Updated: {new Date().toLocaleTimeString()}
                      </span>
                      <span className="mx-0.5 w-px h-4 bg-gray-300 dark:bg-gray-600" />
                      <button
                        onClick={() => setReportAction({ type: 'pdf', ts: Date.now() })}
                        className="inline-flex items-center px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 transition-all text-[10px] font-semibold text-gray-700 dark:text-gray-300 shadow-sm"
                      >
                        <FileText className="w-3 h-3 mr-1 text-red-600" /> PDF
                      </button>
                      <button
                        onClick={() => setReportAction({ type: 'excel', ts: Date.now() })}
                        className="inline-flex items-center px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 transition-all text-[10px] font-semibold text-gray-700 dark:text-gray-300 shadow-sm"
                      >
                        <FileSpreadsheet className="w-3 h-3 mr-1 text-green-600" /> Excel
                      </button>
                      <button
                        onClick={() => setReportAction({ type: 'refresh', ts: Date.now() })}
                        className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md hover:from-blue-700 hover:to-indigo-700 transition-all text-[10px] font-semibold shadow-sm active:scale-95"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                      </button>
                      <span className="mx-0.5 w-px h-4 bg-gray-300 dark:bg-gray-600" />
                      <button
                        onClick={() => setShowTipsPanel(true)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md text-[10px] font-bold shadow-sm hover:from-blue-600 hover:to-blue-700 transition-all active:scale-95"
                        title="Tips & Guidelines"
                      >
                        <Lightbulb className="w-3 h-3" /> Tips & Guidelines
                      </button>
                      <button
                        onClick={() => setRecentSubsTrigger(Date.now())}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md text-[10px] font-bold shadow-sm hover:from-green-600 hover:to-emerald-700 transition-all active:scale-95"
                        title="View recent submissions"
                      >
                        <History className="w-3 h-3" /> Recent Submissions
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile: Submit Metrics + Data Completeness buttons (only on report tab) */}
            {activeTab === 'report' && <div className="sm:hidden mb-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <button
                  onClick={() => setShowFormModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md text-[9px] font-bold shadow-sm hover:from-blue-600 hover:to-indigo-700 transition-all active:scale-95"
                  title="Submit Daily Metrics"
                >
                  <Plus className="w-3 h-3" />
                  Submit Metrics
                </button>
                <button
                  onClick={() => setTrackerModalTrigger(Date.now())}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-md text-[9px] font-bold shadow-sm hover:from-amber-600 hover:to-orange-600 transition-all active:scale-95"
                  title="Open Data Completeness Tracker"
                >
                  <ClipboardList className="w-3 h-3" />
                  Data Completeness
                </button>
              </div>

              {activeTab === 'report' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
                    </span>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded text-[9px] font-semibold text-blue-700 dark:text-blue-300 truncate max-w-[140px]">
                      <Calendar className="w-2.5 h-2.5 flex-shrink-0" /> {reportFilter.week || 'Current Week'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setReportAction({ type: 'pdf', ts: Date.now() })}
                      className="inline-flex items-center px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-[9px] font-semibold text-gray-700 dark:text-gray-300"
                    >
                      <FileText className="w-2.5 h-2.5 mr-0.5 text-red-600" /> PDF
                    </button>
                    <button
                      onClick={() => setReportAction({ type: 'excel', ts: Date.now() })}
                      className="inline-flex items-center px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-[9px] font-semibold text-gray-700 dark:text-gray-300"
                    >
                      <FileSpreadsheet className="w-2.5 h-2.5 mr-0.5 text-green-600" /> Excel
                    </button>
                    <button
                      onClick={() => setReportAction({ type: 'refresh', ts: Date.now() })}
                      className="inline-flex items-center px-1.5 py-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded text-[9px] font-semibold active:scale-95"
                    >
                      <RefreshCw className="w-2.5 h-2.5 mr-0.5" /> Refresh
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowTipsPanel(true)}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded text-[9px] font-bold shadow-sm active:scale-95"
                      title="Tips & Guidelines"
                    >
                      <Lightbulb className="w-2.5 h-2.5" /> Tips & Guidelines
                    </button>
                    <button
                      onClick={() => setRecentSubsTrigger(Date.now())}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded text-[9px] font-bold shadow-sm active:scale-95"
                      title="View recent submissions"
                    >
                      <History className="w-2.5 h-2.5" /> Recent Submissions
                    </button>
                  </div>
                </div>
              )}
            </div>}

            {/* Tab Switcher */}
            <div className="flex overflow-x-auto scrollbar-hide space-x-1 sm:space-x-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap active:scale-95 ${
                      activeTab === tab.id
                        ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <BakeryDashboardOverview />
          )}

          {activeTab === 'report' && (
            <BakeryMetricsReport onFilterInfo={handleFilterInfo} triggerAction={reportAction} onCongratsChange={handleCongratsChange} />
          )}

          {activeTab === 'insights' && (
            <BakeryMetricsInsights />
          )}
        </div>

        {/* Always-mounted BakeryMetricsForm (off-screen) — needed for Recent Submissions & Data Completeness tracker modals */}
        <div aria-hidden="true" className="fixed -left-[9999px] top-0 w-px h-px overflow-hidden">
          <BakeryMetricsForm onStepChange={handleStepChange} openRecentSubmissions={recentSubsTrigger} openTrackerModal={trackerModalTrigger} onFillNow={handleFillNow} />
        </div>

        {/* Submit Metrics Modal (centered) */}
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={() => setShowFormModal(false)}>
            <div className="relative w-full max-w-5xl mx-4 my-6 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <Wheat className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Submit Daily Metrics</h2>
                    <p className="text-[11px] text-blue-100 font-medium">Fill in your daily bakery production data</p>
                  </div>
                </div>
                <button onClick={() => setShowFormModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <BakeryMetricsForm onStepChange={handleStepChange} openRecentSubmissions={recentSubsTrigger} prefillWeekDay={prefillWeekDay} />
              </div>
            </div>
          </div>
        )}

        {/* Tips & Guidelines Modal — animated with circular countdown */}
        {showTipsPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeTips}>
            {/* Backdrop with fade-in / fade-out */}
            <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm ${tipsClosing ? 'animate-[fadeOut_0.7s_ease-in_forwards]' : 'animate-[fadeIn_0.3s_ease-out]'}`} />

            {/* Glow burst on exit */}
            {tipsClosing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[51]">
                <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-r from-blue-400/60 via-indigo-400/50 to-purple-400/60 animate-[glowBurst_0.7s_ease-out_forwards] blur-3xl" />
              </div>
            )}

            {/* Modal card — 3D entrance / smooth zoom-out fly-off exit */}
            <div
              className={`relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden ${tipsClosing ? 'animate-[modalExit_0.7s_cubic-bezier(0.4,0,0.2,1)_forwards]' : 'animate-[modalEntrance_0.5s_cubic-bezier(0.34,1.56,0.64,1)]'}`}
              style={{ transformStyle: 'preserve-3d', perspective: '1200px', willChange: 'transform, opacity, filter' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Animated gradient border glow */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 blur-sm -z-10 ${tipsClosing ? 'animate-[glowPulse_0.7s_ease-out_forwards]' : 'opacity-20 animate-[gradientShift_3s_ease_infinite]'}`} />

              {/* Header with shimmer */}
              <div className="relative flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_ease_infinite]" />
                <div className="flex items-center gap-2.5 relative z-10">
                  <div className="p-2 bg-white/20 rounded-xl animate-[float_3s_ease-in-out_infinite]">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-wide">Tips & Guidelines</h3>
                    <p className="text-sm text-blue-200 font-medium">Quick insights for better performance</p>
                  </div>
                </div>
                {/* Circular countdown timer */}
                <div className="relative flex items-center gap-2 z-10">
                  <div className="relative w-10 h-10">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                      <circle
                        cx="20" cy="20" r="17" fill="none"
                        stroke="white" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 17}`}
                        strokeDashoffset={`${2 * Math.PI * 17 * (1 - tipsCountdown / 10)}`}
                        className="transition-all duration-1000 ease-linear"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-black">{tipsCountdown}</span>
                  </div>
                  <button onClick={closeTips} className="p-1.5 hover:bg-white/20 rounded-lg transition-all hover:rotate-90 duration-300" title="Close">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Outstanding Performance Banner (when available) */}
              {showCongratsBanner && (
                <div className="mx-4 mt-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 border-2 border-emerald-300 dark:border-emerald-700 rounded-xl p-3 animate-[slideDown_0.5s_ease-out]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500 rounded-lg shadow-md animate-[bounce_1s_ease-in-out_infinite]">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-emerald-800 dark:text-emerald-200">🎉 Outstanding Performance!</h4>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">All BOTH SHIFTS metrics are meeting or exceeding targets!</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Body — staggered tip card entrance */}
              <div className="p-5 space-y-2.5 max-h-[50vh] overflow-y-auto">
                {tipsData.map((tip, idx) => {
                  const iconMap: Record<string, React.ElementType> = { check: Check, alert: AlertTriangle, clock: Clock, info: Info, lightbulb: Lightbulb, target: Target };
                  const TipIcon = iconMap[tip.icon] || Info;
                  return (
                    <div
                      key={idx}
                      className={`flex items-start space-x-2.5 px-3 py-2.5 rounded-xl border shadow-sm
                        bg-${tip.color}-50 dark:bg-${tip.color}-900/20 border-${tip.color}-200 dark:border-${tip.color}-700
                        hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-300 cursor-default`}
                      style={{ animation: `tipSlideIn 0.4s ease-out ${0.15 + idx * 0.1}s both` }}
                    >
                      <div className={`w-8 h-8 bg-gradient-to-br from-${tip.color}-400 to-${tip.color}-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
                        <TipIcon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">{tip.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{tip.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer with progress bar */}
              <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm text-gray-400 dark:text-gray-500 font-semibold">Auto-closing in {tipsCountdown}s</p>
                  <button
                    onClick={closeTips}
                    className="text-sm font-bold text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    Dismiss now
                  </button>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(tipsCountdown / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Keyframe animations for Tips modal */}
        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
          @keyframes modalEntrance {
            0% { opacity: 0; transform: scale(0.7) rotateX(15deg) translateY(30px); }
            50% { opacity: 1; transform: scale(1.02) rotateX(-2deg) translateY(-5px); }
            100% { opacity: 1; transform: scale(1) rotateX(0) translateY(0); }
          }
          @keyframes modalExit {
            0% { opacity: 1; transform: scale(1) rotateX(0) translateY(0); filter: blur(0) brightness(1); }
            15% { opacity: 1; transform: scale(1.06) rotateX(-2deg) translateY(-8px); filter: blur(0) brightness(1.15); }
            35% { opacity: 0.85; transform: scale(0.9) rotateX(4deg) rotateY(-4deg) translateY(10px); filter: blur(1px) brightness(1.1); }
            60% { opacity: 0.5; transform: scale(0.55) rotateX(10deg) rotateY(-10deg) translateY(80px) translateX(40px); filter: blur(3px) brightness(1.05); }
            100% { opacity: 0; transform: scale(0.15) rotateX(18deg) rotateY(-15deg) translateY(250px) translateX(80px); filter: blur(8px) brightness(0.8); }
          }
          @keyframes glowBurst {
            0% { opacity: 0; transform: scale(0.3); }
            30% { opacity: 0.7; transform: scale(0.8); }
            60% { opacity: 0.4; transform: scale(1.2); }
            100% { opacity: 0; transform: scale(1.8); }
          }
          @keyframes glowPulse {
            0% { opacity: 0.2; }
            30% { opacity: 0.6; }
            100% { opacity: 0; }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes gradientShift {
            0%, 100% { opacity: 0.15; }
            50% { opacity: 0.3; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes tipSlideIn {
            from { opacity: 0; transform: translateX(-20px) scale(0.95); }
            to { opacity: 1; transform: translateX(0) scale(1); }
          }
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
