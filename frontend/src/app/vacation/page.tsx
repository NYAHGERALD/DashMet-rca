'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Link from 'next/link';
import * as vacApi from '@/lib/vacationApi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PhoneInput from '@/components/PhoneInput';

// ── Business-day helpers ─────────────────────────────────────────────────────
function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parseLocal(s: string): Date {
  return new Date(s + 'T00:00:00');
}

/** Next business day AFTER the given date */
function getNextBusinessDay(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  while (isWeekend(next)) next.setDate(next.getDate() + 1);
  return next;
}

/** Count business days between start and end (inclusive) */
function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (!isWeekend(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

type Tab = 'overview' | 'employees' | 'requests' | 'activity';

export default function VacationHubPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Overview data ──
  const [stats, setStats] = useState<vacApi.VacationStats | null>(null);
  const [upcoming, setUpcoming] = useState<vacApi.VacationRequest[]>([]);
  const [pending, setPending] = useState<vacApi.VacationRequest[]>([]);
  const [recent, setRecent] = useState<vacApi.VacationRequest[]>([]);
  const [conflicts, setConflicts] = useState<vacApi.VacationConflict[]>([]);

  // ── Employees ──
  const [employees, setEmployees] = useState<vacApi.EmployeeDirectoryEntry[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [empDeptFilter, setEmpDeptFilter] = useState('all');
  const [empStatusFilter, setEmpStatusFilter] = useState('all');
  const [empSearch, setEmpSearch] = useState('');

  // ── Requests ──
  const [requests, setRequests] = useState<vacApi.VacationRequest[]>([]);
  const [reqStatusFilter, setReqStatusFilter] = useState('all');

  // ── Create Form ──
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    department: '',
    shift: '',
    line: '',
    area: '',
    phone: '',
    phoneDisplay: '',
    employeeCode: '',
    leaveType: 'vacation',
    startDate: '',
    endDate: '',
    durationDays: '',
    durationHours: '',
    returnToWork: '',
    reason: '',
    coveragePlan: '',
    emergencyPhone: '',
    emergencyPhoneDisplay: '',
    emergencyEmail: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [dropdowns, setDropdowns] = useState<vacApi.FormDropdowns | null>(null);

  // ── Constraints ──
  const [settings, setSettings] = useState<vacApi.VacationSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [blackoutPeriods, setBlackoutPeriods] = useState<vacApi.BlackoutPeriod[]>([]);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Partial<vacApi.VacationSettings>>({});
  const [showBlackoutForm, setShowBlackoutForm] = useState(false);
  const [blackoutForm, setBlackoutForm] = useState({ name: '', startDate: '', endDate: '', description: '' });
  const [showConstraintsModal, setShowConstraintsModal] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Activity ──
  const [activityLog, setActivityLog] = useState<vacApi.ActivityLogEntry[]>([]);
  const [activityType, setActivityType] = useState('all');

  // ── Modal ──
  const [selectedVacation, setSelectedVacation] = useState<vacApi.VacationRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');

  // ── Notifications ──
  const [notifications, setNotifications] = useState<vacApi.VacationNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ──────────────────────────────────────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    try {
      const [s, u, p, r, c] = await Promise.all([
        vacApi.getVacationStats(),
        vacApi.getUpcomingVacations(),
        vacApi.getPendingVacations(),
        vacApi.getRecentVacations(),
        vacApi.getVacationConflicts(),
      ]);
      setStats(s);
      setUpcoming(u);
      setPending(p);
      setRecent(r);
      setConflicts(c);
    } catch (e: any) {
      console.error('Error loading overview:', e);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const [emps, deps] = await Promise.all([
        vacApi.getEmployeesDirectory({ department: empDeptFilter, status: empStatusFilter }),
        vacApi.getEmployeeDepartments(),
      ]);
      setEmployees(emps);
      setDepartments(deps);
    } catch (e: any) {
      console.error('Error loading employees:', e);
    }
  }, [empDeptFilter, empStatusFilter]);

  const loadRequests = useCallback(async () => {
    try {
      const reqs = await vacApi.getVacationRequests(reqStatusFilter);
      setRequests(reqs);
    } catch (e: any) {
      console.error('Error loading requests:', e);
    }
  }, [reqStatusFilter]);

  const loadConstraints = useCallback(async () => {
    try {
      setSettingsError(null);
      const [s, bp] = await Promise.all([
        vacApi.getVacationSettings(),
        vacApi.getBlackoutPeriods(),
      ]);
      if (!s) {
        setSettingsError('No vacation settings found in database. Please contact an administrator.');
        setSettings(null);
      } else {
        setSettings(s);
        console.log('[loadConstraints] Loaded settings from DB:', JSON.stringify(s));
      }
      setBlackoutPeriods(bp);
    } catch (e: any) {
      console.error('Error loading constraints:', e);
      const msg = e.response?.data?.error || e.message || 'Failed to fetch vacation settings from the server.';
      setSettingsError(msg);
      setSettings(null);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const log = await vacApi.getVacationActivityLog({ type: activityType, limit: 50 });
      setActivityLog(log);
    } catch (e: any) {
      console.error('Error loading activity:', e);
    }
  }, [activityType]);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await vacApi.getVacationNotifications({ limit: 20 });
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch (e: any) {
      console.error('Error loading notifications:', e);
    }
  }, []);

  const loadDropdowns = useCallback(async () => {
    try {
      const dd = await vacApi.getFormDropdowns();
      setDropdowns(dd);
    } catch (e: any) {
      console.error('Error loading dropdowns:', e);
    }
  }, []);

  // ── Cascading dropdown filters ──────────────────────────────────────────────

  // Helper: check if a date falls within a blackout period
  const isBlackoutDate = useCallback((date: Date) => {
    for (const bp of blackoutPeriods) {
      const bpStart = new Date(bp.startDate);
      const bpEnd = new Date(bp.endDate);
      bpStart.setHours(0, 0, 0, 0);
      bpEnd.setHours(23, 59, 59, 999);
      if (date >= bpStart && date <= bpEnd) return true;
    }
    return false;
  }, [blackoutPeriods]);

  // Combined filter for start date picker: no weekends + no blackout dates + minimum notice
  const isStartDateAllowed = useCallback((date: Date) => {
    if (isWeekend(date) || isBlackoutDate(date)) return false;
    // Enforce minimum notice period
    if (settings?.minimumNoticeDays) {
      const minDate = new Date();
      minDate.setHours(0, 0, 0, 0);
      minDate.setDate(minDate.getDate() + settings.minimumNoticeDays);
      if (date < minDate) return false;
    }
    return true;
  }, [isBlackoutDate, settings]);

  // Combined filter for end date picker: no weekends + no blackout dates
  const isEndDateAllowed = useCallback((date: Date) => {
    return !isWeekend(date) && !isBlackoutDate(date);
  }, [isBlackoutDate]);

  // Calculate max end date based on max consecutive days from start date
  const maxEndDate = useMemo(() => {
    if (!formData.startDate || !settings?.maxConsecutiveDays) return undefined;
    const start = parseLocal(formData.startDate);
    const maxEnd = new Date(start);
    maxEnd.setDate(maxEnd.getDate() + settings.maxConsecutiveDays - 1);
    return maxEnd;
  }, [formData.startDate, settings]);

  // Real-time date constraint warnings
  const dateConstraintWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!formData.startDate || !formData.endDate || !settings) return warnings;
    const start = parseLocal(formData.startDate);
    const end = parseLocal(formData.endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (settings.maxConsecutiveDays && diffDays > settings.maxConsecutiveDays) {
      warnings.push(`This request spans ${diffDays} days, which exceeds the maximum of ${settings.maxConsecutiveDays} consecutive days.`);
    }
    if (settings.minimumNoticeDays) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const noticeDays = Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (noticeDays < settings.minimumNoticeDays) {
        warnings.push(`Requests must be submitted at least ${settings.minimumNoticeDays} days in advance. This start date is only ${noticeDays} day(s) away.`);
      }
    }
    return warnings;
  }, [formData.startDate, formData.endDate, settings]);

  // Department → Shift (via shared facilityId)
  const filteredShifts = useMemo(() => {
    if (!dropdowns || !formData.department) return [];
    const selectedDept = dropdowns.departments.find(d => d.name === formData.department);
    if (!selectedDept) return [];
    return dropdowns.shifts.filter(s => s.facilityId === selectedDept.facilityId);
  }, [dropdowns, formData.department]);

  // Shift → Area (areas belong to the selected department)
  const filteredAreas = useMemo(() => {
    if (!dropdowns || !formData.department) return [];
    const selectedDept = dropdowns.departments.find(d => d.name === formData.department);
    if (!selectedDept) return [];
    return dropdowns.areas.filter(a => a.departmentId === selectedDept.id);
  }, [dropdowns, formData.department]);

  // Area → Line (lines belong to area, filtered also by shift via ShiftLine)
  const filteredLines = useMemo(() => {
    if (!dropdowns || !formData.area) return [];
    const selectedArea = dropdowns.areas.find(a => a.name === formData.area);
    if (!selectedArea) return [];
    let lines = dropdowns.lines.filter(l => l.areaId === selectedArea.id);
    // If a shift is selected, also filter by ShiftLine
    if (formData.shift) {
      const selectedShift = dropdowns.shifts.find(s => s.name === formData.shift);
      if (selectedShift) {
        const lineIds = dropdowns.shiftLines
          .filter(sl => sl.shiftId === selectedShift.id)
          .map(sl => sl.lineId);
        lines = lines.filter(l => lineIds.includes(l.id));
      }
    }
    return lines;
  }, [dropdowns, formData.area, formData.shift]);

  // Auto-populate line when only one line exists for the selected area
  useEffect(() => {
    if (filteredLines.length === 1 && formData.line !== filteredLines[0].name) {
      setFormData(prev => ({ ...prev, line: filteredLines[0].name }));
    }
  }, [filteredLines]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calculate duration (business days) + return date when start/end change
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = parseLocal(formData.startDate);
      const end   = parseLocal(formData.endDate);
      const dur   = countBusinessDays(start, end);
      const ret   = getNextBusinessDay(end);
      setFormData(prev => ({
        ...prev,
        durationDays: String(dur),
        durationHours: String(dur * 8),
        returnToWork: formatYMD(ret),
      }));
    } else {
      setFormData(prev => ({ ...prev, durationDays: '', durationHours: '', returnToWork: '' }));
    }
  }, [formData.startDate, formData.endDate]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([loadOverview(), loadEmployees(), loadNotifications(), loadDropdowns(), loadConstraints()]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadOverview, loadEmployees, loadNotifications, loadDropdowns, loadConstraints]);

  // Tab-specific loads
  useEffect(() => {
    if (activeTab === 'requests') loadRequests();
    if (activeTab === 'activity') loadActivity();
    if (activeTab === 'employees') loadEmployees();
  }, [activeTab, loadRequests, loadActivity, loadEmployees]);

  // ──────────────────────────────────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────────────────────────────────

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.startDate || !formData.endDate) return;
    if (emailError) return;
    setSubmitting(true);
    try {
      await vacApi.createVacationRequest({
        firstName: formData.firstName,
        lastName: formData.lastName,
        department: formData.department || undefined,
        shift: formData.shift || undefined,
        line: formData.line || undefined,
        area: formData.area || undefined,
        phone: formData.phone || undefined,
        employeeCode: formData.employeeCode || undefined,
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        durationDays: formData.durationDays ? parseInt(formData.durationDays) : undefined,
        durationHours: formData.durationHours ? parseInt(formData.durationHours) : undefined,
        returnToWork: formData.returnToWork || undefined,
        reason: formData.reason || undefined,
        coveragePlan: formData.coveragePlan || undefined,
        emergencyPhone: formData.emergencyPhone || undefined,
        emergencyEmail: formData.emergencyEmail || undefined,
      });
      setFormData({ firstName: '', lastName: '', department: '', shift: '', line: '', area: '', phone: '', phoneDisplay: '', employeeCode: '', leaveType: 'vacation', startDate: '', endDate: '', durationDays: '', durationHours: '', returnToWork: '', reason: '', coveragePlan: '', emergencyPhone: '', emergencyPhoneDisplay: '', emergencyEmail: '' });
      setShowCreateModal(false);
      await loadOverview();
      await loadRequests();
      await loadEmployees();
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedVacation) return;
    try {
      await vacApi.approveVacation(selectedVacation.id, decisionReason || undefined);
      setShowApproveModal(false);
      setDecisionReason('');
      setSelectedVacation(null);
      await Promise.all([loadOverview(), loadRequests()]);
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const handleDeny = async () => {
    if (!selectedVacation || !decisionReason) {
      alert('Denial reason is required');
      return;
    }
    try {
      await vacApi.denyVacation(selectedVacation.id, decisionReason);
      setShowDenyModal(false);
      setDecisionReason('');
      setSelectedVacation(null);
      await Promise.all([loadOverview(), loadRequests()]);
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      console.log('[handleSaveSettings] Sending to API:', JSON.stringify(settingsForm));
      const updated = await vacApi.updateVacationSettings(settingsForm);
      console.log('[handleSaveSettings] API returned:', JSON.stringify(updated));
      // Set the returned values directly into state first
      setSettings(updated);
      setEditingSettings(false);
      // Also reload from DB to confirm the values persisted
      await loadConstraints();
      // Show success modal
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 5000);
    } catch (e: any) {
      console.error('[handleSaveSettings] Error:', e);
      alert(e.response?.data?.error || e.message || 'Failed to save settings. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = async () => {
    if (!confirm('This will delete ALL existing vacation settings records and reset everything to zero. Are you sure?')) return;
    try {
      console.log('[handleResetSettings] Resetting all settings to zero...');
      const fresh = await vacApi.resetVacationSettings();
      console.log('[handleResetSettings] Reset complete:', JSON.stringify(fresh));
      setSettings(fresh);
      setEditingSettings(false);
      await loadConstraints();
    } catch (e: any) {
      console.error('[handleResetSettings] Error:', e);
      alert(e.response?.data?.error || e.message || 'Failed to reset settings.');
    }
  };

  const handleCreateBlackout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blackoutForm.name || !blackoutForm.startDate || !blackoutForm.endDate) return;
    try {
      await vacApi.createBlackoutPeriod(blackoutForm);
      setBlackoutForm({ name: '', startDate: '', endDate: '', description: '' });
      setShowBlackoutForm(false);
      await loadConstraints();
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const handleDeleteBlackout = async (id: number) => {
    if (!confirm('Delete this blackout period?')) return;
    try {
      await vacApi.deleteBlackoutPeriod(id);
      await loadConstraints();
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await vacApi.markAllNotificationsRead();
      await loadNotifications();
    } catch (e: any) {
      console.error('Error marking notifications read:', e);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fmtDateShort = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    };
    return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || map.pending}`;
  };

  const leaveTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      vacation: '🏖️',
      bereavement: '🕯️',
      sick: '🤒',
      emergency: '🚨',
      unpaid: '📋',
      personal: '👤',
    };
    return map[type] || '📋';
  };

  const filteredEmployees = employees.filter(emp => {
    if (!empSearch) return true;
    const q = empSearch.toLowerCase();
    return `${emp.firstname} ${emp.lastname}`.toLowerCase().includes(q) ||
      (emp.role || '').toLowerCase().includes(q) ||
      (emp.workarea || '').toLowerCase().includes(q);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Tab Panels
  // ──────────────────────────────────────────────────────────────────────────

  const OverviewPanel = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: 'Total Requests', value: stats?.total_requests || 0, icon: '📊', color: 'blue' },
          { label: 'Pending', value: stats?.pending || 0, icon: '⏳', color: 'amber' },
          { label: 'Approved', value: stats?.approved || 0, icon: '✅', color: 'emerald' },
          { label: 'Denied', value: stats?.denied || 0, icon: '❌', color: 'red' },
          { label: 'Cancelled', value: stats?.cancelled || 0, icon: '🚫', color: 'gray' },
          { label: 'Days Used (YTD)', value: stats?.days_used_ytd || 0, icon: '📅', color: 'purple' },
          { label: 'Employees', value: stats?.total_employees || 0, icon: '👥', color: 'indigo' },
        ].map((card, i) => (
          <div key={i} className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">⚠️ Scheduling Conflicts ({conflicts.length})</h3>
          <div className="space-y-2">
            {conflicts.map((c, i) => (
              <div key={i} className={`p-3 rounded-lg ${c.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                <p className="text-sm font-medium">{c.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">📅 Upcoming Vacations</h3>
          </div>
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {upcoming.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming vacations</p>}
            {upcoming.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {v.Employee?.firstName} {v.Employee?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {fmtDateShort(v.startDate)} - {fmtDateShort(v.endDate)} · {v.durationDays}d
                  </p>
                </div>
                <span className="text-sm">{leaveTypeBadge(v.leaveType)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">⏳ Pending Approvals</h3>
          </div>
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {pending.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No pending requests</p>}
            {pending.map((v) => (
              <div key={v.id} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {v.Employee?.firstName} {v.Employee?.lastName}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setSelectedVacation(v); setShowApproveModal(true); }}
                      className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => { setSelectedVacation(v); setShowDenyModal(true); }}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      ✗
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {leaveTypeBadge(v.leaveType)} {fmtDateShort(v.startDate)} - {fmtDateShort(v.endDate)} · {v.durationDays}d
                </p>
                {v.reason && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{v.reason}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Decisions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">📋 Recent Decisions</h3>
          </div>
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {recent.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No recent decisions</p>}
            {recent.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {v.Employee?.firstName} {v.Employee?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {fmtDateShort(v.startDate)} - {fmtDateShort(v.endDate)}
                  </p>
                </div>
                <span className={statusBadge(v.status)}>{v.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const EmployeesPanel = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search employees..."
          value={empSearch}
          onChange={(e) => setEmpSearch(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 min-w-[200px]"
        />
        <select
          value={empDeptFilter}
          onChange={(e) => setEmpDeptFilter(e.target.value)}
          title="Filter by department"
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Roles</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={empStatusFilter}
          onChange={(e) => setEmpStatusFilter(e.target.value)}
          title="Filter by status"
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="on-vacation">On Vacation</option>
          <option value="upcoming">Upcoming Vacation</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Emp ID</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Employee</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Department</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Shift</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Line</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Area</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Phone</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Used</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Upcoming</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEmployees.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No employees found</td></tr>
              )}
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">{emp.employeeCode || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{emp.firstname} {emp.lastname}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{emp.department || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{emp.shift || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{emp.workline || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{emp.workarea || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{emp.phone || '—'}</td>
                  <td className="px-4 py-3">{emp.vacation_days_used}d</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      emp.current_status === 'on_vacation'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                    }`}>
                      {emp.current_status === 'on_vacation' ? '🏖️ On Vacation' : '✅ Available'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {emp.upcoming_vacation ? (
                      <span>{fmtDateShort(emp.upcoming_start)} - {fmtDateShort(emp.upcoming_end)}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const RequestsPanel = () => (
    <div className="space-y-4">
      {/* Filter + Create Button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
        {['all', 'pending', 'approved', 'denied', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setReqStatusFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              reqStatusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        </div>
        <button
          onClick={() => { setShowCreateModal(true); if (!dropdowns) loadDropdowns(); }}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <span>➕</span> Create Request
        </button>
      </div>

      {/* Requests Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Employee</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Type</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Dates</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Days</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Submitted</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {requests.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No requests found</td></tr>
              )}
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {req.Employee?.firstName} {req.Employee?.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <span>{leaveTypeBadge(req.leaveType)} {req.leaveType}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {fmtDateShort(req.startDate)} - {fmtDateShort(req.endDate)}
                  </td>
                  <td className="px-4 py-3">{req.durationDays}</td>
                  <td className="px-4 py-3"><span className={statusBadge(req.status)}>{req.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtDate(req.createdAt)}</td>
                  <td className="px-4 py-3">
                    {req.status === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setSelectedVacation(req); setShowApproveModal(true); }}
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => { setSelectedVacation(req); setShowDenyModal(true); }}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const createRequestModalJSX = !showCreateModal ? null : (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="modal-fixed-layout bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4">
        {/* ── Fixed Header ── */}
        <div className="modal-fixed-header flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Vacation Request</h3>
          <button
            type="button"
            onClick={() => setShowCreateModal(false)}
            title="Close"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {/* ── Scrollable Body ── */}
        <div className="modal-fixed-body px-6 py-4">
        <form id="vacation-create-form" onSubmit={handleCreateRequest} className="space-y-5">
          {/* ── Employee Information ── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 bg-gray-50/50 dark:bg-gray-700/20">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">👤 Employee Information</h4>

            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  placeholder="John"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  placeholder="Doe"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Department + Shift */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value, shift: '', line: '', area: '' })}
                  title="Department"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select department...</option>
                  {dropdowns?.departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shift</label>
                <select
                  value={formData.shift}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value, area: '', line: '' })}
                  title="Shift"
                  disabled={!formData.department}
                  className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${!formData.department ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">{formData.department ? 'Select shift...' : 'Select department first'}</option>
                  {filteredShifts.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.startTime} – {s.endTime})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Area + Line */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Area</label>
                <select
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value, line: '' })}
                  title="Area"
                  disabled={!formData.shift}
                  className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${!formData.shift ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">{formData.shift ? 'Select area...' : 'Select shift first'}</option>
                  {filteredAreas.map(a => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Line</label>
                <select
                  value={formData.line}
                  onChange={(e) => setFormData({ ...formData, line: e.target.value })}
                  title="Line"
                  disabled={!formData.area}
                  className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${!formData.area ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">{formData.area ? 'Select line...' : 'Select area first'}</option>
                  {filteredLines.map(l => (
                    <option key={l.id} value={l.name}>{l.lineNumber ? `${l.lineNumber} – ${l.name}` : l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Phone + Employee ID */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <PhoneInput
                  label="Phone Number"
                  displayValue={formData.phoneDisplay}
                  e164Value={formData.phone}
                  onChange={(display, e164) => setFormData(prev => ({ ...prev, phoneDisplay: display, phone: e164 }))}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={formData.employeeCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setFormData({ ...formData, employeeCode: val });
                  }}
                  placeholder="12345"
                  maxLength={5}
                  pattern="\d{5}"
                  title="5-digit employee ID"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* ── Leave Details ── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 bg-gray-50/50 dark:bg-gray-700/20">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">📋 Leave Details</h4>

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Type *</label>
            <select
              value={formData.leaveType}
              onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
              title="Leave type"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="vacation">🏖️ Vacation</option>
              <option value="bereavement">🕯️ Bereavement</option>
              <option value="sick">🤒 Sick</option>
              <option value="emergency">🚨 Emergency</option>
              <option value="unpaid">📋 Unpaid</option>
              <option value="personal">👤 Personal</option>
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
              <DatePicker
                selected={formData.startDate ? parseLocal(formData.startDate) : null}
                onChange={(date: Date | null) => {
                  const v = date ? formatYMD(date) : '';
                  setFormData(prev => ({
                    ...prev,
                    startDate: v,
                    endDate: prev.endDate && prev.endDate < v ? '' : prev.endDate,
                  }));
                }}
                filterDate={isStartDateAllowed}
                minDate={new Date()}
                placeholderText="Select start date"
                dateFormat="MM/dd/yyyy"
                portalId="datepicker-portal"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              {settings?.minimumNoticeDays && (
                <p className="text-xs text-gray-400 mt-1">Must be at least {settings.minimumNoticeDays} days from today</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date *</label>
              <DatePicker
                selected={formData.endDate ? parseLocal(formData.endDate) : null}
                onChange={(date: Date | null) => {
                  const v = date ? formatYMD(date) : '';
                  setFormData(prev => ({ ...prev, endDate: v }));
                }}
                filterDate={isEndDateAllowed}
                minDate={formData.startDate ? parseLocal(formData.startDate) : new Date()}
                maxDate={maxEndDate}
                placeholderText="Select end date"
                dateFormat="MM/dd/yyyy"
                portalId="datepicker-portal"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              {settings?.maxConsecutiveDays && formData.startDate && (
                <p className="text-xs text-gray-400 mt-1">Max {settings.maxConsecutiveDays} consecutive days from start date</p>
              )}
            </div>
          </div>

          {/* Real-time constraint warnings */}
          {dateConstraintWarnings.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              {dateConstraintWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <span className="mt-0.5">⚠️</span> {w}
                </p>
              ))}
            </div>
          )}

          {/* Duration + Hours + Return */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days</label>
              <input
                type="number"
                title="Duration in business days"
                value={formData.durationDays}
                readOnly
                placeholder="Auto"
                min="1"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Hours</label>
              <input
                type="number"
                title="Total hours requesting"
                value={formData.durationHours}
                readOnly
                placeholder="Auto"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Return to Work</label>
              <DatePicker
                selected={formData.returnToWork ? parseLocal(formData.returnToWork) : null}
                onChange={() => {}}
                readOnly
                placeholderText="Auto-calculated"
                dateFormat="MM/dd/yyyy"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                'Family vacation',
                'Personal time off',
                'Medical appointment',
                'Family emergency',
                'Mental health day',
                'Travel plans',
                'Home repairs',
                'Wedding / event',
                'Religious observance',
                'Child care',
              ].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFormData(prev => {
                    const existing = prev.reason.split(',').map(s => s.trim()).filter(Boolean);
                    if (existing.includes(r)) {
                      return { ...prev, reason: existing.filter(s => s !== r).join(', ') };
                    }
                    return { ...prev, reason: existing.length ? `${existing.join(', ')}, ${r}` : r };
                  })}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    formData.reason.includes(r)
                      ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              placeholder="Select a quick reason above or type your own..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>
          </div>

          {/* ── Coverage & Emergency ── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 bg-gray-50/50 dark:bg-gray-700/20">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">📞 Coverage & Emergency</h4>

          {/* Coverage Plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Coverage Plan</label>
            <textarea
              value={formData.coveragePlan}
              onChange={(e) => setFormData({ ...formData, coveragePlan: e.target.value })}
              rows={2}
              placeholder="Who will cover your responsibilities?"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Emergency Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <PhoneInput
                label="Emergency Phone"
                displayValue={formData.emergencyPhoneDisplay}
                e164Value={formData.emergencyPhone}
                onChange={(display, e164) => setFormData(prev => ({ ...prev, emergencyPhoneDisplay: display, emergencyPhone: e164 }))}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emergency Email</label>
              <input
                type="email"
                value={formData.emergencyEmail}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({ ...prev, emergencyEmail: val }));
                  if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                    setEmailError('Please enter a valid email address');
                  } else {
                    setEmailError('');
                  }
                }}
                placeholder="emergency@email.com"
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  emailError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {emailError && (
                <p className="mt-1 text-xs text-red-500">{emailError}</p>
              )}
            </div>
          </div>
          </div>
        </form>
        </div>

        {/* ── Fixed Footer ── */}
        <div
          className="modal-fixed-footer flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-xl"
        >
          <button
            type="button"
            onClick={() => setShowCreateModal(false)}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="vacation-create-form"
            disabled={submitting}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );

  const ActivityPanel = () => (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'All Activity' },
          { value: 'new_requests', label: 'New Requests' },
          { value: 'approvals', label: 'Approvals' },
          { value: 'denials', label: 'Denials' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setActivityType(f.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activityType === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {activityLog.length === 0 && (
            <div className="p-8 text-center text-gray-500">No activity found</div>
          )}
          {activityLog.map((entry, i) => {
            const typeIcon: Record<string, string> = {
              new_request: '📝',
              approved: '✅',
              denied: '❌',
              modified: '✏️',
            };
            return (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <span className="text-xl mt-0.5">{typeIcon[entry.activity_type] || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {entry.Employee?.firstName} {entry.Employee?.lastName}
                    </p>
                    <span className={statusBadge(entry.status)}>{entry.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {leaveTypeBadge(entry.leaveType)} {entry.leaveType} · {fmtDateShort(entry.startDate)} - {fmtDateShort(entry.endDate)} · {entry.durationDays}d
                  </p>
                  {entry.approved_by_username && (
                    <p className="text-xs text-gray-400 mt-0.5">Decided by: {entry.approved_by_username}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(entry.activity_timestamp)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Modals
  // ──────────────────────────────────────────────────────────────────────────

  const ApproveModal = () => showApproveModal && selectedVacation ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Approve Vacation Request</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {selectedVacation.Employee?.firstName} {selectedVacation.Employee?.lastName} — {fmtDateShort(selectedVacation.startDate)} to {fmtDateShort(selectedVacation.endDate)}
        </p>
        <textarea
          value={decisionReason}
          onChange={(e) => setDecisionReason(e.target.value)}
          rows={3}
          placeholder="Optional: Add a note..."
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4 resize-none"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setShowApproveModal(false); setDecisionReason(''); }} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button onClick={handleApprove} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            Approve
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const DenyModal = () => showDenyModal && selectedVacation ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Deny Vacation Request</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {selectedVacation.Employee?.firstName} {selectedVacation.Employee?.lastName} — {fmtDateShort(selectedVacation.startDate)} to {fmtDateShort(selectedVacation.endDate)}
        </p>
        <textarea
          value={decisionReason}
          onChange={(e) => setDecisionReason(e.target.value)}
          rows={3}
          placeholder="Reason for denial (required)..."
          required
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4 resize-none"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setShowDenyModal(false); setDecisionReason(''); }} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button onClick={handleDeny} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
            Deny
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ──────────────────────────────────────────────────────────────────────────
  // Main Render
  // ──────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Vacation Hub...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Failed to Load Data</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'employees', label: 'Employees', icon: '👥' },
    { key: 'requests', label: 'Requests', icon: '📋' },
    { key: 'activity', label: 'Activity Log', icon: '📜' },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
        {/* Header */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    🏖️ Vacation Hub
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Manage employee vacation requests, schedules & constraints</p>
                </div>
              </div>

              {/* Right side: Settings + Notifications */}
              <div className="flex items-center gap-1">
                {/* Constraint Settings */}
                <button
                  onClick={() => setShowConstraintsModal(true)}
                  title="Vacation Constraint Settings"
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* Notifications */}
                <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h4>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:text-blue-700">Mark all read</button>
                      )}
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-gray-500 text-center">No notifications</p>
                      ) : notifications.map(n => (
                        <div key={n.id} className={`px-4 py-3 ${!n.isRead ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{fmtDate(n.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-4 flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <main className="p-4 md:p-6">
          {activeTab === 'overview' && <OverviewPanel />}
          {activeTab === 'employees' && <EmployeesPanel />}
          {activeTab === 'requests' && <RequestsPanel />}
          {activeTab === 'activity' && <ActivityPanel />}
        </main>

        {/* Modals */}
        <ApproveModal />
        <DenyModal />
        {createRequestModalJSX}
        <div id="datepicker-portal" />

        {/* Vacation Constraint Settings Modal */}
        {showConstraintsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Vacation Constraint Settings
                </h2>
                <button onClick={() => { setShowConstraintsModal(false); setEditingSettings(false); setShowBlackoutForm(false); }} title="Close" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Modal Body — scrollable */}
              <div className="px-6 py-5 overflow-y-auto space-y-6">

                {/* ── Vacation Settings Section ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">⚙️ Vacation Settings</h3>
                    <div className="flex gap-2">
                      {!editingSettings ? (
                        <>
                          <button
                            onClick={handleResetSettings}
                            className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                            title="Delete all settings records and reset to zero"
                          >
                            Reset to Zero
                          </button>
                          <button
                            onClick={() => {
                              if (!settings) return;
                              setSettingsForm({
                                standardAllocationDays: settings.standardAllocationDays,
                                minimumNoticeDays: settings.minimumNoticeDays,
                                maxConsecutiveDays: settings.maxConsecutiveDays,
                                minTeamCoveragePercent: settings.minTeamCoveragePercent,
                                maxSimultaneousAbsences: settings.maxSimultaneousAbsences,
                                criticalRoleCoverageRequired: settings.criticalRoleCoverageRequired,
                              });
                              setEditingSettings(true);
                            }}
                            disabled={!settings}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Edit
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingSettings(false)} className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                          <button onClick={handleSaveSettings} disabled={savingSettings} className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                            {savingSettings && <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                            {savingSettings ? 'Saving...' : 'Save'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Error state */}
                  {settingsError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-red-800 dark:text-red-300">Failed to load vacation settings</p>
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{settingsError}</p>
                          <button onClick={loadConstraints} className="mt-2 text-xs font-medium text-red-700 dark:text-red-300 underline hover:no-underline">
                            Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!settingsError && !editingSettings ? (
                    settings ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { label: 'Standard Allocation', value: `${settings.standardAllocationDays} days`, hint: 'The total number of vacation days each employee gets per year' },
                          { label: 'Minimum Notice', value: `${settings.minimumNoticeDays} days`, hint: 'How many days in advance a vacation request must be submitted' },
                          { label: 'Max Consecutive', value: `${settings.maxConsecutiveDays} days`, hint: 'The longest vacation an employee can take in one go without a break' },
                          { label: 'Min Team Coverage', value: `${settings.minTeamCoveragePercent}%`, hint: 'The minimum percentage of the team that must be present at all times' },
                          { label: 'Max Simultaneous', value: `${settings.maxSimultaneousAbsences}`, hint: 'The most employees that can be on vacation at the same time' },
                          { label: 'Critical Role Coverage', value: settings.criticalRoleCoverageRequired ? 'Required' : 'Not Required', hint: 'When enabled, employees in essential roles must arrange coverage before taking time off' },
                        ].map((item, i) => (
                          <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-help" title={item.hint}>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-6">
                        <svg className="w-5 h-5 text-blue-500 animate-spin mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        <p className="text-sm text-gray-500">Loading settings from database...</p>
                      </div>
                    )
                  ) : !settingsError && editingSettings ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" title="The total number of vacation days each employee gets per year">Standard Allocation (days)</label>
                        <input type="number" title="The total number of vacation days each employee gets per year" min="1" value={settingsForm.standardAllocationDays ?? ''} onChange={e => setSettingsForm({...settingsForm, standardAllocationDays: e.target.value ? Number(e.target.value) : undefined})}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" title="How many days in advance a vacation request must be submitted">Minimum Notice (days)</label>
                        <input type="number" title="How many days in advance a vacation request must be submitted" min="0" value={settingsForm.minimumNoticeDays ?? ''} onChange={e => setSettingsForm({...settingsForm, minimumNoticeDays: e.target.value ? Number(e.target.value) : undefined})}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" title="The longest vacation an employee can take in one go without a break">Max Consecutive Days</label>
                        <input type="number" title="The longest vacation an employee can take in one go without a break" min="1" value={settingsForm.maxConsecutiveDays ?? ''} onChange={e => setSettingsForm({...settingsForm, maxConsecutiveDays: e.target.value ? Number(e.target.value) : undefined})}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" title="The minimum percentage of the team that must be present at all times">Min Team Coverage (%)</label>
                        <input type="number" title="The minimum percentage of the team that must be present at all times" min="0" max="100" value={settingsForm.minTeamCoveragePercent ?? ''} onChange={e => setSettingsForm({...settingsForm, minTeamCoveragePercent: e.target.value ? Number(e.target.value) : undefined})}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" title="The most employees that can be on vacation at the same time">Max Simultaneous Absences</label>
                        <input type="number" title="The most employees that can be on vacation at the same time" min="1" value={settingsForm.maxSimultaneousAbsences ?? ''} onChange={e => setSettingsForm({...settingsForm, maxSimultaneousAbsences: e.target.value ? Number(e.target.value) : undefined})}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <input type="checkbox" title="When enabled, employees in essential roles must arrange coverage before taking time off" checked={settingsForm.criticalRoleCoverageRequired ?? false} onChange={e => setSettingsForm({...settingsForm, criticalRoleCoverageRequired: e.target.checked})}
                          className="rounded border-gray-300 text-blue-600" />
                        <label className="text-sm text-gray-700 dark:text-gray-300" title="When enabled, employees in essential roles must arrange coverage before taking time off">Critical Role Coverage</label>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Divider */}
                <hr className="border-gray-200 dark:border-gray-700" />

                {/* ── Blackout Periods Section ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">🚫 Blackout Periods</h3>
                    {!showBlackoutForm && (
                      <button
                        onClick={() => { setBlackoutForm({ name: '', startDate: '', endDate: '', description: '' }); setShowBlackoutForm(true); }}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        + Add
                      </button>
                    )}
                  </div>

                  {/* Inline Add Blackout Form */}
                  {showBlackoutForm && (
                    <form onSubmit={handleCreateBlackout} className="p-4 mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">New Blackout Period</p>
                        <button type="button" onClick={() => setShowBlackoutForm(false)} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Cancel</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Period Name *</label>
                          <input type="text" placeholder="e.g., Year-End Close" value={blackoutForm.name} onChange={e => setBlackoutForm({...blackoutForm, name: e.target.value})} required
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date *</label>
                          <DatePicker
                            selected={blackoutForm.startDate ? parseLocal(blackoutForm.startDate) : null}
                            onChange={(date: Date | null) => setBlackoutForm({...blackoutForm, startDate: date ? formatYMD(date) : ''})}
                            placeholderText="Select start date"
                            dateFormat="MM/dd/yyyy"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Date *</label>
                          <DatePicker
                            selected={blackoutForm.endDate ? parseLocal(blackoutForm.endDate) : null}
                            onChange={(date: Date | null) => setBlackoutForm({...blackoutForm, endDate: date ? formatYMD(date) : ''})}
                            minDate={blackoutForm.startDate ? parseLocal(blackoutForm.startDate) : undefined}
                            placeholderText="Select end date"
                            dateFormat="MM/dd/yyyy"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            required
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description (optional)</label>
                          <input type="text" placeholder="Brief description" value={blackoutForm.description} onChange={e => setBlackoutForm({...blackoutForm, description: e.target.value})}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                      </div>
                      <button type="submit" className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Create Blackout Period</button>
                    </form>
                  )}

                  {/* Blackout Periods List */}
                  <div className="space-y-2">
                    {blackoutPeriods.length === 0 && !showBlackoutForm && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No blackout periods configured</p>
                    )}
                    {blackoutPeriods.map(bp => (
                      <div key={bp.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{bp.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(bp.startDate)} - {fmtDate(bp.endDate)}</p>
                          {bp.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{bp.description}</p>}
                        </div>
                        <button onClick={() => handleDeleteBlackout(bp.id)} title="Delete blackout period" className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end flex-shrink-0">
                <button onClick={() => { setShowConstraintsModal(false); setEditingSettings(false); setShowBlackoutForm(false); }} className="px-5 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Success Modal */}
        {showSaveSuccess && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Settings Saved Successfully</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your vacation constraint settings have been saved to the database and are now active.</p>
              {settings && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-left space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Current Values:</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Standard Allocation: <span className="font-semibold">{settings.standardAllocationDays} days</span></p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Minimum Notice: <span className="font-semibold">{settings.minimumNoticeDays} days</span></p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Max Consecutive: <span className="font-semibold">{settings.maxConsecutiveDays} days</span></p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Min Team Coverage: <span className="font-semibold">{settings.minTeamCoveragePercent}%</span></p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Max Simultaneous: <span className="font-semibold">{settings.maxSimultaneousAbsences}</span></p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Critical Role Coverage: <span className="font-semibold">{settings.criticalRoleCoverageRequired ? 'Required' : 'Not Required'}</span></p>
                </div>
              )}
              <button
                onClick={() => setShowSaveSuccess(false)}
                className="mt-5 px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
