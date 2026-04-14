'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import api from '@/lib/api';
import { alertSoundService, type SoundType } from '@/lib/alertSounds';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SectionOverride {
  enabled: boolean;
  reminderMinutes: number;
  reminderDays: number;
  reminderWeeks: number;
  reminderMonths: number;
  soundType: SoundType;
  escalate: boolean;
}

interface DndCustomSlot {
  day: string;
  startTime: string;
  endTime: string;
}

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
  soundEnabled: boolean;
  soundVolume: number;
  soundType: SoundType;
  repeatSoundForOverdue: boolean;
  repeatSoundInterval: number;
  sectionDailyTasks: SectionOverride | null;
  sectionTodoItems: SectionOverride | null;
  sectionMeetingRails: SectionOverride | null;
  sectionFollowUps: SectionOverride | null;
  sectionFreqTasks: SectionOverride | null;
  sectionProjects: SectionOverride | null;
  sectionKeyResults: SectionOverride | null;
  sectionPersonalGoals: SectionOverride | null;
  dndEnabled: boolean;
  dndMode: 'scheduled' | 'custom';
  dndDays: string[];
  dndAllDay: boolean;
  dndStartTime: string | null;
  dndEndTime: string | null;
  dndCustomSlots: DndCustomSlot[] | null;
  escalationEnabled: boolean;
  escalationMinutes: number;
  escalationAction: string;
}

const DEFAULT_SECTION: SectionOverride = {
  enabled: true,
  reminderMinutes: 15,
  reminderDays: 1,
  reminderWeeks: 0,
  reminderMonths: 0,
  soundType: 'chime',
  escalate: true,
};

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
  soundEnabled: true,
  soundVolume: 80,
  soundType: 'chime',
  repeatSoundForOverdue: true,
  repeatSoundInterval: 5,
  sectionDailyTasks: null,
  sectionTodoItems: null,
  sectionMeetingRails: null,
  sectionFollowUps: null,
  sectionFreqTasks: null,
  sectionProjects: null,
  sectionKeyResults: null,
  sectionPersonalGoals: null,
  dndEnabled: false,
  dndMode: 'scheduled',
  dndDays: ['saturday', 'sunday'],
  dndAllDay: false,
  dndStartTime: null,
  dndEndTime: null,
  dndCustomSlots: null,
  escalationEnabled: true,
  escalationMinutes: 30,
  escalationAction: 'sound_repeat',
};

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Mon', full: 'Monday' },
  { key: 'tuesday', label: 'Tue', full: 'Tuesday' },
  { key: 'wednesday', label: 'Wed', full: 'Wednesday' },
  { key: 'thursday', label: 'Thu', full: 'Thursday' },
  { key: 'friday', label: 'Fri', full: 'Friday' },
  { key: 'saturday', label: 'Sat', full: 'Saturday' },
  { key: 'sunday', label: 'Sun', full: 'Sunday' },
];

const SOUND_OPTIONS: { value: SoundType; label: string; icon: string }[] = [
  { value: 'chime', label: 'Chime', icon: '🎵' },
  { value: 'bell', label: 'Bell', icon: '🔔' },
  { value: 'ping', label: 'Ping', icon: '📡' },
  { value: 'urgent', label: 'Urgent', icon: '🚨' },
  { value: 'alarm', label: 'Alarm', icon: '⏰' },
];

const SECTION_CONFIGS = [
  { key: 'sectionDailyTasks', label: 'Daily Tasks', icon: '📋', desc: 'Recurring daily activities' },
  { key: 'sectionTodoItems', label: 'To-Do Items', icon: '✅', desc: 'One-time tasks with due dates' },
  { key: 'sectionMeetingRails', label: 'Meeting Rails', icon: '📅', desc: 'Meeting action items' },
  { key: 'sectionFollowUps', label: 'Follow-Ups', icon: '🔄', desc: 'Assigned follow-up items' },
  { key: 'sectionFreqTasks', label: 'Scheduled Tasks', icon: '📆', desc: 'Bi-weekly, monthly, quarterly tasks' },
  { key: 'sectionProjects', label: 'Projects', icon: '📊', desc: 'Project milestones and updates' },
  { key: 'sectionKeyResults', label: 'Key Results', icon: '🎯', desc: 'KPI targets and metrics' },
  { key: 'sectionPersonalGoals', label: 'Personal Goals', icon: '🏆', desc: 'Personal objective tracking' },
] as const;

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
// Collapsible Section
// ─────────────────────────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon,
  description,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl overflow-hidden transition-all duration-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
              {title}
              {badge && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 normal-case tracking-normal">
                  {badge}
                </span>
              )}
            </h3>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Override Editor
// ─────────────────────────────────────────────────────────────────────────────

function SectionOverrideEditor({
  sectionKey,
  label,
  icon,
  desc,
  override,
  onUpdate,
  disabled,
}: {
  sectionKey: string;
  label: string;
  icon: string;
  desc: string;
  override: SectionOverride | null;
  onUpdate: (key: string, value: SectionOverride | null) => void;
  disabled?: boolean;
}) {
  const hasOverride = override !== null;
  const current = override || DEFAULT_SECTION;

  const toggleOverride = () => {
    if (hasOverride) {
      onUpdate(sectionKey, null);
    } else {
      onUpdate(sectionKey, { ...DEFAULT_SECTION });
    }
  };

  const updateField = (field: keyof SectionOverride, value: any) => {
    onUpdate(sectionKey, { ...current, [field]: value });
  };

  return (
    <div className={`border border-gray-200 dark:border-gray-600 rounded-lg p-4 transition-all duration-200 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${hasOverride ? 'bg-white dark:bg-gray-800 ring-1 ring-primary-200 dark:ring-primary-800' : 'bg-gray-50/50 dark:bg-gray-800/30'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{desc}</p>
          </div>
        </div>
        <button
          onClick={toggleOverride}
          disabled={disabled}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 ${
            hasOverride
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
          }`}
        >
          {hasOverride ? 'Custom ✓' : 'Use Global'}
        </button>
      </div>

      {hasOverride && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-3">
          <Toggle
            enabled={current.enabled}
            onChange={(v) => updateField('enabled', v)}
            label="Reminders Enabled"
            description="Enable notifications for this section"
          />

          {current.enabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Minutes Before</label>
                  <select
                    value={current.reminderMinutes}
                    onChange={(e) => updateField('reminderMinutes', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={0}>Off</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Days Before</label>
                  <select
                    value={current.reminderDays}
                    onChange={(e) => updateField('reminderDays', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={0}>Off</option>
                    <option value={1}>1 day</option>
                    <option value={2}>2 days</option>
                    <option value={3}>3 days</option>
                    <option value={5}>5 days</option>
                    <option value={7}>1 week</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Alert Sound</label>
                  <select
                    value={current.soundType}
                    onChange={(e) => updateField('soundType', e.target.value as SoundType)}
                    className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    {SOUND_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => alertSoundService.preview(current.soundType, 80)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Test
                  </button>
                </div>
              </div>

              <Toggle
                enabled={current.escalate}
                onChange={(v) => updateField('escalate', v)}
                label="Auto-Escalate"
                description="Re-alert if item stays overdue"
              />
            </>
          )}
        </div>
      )}
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

  const customSectionCount = useMemo(() => {
    return SECTION_CONFIGS.filter((s) => prefs[s.key as keyof NotificationPreferences] !== null).length;
  }, [prefs]);

  useEffect(() => {
    loadPrefs();
    if (typeof Notification !== 'undefined') {
      setBrowserPermission(Notification.permission);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const updateClock = () => {
      try {
        const formatted = new Date().toLocaleString('en-US', {
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

  const parseJsonField = (raw: any) => {
    if (!raw) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
  };

  const loadPrefs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/lsw/notification-preferences');
      if (res.data.success) {
        const raw = res.data.data;
        const loaded: NotificationPreferences = {
          ...DEFAULT_PREFS,
          ...raw,
          dndDays: typeof raw.dndDays === 'string' ? JSON.parse(raw.dndDays) : (raw.dndDays || DEFAULT_PREFS.dndDays),
          dndCustomSlots: parseJsonField(raw.dndCustomSlots),
          sectionDailyTasks: parseJsonField(raw.sectionDailyTasks),
          sectionTodoItems: parseJsonField(raw.sectionTodoItems),
          sectionMeetingRails: parseJsonField(raw.sectionMeetingRails),
          sectionFollowUps: parseJsonField(raw.sectionFollowUps),
          sectionFreqTasks: parseJsonField(raw.sectionFreqTasks),
          sectionProjects: parseJsonField(raw.sectionProjects),
          sectionKeyResults: parseJsonField(raw.sectionKeyResults),
          sectionPersonalGoals: parseJsonField(raw.sectionPersonalGoals),
        };
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
        const raw = res.data.data;
        const saved: NotificationPreferences = {
          ...DEFAULT_PREFS,
          ...raw,
          dndDays: typeof raw.dndDays === 'string' ? JSON.parse(raw.dndDays) : (raw.dndDays || DEFAULT_PREFS.dndDays),
          dndCustomSlots: parseJsonField(raw.dndCustomSlots),
        };
        setPrefs(saved);
        prefsRef.current = saved;
        setMessage('Settings saved');
        setTimeout(() => setMessage(''), 2500);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof NotificationPreferences, value: any) => {
    const updated = { ...prefsRef.current, [field]: value };
    setPrefs(updated);
    prefsRef.current = updated;

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

  const toggleDndDay = (day: string) => {
    const current = prefs.dndDays || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    updateField('dndDays', updated);
  };

  const updateCustomSlot = (index: number, field: keyof DndCustomSlot, value: string) => {
    const slots = [...(prefs.dndCustomSlots || [])];
    slots[index] = { ...slots[index], [field]: value };
    updateField('dndCustomSlots', slots);
  };

  const addCustomSlot = () => {
    const slots = [...(prefs.dndCustomSlots || [])];
    slots.push({ day: 'monday', startTime: '22:00', endTime: '07:00' });
    updateField('dndCustomSlots', slots);
  };

  const removeCustomSlot = (index: number) => {
    const slots = [...(prefs.dndCustomSlots || [])];
    slots.splice(index, 1);
    updateField('dndCustomSlots', slots);
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Notification Settings
        </h2>
        {saving && (
          <div className="flex items-center gap-2 text-xs text-primary-600 dark:text-primary-400">
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Saving...
          </div>
        )}
      </div>

      {/* Toast Messages */}
      {message && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <p className="text-sm text-green-800 dark:text-green-200">{message}</p>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* ━━━ Notification Channels ━━━ */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          Notification Channels
        </h3>
        <Toggle enabled={prefs.emailEnabled} onChange={(v) => updateField('emailEnabled', v)} label="Email Notifications" description="Receive overdue alerts and reminders via email" />
        <div className="border-t border-gray-200 dark:border-gray-600" />
        <Toggle
          enabled={prefs.browserEnabled}
          onChange={(v) => {
            if (v && browserPermission !== 'granted') { requestBrowserPermission(); } else { updateField('browserEnabled', v); }
          }}
          label="Browser Notifications"
          description="Show desktop notifications for LSW items"
        />
        {prefs.browserEnabled && browserPermission === 'denied' && (
          <p className="text-xs text-red-500 dark:text-red-400 ml-1 -mt-2">Browser notifications are blocked. Enable them in browser settings.</p>
        )}
        {prefs.browserEnabled && browserPermission === 'default' && (
          <button onClick={requestBrowserPermission} className="text-xs text-primary-600 dark:text-primary-400 hover:underline ml-1 -mt-2">Click to allow browser notifications</button>
        )}
      </div>

      {/* ━━━ Bakery Metrics ━━━ */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Bakery Metrics Notifications
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Get notified when bakery production metrics are submitted.</p>
        <Toggle enabled={prefs.bakeryEmailEnabled} onChange={(v) => updateField('bakeryEmailEnabled', v)} label="Email Report" description="Receive a bakery production report email with PDF attachment" />
        <div className="border-t border-gray-200 dark:border-gray-600" />
        <Toggle enabled={prefs.bakeryBrowserEnabled} onChange={(v) => updateField('bakeryBrowserEnabled', v)} label="Browser Notification" description="Show a desktop notification when metrics are submitted" />
      </div>

      {/* ━━━ Past-Due Notifications ━━━ */}
      <CollapsibleSection title="Past-Due Notifications" icon="⚠️" description="Get notified when LSW items pass their due time or date" defaultOpen={true}>
        <div className={!isAnyChannelEnabled ? 'opacity-50 pointer-events-none' : ''}>
          <Toggle enabled={prefs.notifyTaskOverdue} onChange={(v) => updateField('notifyTaskOverdue', v)} label="Daily Tasks" description="Tasks past their scheduled time today" disabled={!isAnyChannelEnabled} />
          <div className="border-t border-gray-200 dark:border-gray-600" />
          <Toggle enabled={prefs.notifyTodoOverdue} onChange={(v) => updateField('notifyTodoOverdue', v)} label="To-Do Items" description="To-do items past their due date or time" disabled={!isAnyChannelEnabled} />
          <div className="border-t border-gray-200 dark:border-gray-600" />
          <Toggle enabled={prefs.notifyMeetingOverdue} onChange={(v) => updateField('notifyMeetingOverdue', v)} label="Meeting Rails" description="Meeting rails past their due date" disabled={!isAnyChannelEnabled} />
          <div className="border-t border-gray-200 dark:border-gray-600" />
          <Toggle enabled={prefs.notifyFollowUpOverdue} onChange={(v) => updateField('notifyFollowUpOverdue', v)} label="Follow-Ups" description="Follow-up items past their due date" disabled={!isAnyChannelEnabled} />
          <div className="border-t border-gray-200 dark:border-gray-600" />
          <Toggle enabled={prefs.notifyFreqTaskOverdue} onChange={(v) => updateField('notifyFreqTaskOverdue', v)} label="Scheduled Tasks" description="Bi-weekly, monthly, quarterly, and annual tasks past due" disabled={!isAnyChannelEnabled} />
        </div>
      </CollapsibleSection>

      {/* ━━━ Upcoming Event Reminders ━━━ */}
      <CollapsibleSection title="Upcoming Event Reminders" icon="🔔" description="Get notified before events are due" defaultOpen={true}>
        <div className={!isAnyChannelEnabled ? 'opacity-50 pointer-events-none' : ''}>
          <Toggle enabled={prefs.upcomingReminderEnabled} onChange={(v) => updateField('upcomingReminderEnabled', v)} label="Enable Upcoming Reminders" description="Get notified before events are due" disabled={!isAnyChannelEnabled} />

          {prefs.upcomingReminderEnabled && isAnyChannelEnabled && (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Set how far in advance you want to be reminded:</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Minutes Before</label>
                  <select value={prefs.reminderMinutesBefore} onChange={(e) => updateField('reminderMinutesBefore', Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500">
                    <option value={0}>Disabled</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Days Before</label>
                  <select value={prefs.reminderDaysBefore} onChange={(e) => updateField('reminderDaysBefore', Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500">
                    <option value={0}>Disabled</option>
                    <option value={1}>1 day before</option>
                    <option value={2}>2 days before</option>
                    <option value={3}>3 days before</option>
                    <option value={5}>5 days before</option>
                    <option value={7}>1 week (7 days)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Weeks Before</label>
                  <select value={prefs.reminderWeeksBefore} onChange={(e) => updateField('reminderWeeksBefore', Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500">
                    <option value={0}>Disabled</option>
                    <option value={1}>1 week before</option>
                    <option value={2}>2 weeks before</option>
                    <option value={4}>4 weeks before</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Months Before</label>
                  <select value={prefs.reminderMonthsBefore} onChange={(e) => updateField('reminderMonthsBefore', Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500">
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
      </CollapsibleSection>

      {/* ━━━ Alert Sound ━━━ */}
      <CollapsibleSection title="Alert Sound" icon="🔊" description="Force alert sounds to ensure you never miss a notification" defaultOpen={false} badge={prefs.soundEnabled ? 'Active' : 'Off'}>
        <div className={!isAnyChannelEnabled ? 'opacity-50 pointer-events-none' : ''}>
          <Toggle enabled={prefs.soundEnabled} onChange={(v) => updateField('soundEnabled', v)} label="Enable Alert Sounds" description="Play a sound when notifications arrive" disabled={!isAnyChannelEnabled} />

          {prefs.soundEnabled && isAnyChannelEnabled && (
            <div className="mt-4 space-y-5">
              {/* Sound Type Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Notification Sound</label>
                <div className="grid grid-cols-5 gap-2">
                  {SOUND_OPTIONS.map((sound) => (
                    <button
                      key={sound.value}
                      onClick={() => {
                        updateField('soundType', sound.value);
                        alertSoundService.preview(sound.value, prefs.soundVolume);
                      }}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 ${
                        prefs.soundType === sound.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <span className="text-xl mb-1">{sound.icon}</span>
                      <span className={`text-[11px] font-medium ${prefs.soundType === sound.value ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        {sound.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Volume</label>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{prefs.soundVolume}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={prefs.soundVolume}
                    onChange={(e) => updateField('soundVolume', Number(e.target.value))}
                    onMouseUp={() => alertSoundService.preview(prefs.soundType, prefs.soundVolume)}
                    onTouchEnd={() => alertSoundService.preview(prefs.soundType, prefs.soundVolume)}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-primary-600"
                  />
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                </div>
              </div>

              {/* Repeat Sound for Overdue */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <Toggle enabled={prefs.repeatSoundForOverdue} onChange={(v) => updateField('repeatSoundForOverdue', v)} label="Repeat Sound for Overdue Items" description="Keep alerting at intervals until you acknowledge" />
                {prefs.repeatSoundForOverdue && (
                  <div className="mt-2 ml-1">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat Every</label>
                    <select value={prefs.repeatSoundInterval} onChange={(e) => updateField('repeatSoundInterval', Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500">
                      <option value={1}>Every 1 minute</option>
                      <option value={2}>Every 2 minutes</option>
                      <option value={5}>Every 5 minutes</option>
                      <option value={10}>Every 10 minutes</option>
                      <option value={15}>Every 15 minutes</option>
                      <option value={30}>Every 30 minutes</option>
                      <option value={60}>Every 1 hour</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Preview Button */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => alertSoundService.preview(prefs.soundType, prefs.soundVolume)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-all duration-200 hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Preview Sound
                </button>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ━━━ Per-Section Customization ━━━ */}
      <CollapsibleSection title="Per-Section Customization" icon="⚙️" description="Override reminder settings independently for each LSW section" defaultOpen={false} badge={customSectionCount > 0 ? `${customSectionCount} custom` : undefined}>
        <div className={`space-y-3 ${!isAnyChannelEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Click &ldquo;Use Global&rdquo; to customize a section with its own reminder timing, sound, and escalation settings.
            Sections without custom overrides use the global defaults above.
          </p>
          {SECTION_CONFIGS.map((section) => (
            <SectionOverrideEditor
              key={section.key}
              sectionKey={section.key}
              label={section.label}
              icon={section.icon}
              desc={section.desc}
              override={prefs[section.key as keyof NotificationPreferences] as SectionOverride | null}
              onUpdate={(key, value) => updateField(key as keyof NotificationPreferences, value)}
              disabled={!isAnyChannelEnabled}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* ━━━ Do Not Disturb ━━━ */}
      <CollapsibleSection title="Do Not Disturb" icon="🌙" description="Schedule times when notifications are silenced" defaultOpen={false} badge={prefs.dndEnabled ? 'Active' : undefined}>
        <div className={!isAnyChannelEnabled ? 'opacity-50 pointer-events-none' : ''}>
          <Toggle enabled={prefs.dndEnabled} onChange={(v) => updateField('dndEnabled', v)} label="Enable Do Not Disturb" description="Silence all notifications during scheduled times" disabled={!isAnyChannelEnabled} />

          {prefs.dndEnabled && isAnyChannelEnabled && (
            <div className="mt-4 space-y-5">
              {/* Mode Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">DND Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['scheduled', 'custom'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateField('dndMode', mode)}
                      className={`p-3 rounded-lg border-2 text-center transition-all duration-200 ${
                        prefs.dndMode === mode
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-sm font-medium ${prefs.dndMode === mode ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                        {mode === 'scheduled' ? '📅 Scheduled' : '🎛️ Custom'}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {mode === 'scheduled' ? 'Same time on selected days' : 'Different times per day'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {prefs.dndMode === 'scheduled' && (
                <>
                  {/* Day Selector */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Active Days</label>
                    <div className="flex gap-1.5">
                      {DAYS_OF_WEEK.map((day) => {
                        const isActive = (prefs.dndDays || []).includes(day.key);
                        return (
                          <button
                            key={day.key}
                            onClick={() => toggleDndDay(day.key)}
                            title={day.full}
                            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg border-2 transition-all duration-200 ${
                              isActive
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Toggle enabled={prefs.dndAllDay} onChange={(v) => updateField('dndAllDay', v)} label="All Day" description="Silence notifications for the entire day on selected days" />

                  {!prefs.dndAllDay && (
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start</label>
                        <input type="time" value={prefs.dndStartTime || '22:00'} onChange={(e) => updateField('dndStartTime', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <span className="text-gray-400 mt-5">→</span>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End</label>
                        <input type="time" value={prefs.dndEndTime || '07:00'} onChange={(e) => updateField('dndEndTime', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  )}
                </>
              )}

              {prefs.dndMode === 'custom' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Custom DND Slots</label>
                    <button onClick={addCustomSlot} className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add Slot
                    </button>
                  </div>

                  {(!prefs.dndCustomSlots || prefs.dndCustomSlots.length === 0) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                      No custom slots. Click &ldquo;Add Slot&rdquo; to create one.
                    </p>
                  )}

                  {(prefs.dndCustomSlots || []).map((slot, idx) => (
                    <div key={idx} className="flex items-end gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex-1">
                        <label className="block text-[11px] text-gray-500 mb-1">Day</label>
                        <select value={slot.day} onChange={(e) => updateCustomSlot(idx, 'day', e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                          {DAYS_OF_WEEK.map((d) => (<option key={d.key} value={d.key}>{d.full}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">From</label>
                        <input type="time" value={slot.startTime} onChange={(e) => updateCustomSlot(idx, 'startTime', e.target.value)} className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">To</label>
                        <input type="time" value={slot.endTime} onChange={(e) => updateCustomSlot(idx, 'endTime', e.target.value)} className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                      </div>
                      <button onClick={() => removeCustomSlot(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Remove slot">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ━━━ Escalation Rules ━━━ */}
      <CollapsibleSection title="Escalation Rules" icon="📢" description="Auto-escalate if items stay overdue — ensure nothing is missed" defaultOpen={false} badge={prefs.escalationEnabled ? 'Active' : 'Off'}>
        <div className={!isAnyChannelEnabled ? 'opacity-50 pointer-events-none' : ''}>
          <Toggle enabled={prefs.escalationEnabled} onChange={(v) => updateField('escalationEnabled', v)} label="Enable Auto-Escalation" description="Automatically re-alert when items remain unresolved" disabled={!isAnyChannelEnabled} />

          {prefs.escalationEnabled && isAnyChannelEnabled && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Escalate After</label>
                <select value={prefs.escalationMinutes} onChange={(e) => updateField('escalationMinutes', Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500">
                  <option value={5}>5 minutes overdue</option>
                  <option value={10}>10 minutes overdue</option>
                  <option value={15}>15 minutes overdue</option>
                  <option value={30}>30 minutes overdue</option>
                  <option value={60}>1 hour overdue</option>
                  <option value={120}>2 hours overdue</option>
                  <option value={240}>4 hours overdue</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Escalation Action</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'sound_repeat', label: 'Repeat Sound', icon: '🔊' },
                    { value: 'email_resend', label: 'Resend Email', icon: '📧' },
                    { value: 'both', label: 'Sound + Email', icon: '🔔' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateField('escalationAction', opt.value)}
                      className={`p-3 rounded-lg border-2 text-center transition-all duration-200 ${
                        prefs.escalationAction === opt.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <p className={`text-[11px] font-medium mt-1 ${prefs.escalationAction === opt.value ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        {opt.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ━━━ Frequency & Timezone ━━━ */}
      <CollapsibleSection title="Frequency & Timezone" icon="⏰" description="Control how often notifications are sent and your timezone" defaultOpen={false}>
        <div className={!isAnyChannelEnabled ? 'opacity-50 pointer-events-none' : ''}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">How often should we check and send notifications?</label>
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
                  className={`p-3 rounded-lg border-2 text-center transition-all duration-200 ${
                    prefs.digestFrequency === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <p className={`text-sm font-medium ${prefs.digestFrequency === opt.value ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>{opt.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Legacy Quiet Hours */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Quiet Hours <span className="text-xs font-normal text-gray-500">(simple)</span></label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">A simple quiet window. For advanced scheduling, use Do Not Disturb above.</p>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                <input type="time" value={prefs.quietHoursStart || ''} onChange={(e) => updateField('quietHoursStart', e.target.value || null)} disabled={!isAnyChannelEnabled} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500" />
              </div>
              <span className="text-gray-400 mt-5">→</span>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                <input type="time" value={prefs.quietHoursEnd || ''} onChange={(e) => updateField('quietHoursEnd', e.target.value || null)} disabled={!isAnyChannelEnabled} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500" />
              </div>
              {(prefs.quietHoursStart || prefs.quietHoursEnd) && (
                <button onClick={() => { updateField('quietHoursStart', null); updateField('quietHoursEnd', null); }} className="mt-5 text-xs text-red-500 hover:text-red-600">Clear</button>
              )}
            </div>
          </div>

          {/* Timezone */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timezone</label>
            <select value={prefs.timezone} onChange={(e) => updateField('timezone', e.target.value)} disabled={!isAnyChannelEnabled} className="w-full sm:w-64 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500">
              {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','America/Anchorage','Pacific/Honolulu','America/Mexico_City','America/Bogota','America/Sao_Paulo','Europe/London','Europe/Paris','Europe/Berlin','Asia/Tokyo','Asia/Shanghai','Asia/Kolkata','Australia/Sydney','UTC'].map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
            {currentTime && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-mono text-xs">{currentTime}</span>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ━━━ Actions ━━━ */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button onClick={() => loadPrefs()} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
          Reset
        </button>
        <button onClick={() => savePrefs()} disabled={saving} className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
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
