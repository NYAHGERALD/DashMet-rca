'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationPreferences {
  emailEnabled: boolean;
  browserEnabled: boolean;
  bakeryEmailEnabled: boolean;
  bakeryBrowserEnabled: boolean;
  notifyTaskOverdue: boolean;
  notifyTodoOverdue: boolean;
  notifyMeetingOverdue: boolean;
  notifyFollowUpOverdue: boolean;
  notifyFreqTaskOverdue: boolean;
  upcomingReminderEnabled: boolean;
  reminderMinutesBefore: number;
  reminderDaysBefore: number;
  reminderWeeksBefore: number;
  reminderMonthsBefore: number;
  digestFrequency: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
}

const DEFAULT_PREFS: NotificationPreferences = {
  emailEnabled: false,
  browserEnabled: false,
  bakeryEmailEnabled: true,
  bakeryBrowserEnabled: true,
  notifyTaskOverdue: true,
  notifyTodoOverdue: true,
  notifyMeetingOverdue: true,
  notifyFollowUpOverdue: true,
  notifyFreqTaskOverdue: true,
  upcomingReminderEnabled: true,
  reminderMinutesBefore: 15,
  reminderDaysBefore: 1,
  reminderWeeksBefore: 0,
  reminderMonthsBefore: 0,
  digestFrequency: 'realtime',
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago',
};

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Component
// ─────────────────────────────────────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
  label,
  description,
  disabled,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
          dark:focus:ring-offset-gray-800
          ${enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}
          ${disabled ? 'cursor-not-allowed' : ''}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
            ${enabled ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function LswNotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [currentTime, setCurrentTime] = useState('');
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load preferences
  useEffect(() => {
    loadPrefs();
    if (typeof Notification !== 'undefined') {
      setBrowserPermission(Notification.permission);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Live clock for the selected timezone
  useEffect(() => {
    const updateClock = () => {
      try {
        const now = new Date();
        const formatted = now.toLocaleString('en-US', {
          timeZone: prefs.timezone,
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        setCurrentTime(formatted);
      } catch {
        setCurrentTime('');
      }
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [prefs.timezone]);

  const loadPrefs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/lsw/notification-preferences');
      if (res.data.success) {
        const loaded = { ...DEFAULT_PREFS, ...res.data.data };
        setPrefs(loaded);
        prefsRef.current = loaded;
      }
    } catch (err: any) {
      console.error('Failed to load notification preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePrefs = async (dataToSave?: NotificationPreferences) => {
    const data = dataToSave || prefsRef.current;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const res = await api.put('/lsw/notification-preferences', data);
      if (res.data.success) {
        const saved = { ...DEFAULT_PREFS, ...res.data.data };
        setPrefs(saved);
        prefsRef.current = saved;
        setMessage('Notification preferences saved!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  // Update a single field and auto-save with debounce
  const updateField = (field: keyof NotificationPreferences, value: any) => {
    const updated = { ...prefsRef.current, [field]: value };
    setPrefs(updated);
    prefsRef.current = updated;

    // Debounced auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePrefs(prefsRef.current);
    }, 600);
  };

  const requestBrowserPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    if (permission === 'granted') {
      updateField('browserEnabled', true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const isAnyChannelEnabled = prefs.emailEnabled || prefs.browserEnabled;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Notification Settings
      </h2>

      {/* Messages */}
      {message && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">✓ {message}</p>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* ── Section 1: Notification Channels ── */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
          📬 Notification Channels
        </h3>

        <Toggle
          enabled={prefs.emailEnabled}
          onChange={(v) => updateField('emailEnabled', v)}
          label="Email Notifications"
          description="Receive overdue alerts and reminders via email"
        />

        <div className="border-t border-gray-200 dark:border-gray-600" />

        <Toggle
          enabled={prefs.browserEnabled}
          onChange={(v) => {
            if (v && browserPermission !== 'granted') {
              requestBrowserPermission();
            } else {
              updateField('browserEnabled', v);
            }
          }}
          label="Browser Notifications"
          description="Show desktop notifications for LSW items"
        />

        {prefs.browserEnabled && browserPermission === 'denied' && (
          <p className="text-xs text-red-500 dark:text-red-400 ml-1 -mt-2">
            ⚠ Browser notifications are blocked. Please enable them in your browser settings.
          </p>
        )}

        {prefs.browserEnabled && browserPermission === 'default' && (
          <button
            onClick={requestBrowserPermission}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline ml-1 -mt-2"
          >
            Click here to allow browser notifications
          </button>
        )}
      </div>

      {/* ── Section: Bakery Metrics Notifications ── */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
          📊 Bakery Metrics Notifications
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Get notified when bakery production metrics are submitted.
        </p>

        <Toggle
          enabled={prefs.bakeryEmailEnabled}
          onChange={(v) => updateField('bakeryEmailEnabled', v)}
          label="Email Report"
          description="Receive a bakery production report email with PDF attachment"
        />

        <div className="border-t border-gray-200 dark:border-gray-600" />

        <Toggle
          enabled={prefs.bakeryBrowserEnabled}
          onChange={(v) => updateField('bakeryBrowserEnabled', v)}
          label="Browser Notification"
          description="Show a desktop notification when metrics are submitted"
        />
      </div>

      {/* ── Section 2: Past-Due Item Notifications ── */}
      <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6 ${!isAnyChannelEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
          ⚠️ Past-Due Notifications
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Get notified when LSW items pass their due time or date.
        </p>

        <Toggle
          enabled={prefs.notifyTaskOverdue}
          onChange={(v) => updateField('notifyTaskOverdue', v)}
          label="Daily Tasks"
          description="Tasks past their scheduled time today"
          disabled={!isAnyChannelEnabled}
        />

        <div className="border-t border-gray-200 dark:border-gray-600" />

        <Toggle
          enabled={prefs.notifyTodoOverdue}
          onChange={(v) => updateField('notifyTodoOverdue', v)}
          label="To-Do Items"
          description="To-do items past their due date or time"
          disabled={!isAnyChannelEnabled}
        />

        <div className="border-t border-gray-200 dark:border-gray-600" />

        <Toggle
          enabled={prefs.notifyMeetingOverdue}
          onChange={(v) => updateField('notifyMeetingOverdue', v)}
          label="Meeting Rails"
          description="Meeting rails past their due date"
          disabled={!isAnyChannelEnabled}
        />

        <div className="border-t border-gray-200 dark:border-gray-600" />

        <Toggle
          enabled={prefs.notifyFollowUpOverdue}
          onChange={(v) => updateField('notifyFollowUpOverdue', v)}
          label="Follow-Ups"
          description="Follow-up items past their due date"
          disabled={!isAnyChannelEnabled}
        />

        <div className="border-t border-gray-200 dark:border-gray-600" />

        <Toggle
          enabled={prefs.notifyFreqTaskOverdue}
          onChange={(v) => updateField('notifyFreqTaskOverdue', v)}
          label="Scheduled Tasks"
          description="Bi-weekly, monthly, quarterly, and annual tasks past due"
          disabled={!isAnyChannelEnabled}
        />
      </div>

      {/* ── Section 3: Upcoming Event Reminders ── */}
      <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6 ${!isAnyChannelEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
          🔔 Upcoming Event Reminders
        </h3>

        <Toggle
          enabled={prefs.upcomingReminderEnabled}
          onChange={(v) => updateField('upcomingReminderEnabled', v)}
          label="Enable Upcoming Reminders"
          description="Get notified before events are due"
          disabled={!isAnyChannelEnabled}
        />

        {prefs.upcomingReminderEnabled && isAnyChannelEnabled && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Set how far in advance you want to be reminded:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Minutes Before */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minutes Before
                </label>
                <select
                  value={prefs.reminderMinutesBefore}
                  onChange={(e) => updateField('reminderMinutesBefore', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value={0}>Disabled</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>

              {/* Days Before */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Days Before
                </label>
                <select
                  value={prefs.reminderDaysBefore}
                  onChange={(e) => updateField('reminderDaysBefore', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value={0}>Disabled</option>
                  <option value={1}>1 day before</option>
                  <option value={2}>2 days before</option>
                  <option value={3}>3 days before</option>
                  <option value={5}>5 days before</option>
                  <option value={7}>1 week (7 days) before</option>
                </select>
              </div>

              {/* Weeks Before */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Weeks Before
                </label>
                <select
                  value={prefs.reminderWeeksBefore}
                  onChange={(e) => updateField('reminderWeeksBefore', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value={0}>Disabled</option>
                  <option value={1}>1 week before</option>
                  <option value={2}>2 weeks before</option>
                  <option value={4}>4 weeks before</option>
                </select>
              </div>

              {/* Months Before */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Months Before
                </label>
                <select
                  value={prefs.reminderMonthsBefore}
                  onChange={(e) => updateField('reminderMonthsBefore', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value={0}>Disabled</option>
                  <option value={1}>1 month before</option>
                  <option value={2}>2 months before</option>
                  <option value={3}>3 months before</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 4: Frequency & Quiet Hours ── */}
      <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6 ${!isAnyChannelEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
          ⏰ Notification Frequency
        </h3>

        <div className="space-y-4">
          {/* Digest Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              How often should we check and send notifications?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { value: 'realtime', label: 'Real-time', desc: 'Instant alerts' },
                { value: 'hourly', label: 'Hourly', desc: 'Digest every hour' },
                { value: 'daily', label: 'Daily', desc: 'Once per day' },
                { value: 'weekly', label: 'Weekly', desc: 'Once per week' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateField('digestFrequency', opt.value)}
                  disabled={!isAnyChannelEnabled}
                  className={`
                    p-3 rounded-lg border-2 text-center transition-all
                    ${prefs.digestFrequency === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }
                  `}
                >
                  <p className={`text-sm font-medium ${prefs.digestFrequency === opt.value ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quiet Hours <span className="text-xs font-normal text-gray-500">(optional)</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              No notifications will be sent during this time window.
            </p>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                <input
                  type="time"
                  value={prefs.quietHoursStart || ''}
                  onChange={(e) => updateField('quietHoursStart', e.target.value || null)}
                  disabled={!isAnyChannelEnabled}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <span className="text-gray-400 mt-5">→</span>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                <input
                  type="time"
                  value={prefs.quietHoursEnd || ''}
                  onChange={(e) => updateField('quietHoursEnd', e.target.value || null)}
                  disabled={!isAnyChannelEnabled}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {(prefs.quietHoursStart || prefs.quietHoursEnd) && (
                <button
                  onClick={() => {
                    updateField('quietHoursStart', null);
                    updateField('quietHoursEnd', null);
                  }}
                  className="mt-5 text-xs text-red-500 hover:text-red-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Timezone */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timezone
            </label>
            <select
              value={prefs.timezone}
              onChange={(e) => updateField('timezone', e.target.value)}
              disabled={!isAnyChannelEnabled}
              className="w-full sm:w-64 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              {[
                'America/New_York',
                'America/Chicago',
                'America/Denver',
                'America/Los_Angeles',
                'America/Phoenix',
                'America/Anchorage',
                'Pacific/Honolulu',
                'America/Mexico_City',
                'America/Bogota',
                'America/Sao_Paulo',
                'Europe/London',
                'Europe/Paris',
                'Europe/Berlin',
                'Asia/Tokyo',
                'Asia/Shanghai',
                'Asia/Kolkata',
                'Australia/Sydney',
                'UTC',
              ].map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            {currentTime && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="text-base">🕐</span>
                <span className="font-mono">{currentTime}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Save Button ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={() => loadPrefs()}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => savePrefs()}
          disabled={saving}
          className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
