'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
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
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface InsightItem {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  description: string;
}

interface RecommendationItem {
  type: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: string;
  due: string;
}

interface InsightsData {
  key_insights: InsightItem[];
  recommendations: RecommendationItem[];
  action_items: ActionItem[];
}

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function BakeryMetricsInsights() {
  const [weekOptions, setWeekOptions] = useState<string[]>([]);
  const [weekFilter, setWeekFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('Monday');
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const weekDropdownRef = useRef<HTMLDivElement>(null);
  const notifId = useRef(0);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'All'];

  // ─── Notifications ────────────────────────────────────────────────────────
  const showNotification = useCallback((message: string, type: Notification['type']) => {
    const id = ++notifId.current;
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  // ─── Click outside close dropdown ─────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(e.target as Node)) {
        setWeekDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Load completed tasks from localStorage ──────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bakery_completed_tasks');
      if (stored) setCompletedTasks(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const toggleTask = (taskId: string) => {
    setCompletedTasks(prev => {
      const next = prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId];
      localStorage.setItem('bakery_completed_tasks', JSON.stringify(next));
      return next;
    });
  };

  const clearTasks = () => {
    if (!confirm('Reset all task completions?')) return;
    setCompletedTasks([]);
    localStorage.removeItem('bakery_completed_tasks');
    showNotification('Task completions cleared', 'info');
  };

  // ─── Load Week Options ───────────────────────────────────────────────────
  const loadWeekOptions = useCallback(async () => {
    try {
      const res = await api.get('/bakery-metrics/week-options');
      if (res.data?.success && res.data.weeks) {
        setWeekOptions(res.data.weeks);
        if (res.data.weeks.length > 0 && !weekFilter) {
          setWeekFilter(res.data.default_week || res.data.weeks[0]);
        }
      }
    } catch {
      const now = new Date();
      const weekNum = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000);
      const opts = Array.from({ length: 5 }, (_, i) => `Week ${weekNum - i} - ${now.getFullYear()}`);
      setWeekOptions(opts);
      if (!weekFilter) setWeekFilter(opts[0]);
    }
  }, [weekFilter]);

  // ─── Load AI Insights ────────────────────────────────────────────────────
  const loadInsights = useCallback(async (week?: string, day?: string) => {
    setInsightsLoading(true);
    try {
      const params = new URLSearchParams();
      if (week && week !== 'latest') params.append('week', week);
      if (day && day !== 'All') params.append('day', day);

      const res = await api.get(`/bakery-metrics/ai-insights?${params.toString()}`);
      if (res.data?.success && res.data.data) {
        setInsights(res.data.data);
      } else {
        setInsights(getFallbackInsights());
      }
    } catch {
      setInsights(getFallbackInsights());
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const getFallbackInsights = (): InsightsData => ({
    key_insights: [
      { type: 'info', title: 'Loading Performance Data', description: 'Select a week and day to generate AI-powered insights.' },
    ],
    recommendations: [],
    action_items: [
      { id: 'system_check', title: 'Complete Daily Equipment Check', description: 'Ensure all die cut machines are properly calibrated and maintained.', priority: 'Medium', due: 'Daily' },
    ],
  });

  // ─── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    loadWeekOptions();
  }, [loadWeekOptions]);

  useEffect(() => {
    if (weekFilter) {
      loadInsights(weekFilter, dayFilter);
    }
  }, [weekFilter, dayFilter, loadInsights]);

  // ─── Notification icons ──────────────────────────────────────────────────
  const notifConfig: Record<string, string> = {
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

  return (
    <div className="space-y-4 relative">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(n => {
          const Ic = alertIcons[n.type] || Info;
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

      {/* ═══ AI INSIGHTS CARD ═══ */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              🤖 Data Analysis &amp; Insights
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Smart recommendations based on current performance data</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Week filter */}
            <div ref={weekDropdownRef} className="relative">
              <button
                onClick={() => setWeekDropdownOpen(!weekDropdownOpen)}
                className="inline-flex items-center px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-w-[160px] justify-between"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Calendar className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                  {weekFilter || 'Select Week'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform ${weekDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {weekDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {weekOptions.map(w => (
                    <button
                      key={w}
                      onClick={() => { setWeekFilter(w); setWeekDropdownOpen(false); }}
                      className={`block w-full text-left px-3 py-2 text-xs font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors ${
                        weekFilter === w ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Day filter */}
            <select
              value={dayFilter}
              onChange={e => setDayFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm"
            >
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Generate button */}
            <button
              onClick={() => loadInsights(weekFilter, dayFilter)}
              disabled={insightsLoading}
              className="inline-flex items-center px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50"
            >
              {insightsLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              Generate New Insights
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Key Insights */}
          <div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" /> Key Performance Insights
            </h4>
            <div className="space-y-3">
              {insightsLoading ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-5 text-center animate-pulse">
                  <Loader2 className="w-6 h-6 text-gray-400 mx-auto mb-2 animate-spin" />
                  <p className="text-xs text-gray-500">Loading insights...</p>
                </div>
              ) : insights?.key_insights && insights.key_insights.length > 0 ? (
                insights.key_insights.map((item, i) => (
                  <div key={i} className={`bg-white dark:bg-gray-700/50 rounded-xl p-3 border-l-4 shadow-sm ${
                    item.type === 'success' ? 'border-emerald-500' : item.type === 'warning' ? 'border-amber-500' : item.type === 'error' ? 'border-red-500' : 'border-blue-500'
                  }`}>
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-1">{item.description}</p>
                  </div>
                ))
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-5 text-center">
                  <Info className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No insights available</p>
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" /> Actionable Recommendations
            </h4>
            <div className="space-y-3">
              {insightsLoading ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-5 text-center animate-pulse">
                  <Loader2 className="w-6 h-6 text-gray-400 mx-auto mb-2 animate-spin" />
                  <p className="text-xs text-gray-500">Loading recommendations...</p>
                </div>
              ) : insights?.recommendations && insights.recommendations.length > 0 ? (
                insights.recommendations.map((rec, i) => (
                  <div key={i} className={`bg-white dark:bg-gray-700/50 rounded-xl p-3 border-l-4 shadow-sm ${
                    rec.type === 'high' ? 'border-red-500' : rec.type === 'medium' ? 'border-orange-500' : 'border-blue-500'
                  }`}>
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{rec.title}</p>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-1">{rec.description}</p>
                    {rec.action && <button className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-1.5 hover:underline">{rec.action} →</button>}
                  </div>
                ))
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-5 text-center">
                  <Target className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No recommendations</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-500" /> Priority Action Items
              </h4>
              {completedTasks.length > 0 && (
                <button onClick={clearTasks} className="px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-md transition-colors">
                  <RotateCcw className="w-3 h-3 inline mr-0.5" /> Reset
                </button>
              )}
            </div>

            {/* Progress bar */}
            {insights?.action_items && insights.action_items.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-[10px] text-gray-600 dark:text-gray-400 mb-1">
                  <span className="font-medium">Task Completion</span>
                  <span>{insights.action_items.filter(a => completedTasks.includes(a.id || a.title)).length}/{insights.action_items.length} completed</span>
                </div>
                <div className="h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${(insights.action_items.filter(a => completedTasks.includes(a.id || a.title)).length / insights.action_items.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              {insightsLoading ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-5 text-center animate-pulse">
                  <Loader2 className="w-6 h-6 text-gray-400 mx-auto mb-2 animate-spin" />
                  <p className="text-xs text-gray-500">Loading actions...</p>
                </div>
              ) : insights?.action_items && insights.action_items.length > 0 ? (
                insights.action_items.map((action, i) => {
                  const taskId = action.id || action.title;
                  const done = completedTasks.includes(taskId);
                  return (
                    <div key={i} className={`bg-white dark:bg-gray-700/50 rounded-xl p-3 shadow-sm transition-all ${done ? 'opacity-60' : ''}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleTask(taskId)}
                          title={`Mark "${action.title}" as ${done ? 'incomplete' : 'complete'}`}
                          className="mt-0.5 rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className={`text-xs font-semibold text-gray-900 dark:text-gray-100 ${done ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>{action.title}</p>
                          <p className={`text-[10px] mt-0.5 ${done ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}`}>{action.description}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              action.priority?.toLowerCase() === 'high' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                              : action.priority?.toLowerCase() === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              {action.priority} Priority
                            </span>
                            <span className="text-[9px] text-gray-500 dark:text-gray-400">Due: {action.due}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-5 text-center">
                  <CheckSquare className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No action items</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/80 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">📄 Report Information</h4>
            <div className="flex flex-wrap gap-4 text-[10px] text-gray-600 dark:text-gray-400">
              <span>Generated: <span className="font-semibold text-gray-800 dark:text-gray-200">{new Date().toLocaleString()}</span></span>
              <span>Data Source: Bakery Management System</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">System Healthy</span>
          </div>
        </div>
      </div>
    </div>
  );
}
