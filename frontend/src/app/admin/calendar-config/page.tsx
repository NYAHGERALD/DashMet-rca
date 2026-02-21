'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import Image from 'next/image';
import { fetchCalendarConfig, updateCalendarConfig } from '@/lib/lswApi';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

function getDaysInMonth(month: number): number {
  // Use a non-leap year reference (2025) for max day count
  return new Date(2025, month, 0).getDate();
}

/** Given a calendar year start (month + day), compute:
 *  - The actual calendar year start date for the current cycle
 *  - Example weeks
 */
function computePreview(month: number, day: number) {
  const today = new Date();
  // Figure out which cycle we're in
  let cycleStartYear = today.getFullYear();
  const cycleStartThisYear = new Date(cycleStartYear, month - 1, day);
  if (today < cycleStartThisYear) {
    cycleStartYear -= 1;
  }
  const startDate = new Date(cycleStartYear, month - 1, day);

  // Calculate current org week number
  const diffMs = today.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const currentOrgWeek = Math.floor(diffDays / 7) + 1;

  // Calculate example weeks
  const weeks: { weekNum: number; start: string; end: string }[] = [];
  for (let w = 1; w <= 4; w++) {
    const wStart = new Date(startDate);
    wStart.setDate(startDate.getDate() + (w - 1) * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    weeks.push({
      weekNum: w,
      start: wStart.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      end: wEnd.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    });
  }

  return {
    startDate: startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    currentOrgWeek,
    totalWeeks: Math.ceil(365 / 7),
    weeks,
  };
}

function CalendarConfigContent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [originalMonth, setOriginalMonth] = useState(1);
  const [originalDay, setOriginalDay] = useState(1);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const config = await fetchCalendarConfig();
      setMonth(config.calendarYearStartMonth);
      setDay(config.calendarYearStartDay);
      setOriginalMonth(config.calendarYearStartMonth);
      setOriginalDay(config.calendarYearStartDay);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load calendar configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const updated = await updateCalendarConfig({
        calendarYearStartMonth: month,
        calendarYearStartDay: day,
      });
      setMonth(updated.calendarYearStartMonth);
      setDay(updated.calendarYearStartDay);
      setOriginalMonth(updated.calendarYearStartMonth);
      setOriginalDay(updated.calendarYearStartDay);
      setSuccess('Calendar year configuration saved successfully! All LSW week numbers will now be calculated based on this start date.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = month !== originalMonth || day !== originalDay;
  const maxDay = getDaysInMonth(month);
  const preview = computePreview(month, Math.min(day, maxDay));

  // Adjust day if it exceeds max for selected month
  useEffect(() => {
    if (day > maxDay) {
      setDay(maxDay);
    }
  }, [month, day, maxDay]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="relative w-8 h-8">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <Link href="/admin" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                ← Admin Panel
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Calendar Year Configuration
              </h1>
            </div>
            <div className="flex items-center">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                LSW SETTINGS
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <p className="text-sm text-emerald-800 dark:text-emerald-200">{success}</p>
          </div>
        )}

        {/* Explanation Card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <span className="text-xl">📅</span>
            What is the Calendar Year Start?
          </h2>
          <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
            The Calendar Year Start defines when your organization&apos;s fiscal or operational year begins. 
            This date determines how <strong>Week Numbers</strong> are calculated on the Leader Standard Work (LSW) page. 
            For example, if your organization&apos;s year starts on <strong>November 24</strong>, then Week 1 runs from 
            November 24 to November 30, Week 2 from December 1 to December 7, and so on.
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
            By default, the calendar year starts on <strong>January 1</strong> (standard calendar year).
          </p>
        </div>

        {/* Configuration Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/20 dark:to-blue-500/20 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-xl">⚙️</span>
              Set Calendar Year Start Date
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose the month and day when your organization&apos;s year begins
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Month Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Month
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full px-4 py-3 text-base font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer"
                >
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Day Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Day
                </label>
                <select
                  value={Math.min(day, maxDay)}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className="w-full px-4 py-3 text-base font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer"
                >
                  {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
              {hasChanges && (
                <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Preview Card */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-xl">👁️</span>
              Week Preview
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              See how weeks will be calculated with the selected start date
            </p>
          </div>

          <div className="p-6">
            {/* Current Cycle Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 text-center">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Year Start Date</p>
                <p className="mt-1 text-lg font-bold text-emerald-900 dark:text-emerald-100">{preview.startDate}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Current Week</p>
                <p className="mt-1 text-3xl font-bold text-blue-900 dark:text-blue-100">Week {preview.currentOrgWeek}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">Total Weeks / Year</p>
                <p className="mt-1 text-3xl font-bold text-purple-900 dark:text-purple-100">{preview.totalWeeks}</p>
              </div>
            </div>

            {/* Example Weeks Table */}
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Week</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">End Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {preview.weeks.map(w => (
                    <tr key={w.weekNum} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">Week {w.weekNum}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{w.start}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{w.end}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-900/50">
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic" colSpan={3}>... and so on through the year</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CalendarConfigPage() {
  return (
    <ProtectedRoute requireAuth={true} allowedRoles={['ADMIN']}>
      <CalendarConfigContent />
    </ProtectedRoute>
  );
}
