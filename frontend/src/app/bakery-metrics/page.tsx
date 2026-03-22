'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Wheat, FileBarChart, LayoutDashboard, ArrowLeft, FileText, BarChart3, Calendar, Clock, RefreshCw, FileSpreadsheet, Sparkles, History } from 'lucide-react';
import BakeryMetricsForm from '@/components/bakery-metrics/BakeryMetricsForm';
import BakeryMetricsReport from '@/components/bakery-metrics/BakeryMetricsReport';
import BakeryMetricsInsights from '@/components/bakery-metrics/BakeryMetricsInsightsV2';
import BakeryDashboardOverview from '@/components/bakery-metrics/BakeryDashboardOverview';

type Tab = 'dashboard' | 'form' | 'report' | 'insights';

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

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'form', label: 'Submit Metrics', icon: Wheat },
    { id: 'report', label: 'View Reports', icon: FileBarChart },
    { id: 'insights', label: 'AI Insights', icon: Sparkles },
  ];

  const formSteps = [
    { num: 1, label: 'Info' },
    { num: 2, label: 'Metrics' },
    { num: 3, label: 'Review' },
  ];
  const formProgressPercent = (formStep.current / formStep.total) * 100;

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

              {/* Right: Dynamic tab context */}
              <div className="flex-shrink-0 hidden sm:block">
                {activeTab === 'form' && (
                  <div className="flex flex-col items-end gap-2">
                    {/* Step indicator */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setRecentSubsTrigger(Date.now())}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-[10px] font-bold shadow-sm hover:from-green-600 hover:to-emerald-700 transition-all active:scale-95 mr-3"
                        title="View recent submissions"
                      >
                        <History className="w-3.5 h-3.5" />
                        Recent Submissions
                      </button>
                      <div className="p-1.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-sm mr-1.5">
                        <FileText className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mr-2">Submit Daily Metrics</span>
                      {formSteps.map((s, i) => (
                        <div key={s.num} className="flex items-center gap-1">
                          {i > 0 && <div className="w-4 sm:w-6 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full" />}
                          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all ${
                            formStep.current >= s.num
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow shadow-blue-500/30'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                          }`}>
                            {s.num}
                          </div>
                          <span className={`text-[9px] sm:text-[10px] font-semibold hidden md:inline ${
                            formStep.current >= s.num ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                          }`}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div className="w-48 sm:w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${formProgressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'report' && (
                  <div className="flex flex-col items-end gap-2">
                    {/* Title row */}
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                        <BarChart3 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-gray-900 dark:text-white">📊 Table Analytics Dashboard</p>
                        <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Comprehensive data-driven performance insights</p>
                      </div>
                    </div>
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
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile: dynamic context shown below title */}
            <div className="sm:hidden mb-2">
              {activeTab === 'form' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-md">
                      <FileText className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Submit Daily Metrics</span>
                    <button
                      onClick={() => setRecentSubsTrigger(Date.now())}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md text-[9px] font-bold shadow-sm hover:from-green-600 hover:to-emerald-700 transition-all active:scale-95 ml-auto"
                      title="View recent submissions"
                    >
                      <History className="w-3 h-3" />
                      Submissions
                    </button>
                    <div className="flex items-center gap-0.5">
                      {formSteps.map((s, i) => (
                        <div key={s.num} className="flex items-center gap-0.5">
                          {i > 0 && <div className="w-3 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full" />}
                          <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${
                            formStep.current >= s.num
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                          }`}>
                            {s.num}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-1 rounded-full transition-all duration-500"
                      style={{ width: `${formProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'report' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md">
                      <BarChart3 className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-gray-900 dark:text-white">📊 Table Analytics Dashboard</span>
                  </div>
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
                </div>
              )}
            </div>

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

          {activeTab === 'form' && (
            <BakeryMetricsForm onStepChange={handleStepChange} openRecentSubmissions={recentSubsTrigger} />
          )}

          {activeTab === 'report' && (
            <BakeryMetricsReport onFilterInfo={handleFilterInfo} triggerAction={reportAction} />
          )}

          {activeTab === 'insights' && (
            <BakeryMetricsInsights />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
