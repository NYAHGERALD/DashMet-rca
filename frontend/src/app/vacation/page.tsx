'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Link from 'next/link';
import * as vacApi from '@/lib/vacationApi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PhoneInput from '@/components/PhoneInput';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, CheckCircle2, Maximize2, Minimize2, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';

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

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UTC_MIDNIGHT_REGEX = /T00:00:00(?:\.000)?Z$/;
const DEFAULT_LEAVE_TYPES = ['vacation', 'bereavement', 'sick', 'emergency', 'unpaid', 'personal'];
const DEFAULT_VACATION_HOURS_PER_DAY = 8;

function normalizeLeaveTypeName(input?: string | null): string {
  return (input || '').trim().replace(/\s+/g, ' ');
}

function leaveTypeKey(input?: string | null): string {
  return normalizeLeaveTypeName(input).toLowerCase();
}

function normalizeLeaveTypeOptions(types?: string[] | null): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const type of types || []) {
    const name = normalizeLeaveTypeName(type);
    const key = leaveTypeKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    normalized.push(name);
  }

  return normalized.length > 0 ? normalized : DEFAULT_LEAVE_TYPES;
}

function normalizeVacationHoursPerDay(input?: number | null): number {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_VACATION_HOURS_PER_DAY;
}

function extractDateOnlyParts(input: string): { year: number; month: number; day: number } | null {
  if (DATE_ONLY_REGEX.test(input)) {
    const [year, month, day] = input.split('-').map(Number);
    return { year, month, day };
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
}

function formatDateOnly(input: string, options: Intl.DateTimeFormatOptions): string {
  const parts = extractDateOnlyParts(input);
  if (!parts) return '—';

  const localDate = new Date(parts.year, parts.month - 1, parts.day);
  return localDate.toLocaleDateString('en-US', options);
}

function formatDateWithTimezone(
  input: string,
  options: Intl.DateTimeFormatOptions,
  timezone: string
): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { ...options, timeZone: timezone });
}

function isDateOnlyLike(input: string): boolean {
  return DATE_ONLY_REGEX.test(input) || UTC_MIDNIGHT_REGEX.test(input);
}

function toDateInputValue(input: string | null | undefined): string {
  if (!input) return '';
  const parts = extractDateOnlyParts(input);
  if (!parts) return '';
  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const parts = extractDateOnlyParts(input);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day);
}

function addLocalDays(input: Date, days: number): Date {
  const next = new Date(input);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
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
type OverviewVacationFilter = 'upcoming' | 'pending' | 'recent';
type CalendarVacationEvent = { request: vacApi.VacationRequest; start: Date; end: Date; employeeName: string };

export default function VacationHubPage() {
  const { user } = useAuth();
  const preferredTimezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Overview data ──
  const [stats, setStats] = useState<vacApi.VacationStats | null>(null);
  const [upcoming, setUpcoming] = useState<vacApi.VacationRequest[]>([]);
  const [pending, setPending] = useState<vacApi.VacationRequest[]>([]);
  const [recent, setRecent] = useState<vacApi.VacationRequest[]>([]);
  const [overviewRequests, setOverviewRequests] = useState<vacApi.VacationRequest[]>([]);
  const [conflicts, setConflicts] = useState<vacApi.VacationConflict[]>([]);
  const [overviewVacationFilter, setOverviewVacationFilter] = useState<OverviewVacationFilter>('upcoming');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  // ── Employees ──
  const [employees, setEmployees] = useState<vacApi.EmployeeDirectoryEntry[]>([]);
  const [requesterEmployees, setRequesterEmployees] = useState<vacApi.EmployeeDirectoryEntry[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [empDeptFilter, setEmpDeptFilter] = useState('all');
  const [empStatusFilter, setEmpStatusFilter] = useState('all');
  const [empSearch, setEmpSearch] = useState('');

  // ── Requests ──
  const [requests, setRequests] = useState<vacApi.VacationRequest[]>([]);
  const [reqStatusFilter, setReqStatusFilter] = useState('all');
  const requestMenuRef = useRef<HTMLDivElement | null>(null);
  const [requestActionMenu, setRequestActionMenu] = useState<{
    request: vacApi.VacationRequest;
    x: number;
    y: number;
  } | null>(null);

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
  const [selectedRequesterId, setSelectedRequesterId] = useState('');

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
  const [newLeaveType, setNewLeaveType] = useState('');

  // ── Activity ──
  const [activityLog, setActivityLog] = useState<vacApi.ActivityLogEntry[]>([]);
  const [activityType, setActivityType] = useState('all');

  // ── Modal ──
  const [selectedVacation, setSelectedVacation] = useState<vacApi.VacationRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');
  const [editForm, setEditForm] = useState({
    id: 0,
    leaveType: 'vacation',
    startDate: '',
    endDate: '',
    reason: '',
  });

  // ── Notifications ──
  const [notifications, setNotifications] = useState<vacApi.VacationNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ──────────────────────────────────────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    try {
      const [s, u, p, r, c, allRequests] = await Promise.all([
        vacApi.getVacationStats(),
        vacApi.getUpcomingVacations(),
        vacApi.getPendingVacations(),
        vacApi.getRecentVacations(),
        vacApi.getVacationConflicts(),
        vacApi.getVacationRequests('all'),
      ]);
      setStats(s);
      setUpcoming(u);
      setPending(p);
      setRecent(r);
      setConflicts(c);
      setOverviewRequests(allRequests);
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

  const loadRequesterEmployees = useCallback(async () => {
    try {
      const [allRequests, allEmployees] = await Promise.all([
        vacApi.getVacationRequests('all'),
        vacApi.getEmployeesDirectory({ department: 'all', status: 'all' }),
      ]);

      const requesterIds = new Set(allRequests.map(r => r.employeeId).filter(Boolean));
      const requesters = allEmployees
        .filter(emp => requesterIds.has(emp.id))
        .sort((a, b) => {
          const byFirst = a.firstname.localeCompare(b.firstname);
          if (byFirst !== 0) return byFirst;
          return a.lastname.localeCompare(b.lastname);
        });

      setRequesterEmployees(requesters);
    } catch (e: any) {
      console.error('Error loading requester employees:', e);
    }
  }, []);

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

  const leaveTypeOptions = useMemo(() => {
    return normalizeLeaveTypeOptions(settings?.leaveTypes);
  }, [settings?.leaveTypes]);

  const vacationHoursPerDay = useMemo(() => {
    return normalizeVacationHoursPerDay(settings?.vacationHoursPerDay);
  }, [settings?.vacationHoursPerDay]);

  const getHoursForDays = useCallback((days: number) => days * vacationHoursPerDay, [vacationHoursPerDay]);

  const editableLeaveTypes = useMemo(() => {
    return normalizeLeaveTypeOptions(settingsForm.leaveTypes ?? settings?.leaveTypes);
  }, [settingsForm.leaveTypes, settings?.leaveTypes]);

  const editLeaveTypeOptions = useMemo(() => {
    return normalizeLeaveTypeOptions([editForm.leaveType, ...leaveTypeOptions]);
  }, [editForm.leaveType, leaveTypeOptions]);

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

  useEffect(() => {
    const defaultLeaveType = leaveTypeOptions[0] || DEFAULT_LEAVE_TYPES[0];
    setFormData(prev => (
      leaveTypeOptions.some(type => leaveTypeKey(type) === leaveTypeKey(prev.leaveType))
        ? prev
        : { ...prev, leaveType: defaultLeaveType }
    ));
  }, [leaveTypeOptions]);

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
        durationHours: String(getHoursForDays(dur)),
        returnToWork: formatYMD(ret),
      }));
    } else {
      setFormData(prev => ({ ...prev, durationDays: '', durationHours: '', returnToWork: '' }));
    }
  }, [formData.startDate, formData.endDate, getHoursForDays]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadOverview(),
          loadEmployees(),
          loadNotifications(),
          loadDropdowns(),
          loadConstraints(),
          loadRequesterEmployees(),
        ]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadOverview, loadEmployees, loadNotifications, loadDropdowns, loadConstraints, loadRequesterEmployees]);

  // Tab-specific loads
  useEffect(() => {
    if (activeTab === 'requests') loadRequests();
    if (activeTab === 'activity') loadActivity();
    if (activeTab === 'employees') loadEmployees();
  }, [activeTab, loadRequests, loadActivity, loadEmployees]);

  const closeRequestActionMenu = useCallback(() => {
    setRequestActionMenu(null);
  }, []);

  const openRequestActionMenu = useCallback((event: React.MouseEvent, request: vacApi.VacationRequest) => {
    event.preventDefault();
    const menuWidth = 236;
    const menuHeight = request.status === 'pending' ? 224 : request.status === 'cancelled' ? 180 : 140;
    const viewportPadding = 12;
    const nextX = Math.min(event.clientX, window.innerWidth - menuWidth - viewportPadding);
    const nextY = Math.min(event.clientY, window.innerHeight - menuHeight - viewportPadding);

    setRequestActionMenu({
      request,
      x: Math.max(viewportPadding, nextX),
      y: Math.max(viewportPadding, nextY),
    });
  }, []);

  useEffect(() => {
    if (!requestActionMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (requestMenuRef.current?.contains(event.target as Node)) return;
      closeRequestActionMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRequestActionMenu();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeRequestActionMenu);
    window.addEventListener('scroll', closeRequestActionMenu, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeRequestActionMenu);
      window.removeEventListener('scroll', closeRequestActionMenu, true);
    };
  }, [closeRequestActionMenu, requestActionMenu]);

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
        employeeId: selectedRequesterId ? Number(selectedRequesterId) : undefined,
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
      setFormData({ firstName: '', lastName: '', department: '', shift: '', line: '', area: '', phone: '', phoneDisplay: '', employeeCode: '', leaveType: leaveTypeOptions[0] || DEFAULT_LEAVE_TYPES[0], startDate: '', endDate: '', durationDays: '', durationHours: '', returnToWork: '', reason: '', coveragePlan: '', emergencyPhone: '', emergencyPhoneDisplay: '', emergencyEmail: '' });
      setSelectedRequesterId('');
      setShowCreateModal(false);
      await loadOverview();
      await loadRequests();
      await loadEmployees();
      await loadRequesterEmployees();
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

  const handleOpenEdit = (vacation: vacApi.VacationRequest) => {
    setEditForm({
      id: vacation.id,
      leaveType: vacation.leaveType || 'vacation',
      startDate: toDateInputValue(vacation.startDate),
      endDate: toDateInputValue(vacation.endDate),
      reason: vacation.reason || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.id || !editForm.startDate || !editForm.endDate) {
      alert('Start date and end date are required.');
      return;
    }
    if (editForm.endDate < editForm.startDate) {
      alert('End date must be after or equal to start date.');
      return;
    }
    try {
      const durationDays = countBusinessDays(parseLocal(editForm.startDate), parseLocal(editForm.endDate));
      await vacApi.updateVacation(editForm.id, {
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        leaveType: editForm.leaveType,
        reason: editForm.reason,
        durationDays,
        durationHours: getHoursForDays(durationDays),
      });
      setShowEditModal(false);
      await Promise.all([loadOverview(), loadRequests(), loadEmployees()]);
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const handleCancelVacation = async (vacation: vacApi.VacationRequest) => {
    const employeeName = `${vacation.Employee?.firstName || ''} ${vacation.Employee?.lastName || ''}`.trim();
    const confirmed = window.confirm(
      `Cancel this vacation request${employeeName ? ` for ${employeeName}` : ''}? It will move to the Cancelled tab.`
    );
    if (!confirmed) return;

    try {
      await vacApi.cancelVacation(vacation.id);
      const [cancelledRequests] = await Promise.all([
        vacApi.getVacationRequests('cancelled'),
        loadOverview(),
        loadEmployees(),
      ]);
      setReqStatusFilter('cancelled');
      setRequests(cancelledRequests);
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const handlePutBackVacation = async (vacation: vacApi.VacationRequest) => {
    const employeeName = `${vacation.Employee?.firstName || ''} ${vacation.Employee?.lastName || ''}`.trim();
    const confirmed = window.confirm(
      `Put back this cancelled vacation request${employeeName ? ` for ${employeeName}` : ''} to its original status?`
    );
    if (!confirmed) return;

    try {
      const restored = await vacApi.putBackVacation(vacation.id);
      const restoredStatus = restored.status || 'all';
      const [restoredRequests] = await Promise.all([
        vacApi.getVacationRequests(restoredStatus),
        loadOverview(),
        loadEmployees(),
      ]);
      setReqStatusFilter(restoredStatus);
      setRequests(restoredRequests);
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const handleDeleteCancelled = async (vacation: vacApi.VacationRequest) => {
    const employeeName = `${vacation.Employee?.firstName || ''} ${vacation.Employee?.lastName || ''}`.trim();
    const confirmed = window.confirm(
      `Delete this cancelled vacation request${employeeName ? ` for ${employeeName}` : ''}? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await vacApi.deleteVacationRequest(vacation.id);
      await Promise.all([loadOverview(), loadRequests(), loadEmployees()]);
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
      setNewLeaveType('');
      // Also reload from DB to confirm the values persisted
      await Promise.all([loadConstraints(), loadOverview(), loadRequests(), loadEmployees(), loadActivity()]);
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
      setNewLeaveType('');
      await Promise.all([loadConstraints(), loadOverview(), loadRequests(), loadEmployees(), loadActivity()]);
    } catch (e: any) {
      console.error('[handleResetSettings] Error:', e);
      alert(e.response?.data?.error || e.message || 'Failed to reset settings.');
    }
  };

  const handleAddLeaveType = () => {
    const name = normalizeLeaveTypeName(newLeaveType);
    if (!name) return;

    setSettingsForm(prev => {
      const current = normalizeLeaveTypeOptions(prev.leaveTypes ?? settings?.leaveTypes);
      if (current.some(type => leaveTypeKey(type) === leaveTypeKey(name))) return prev;
      return { ...prev, leaveTypes: [...current, name] };
    });
    setNewLeaveType('');
  };

  const handleRemoveLeaveType = (typeToRemove: string) => {
    setSettingsForm(prev => {
      const current = normalizeLeaveTypeOptions(prev.leaveTypes ?? settings?.leaveTypes);
      const next = current.filter(type => leaveTypeKey(type) !== leaveTypeKey(typeToRemove));
      return { ...prev, leaveTypes: next.length > 0 ? next : current };
    });
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
    if (isDateOnlyLike(d)) {
      return formatDateOnly(d, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return formatDateWithTimezone(d, { month: 'short', day: 'numeric', year: 'numeric' }, preferredTimezone);
  };

  const fmtDateShort = (d: string | null) => {
    if (!d) return '—';
    if (isDateOnlyLike(d)) {
      return formatDateOnly(d, { month: 'short', day: 'numeric' });
    }
    return formatDateWithTimezone(d, { month: 'short', day: 'numeric' }, preferredTimezone);
  };

  const fmtDateLong = (d: string | null) => {
    if (!d) return '—';
    const parts = d ? extractDateOnlyParts(d) : null;
    const date = parts ? new Date(parts.year, parts.month - 1, parts.day) : new Date(d);
    if (Number.isNaN(date.getTime())) return '—';

    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...(parts ? {} : { timeZone: preferredTimezone }),
    });
    const dateParts = formatter.formatToParts(date);
    const getPart = (type: Intl.DateTimeFormatPartTypes) => dateParts.find(part => part.type === type)?.value || '';

    return `${getPart('weekday')}, ${getPart('month')} ${getPart('day')} ${getPart('year')}`;
  };

  const fmtDateRangeLong = (start: string | null, end: string | null) => {
    return `${fmtDateLong(start)} - ${fmtDateLong(end)}`;
  };

  const getRequestHours = (request: vacApi.VacationRequest) => {
    const days = Number(request.durationDays);
    return Number.isFinite(days) && days > 0
      ? getHoursForDays(days)
      : request.durationHours ?? 0;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800/70',
      approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800/70',
      denied: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-800/70',
      cancelled: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
    };
    return `inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${map[status] || map.pending}`;
  };

  const formatLabel = (value: string | null | undefined) => {
    if (!value) return 'Unknown';
    return value
      .replace(/_/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const leaveTypeBadge = (type: string) => formatLabel(type);

  const leaveTypePill = (type: string) => {
    const map: Record<string, string> = {
      vacation: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:ring-sky-800/70',
      bereavement: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:ring-violet-800/70',
      sick: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800/70',
      emergency: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-800/70',
      unpaid: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
      personal: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:ring-teal-800/70',
    };
    const normalizedType = leaveTypeKey(type);
    return `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[normalizedType] || map.vacation}`;
  };

  const employeeNameForRequest = (request: vacApi.VacationRequest) => {
    return `${request.Employee?.firstName || ''} ${request.Employee?.lastName || ''}`.trim() || 'Unknown Employee';
  };

  const employeeInitials = (name: string) => {
    const initials = name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');

    return initials || 'VE';
  };

  const filteredEmployees = employees.filter(emp => {
    if (!empSearch) return true;
    const q = empSearch.toLowerCase();
    return `${emp.firstname} ${emp.lastname}`.toLowerCase().includes(q) ||
      (emp.role || '').toLowerCase().includes(q) ||
      (emp.workarea || '').toLowerCase().includes(q);
  });

  const overviewTableOptions: { value: OverviewVacationFilter; label: string; count: number }[] = [
    { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { value: 'pending', label: 'Pending', count: pending.length },
    { value: 'recent', label: 'Recent Decisions', count: recent.length },
  ];

  const overviewTableRows = useMemo(() => {
    if (overviewVacationFilter === 'pending') return pending;
    if (overviewVacationFilter === 'recent') return recent;
    return upcoming;
  }, [overviewVacationFilter, pending, recent, upcoming]);

  const overviewFilterLabel = overviewTableOptions.find(option => option.value === overviewVacationFilter)?.label || 'Upcoming';

  const calendarMonthStart = useMemo(() => {
    return new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  }, [calendarMonth]);

  const calendarMonthEnd = useMemo(() => {
    return new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  }, [calendarMonth]);

  const calendarDays = useMemo(() => {
    const gridStart = addLocalDays(calendarMonthStart, -calendarMonthStart.getDay());
    return Array.from({ length: 42 }, (_, index) => addLocalDays(gridStart, index));
  }, [calendarMonthStart]);

  const calendarYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const selectedYear = calendarMonth.getFullYear();
    const firstYear = Math.min(currentYear - 5, selectedYear - 2);
    const lastYear = Math.max(currentYear + 5, selectedYear + 2);
    return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  }, [calendarMonth]);

  const calendarVacationEvents = useMemo(() => {
    return overviewRequests
      .filter(request => request.status === 'approved' || request.status === 'pending')
      .map(request => {
        const start = toLocalDate(request.startDate);
        const end = toLocalDate(request.endDate);
        if (!start || !end) return null;
        return { request, start, end, employeeName: employeeNameForRequest(request) };
      })
      .filter((event): event is CalendarVacationEvent => {
        if (!event) return false;
        return event.start <= calendarMonthEnd && event.end >= calendarMonthStart;
      });
  }, [calendarMonthEnd, calendarMonthStart, overviewRequests]);

  const calendarEventVisual = (event: CalendarVacationEvent) => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const status = event.request.status.toLowerCase();

    if (event.end < todayStart) {
      return {
        badge: 'Past',
        abbr: 'Past',
        pillClass: 'border-yellow-200 bg-yellow-100 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100',
        badgeClass: 'bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100',
      };
    }

    if (status === 'pending') {
      return {
        badge: 'Pending',
        abbr: 'Pending',
        pillClass: 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-100',
        badgeClass: 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100',
      };
    }

    if (event.start <= todayStart) {
      return {
        badge: 'Approved',
        abbr: 'Approved',
        pillClass: 'border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100',
        badgeClass: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100',
      };
    }

    return {
      badge: 'Upcoming',
      abbr: 'Upcoming',
      pillClass: 'border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100',
      badgeClass: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100',
    };
  };

  const changeCalendarMonth = useCallback((offset: number) => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Tab Panels
  // ──────────────────────────────────────────────────────────────────────────

  const OverviewPanel = () => (
    <div className="h-full max-h-full flex flex-col gap-2 overflow-hidden">
      {!isCalendarExpanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-0.5">
          {[
            { label: 'Total Requests', value: stats?.total_requests || 0 },
            { label: 'Pending', value: stats?.pending || 0 },
            { label: 'Approved', value: stats?.approved || 0 },
            { label: 'Denied', value: stats?.denied || 0 },
            { label: 'Cancelled', value: stats?.cancelled || 0 },
            { label: 'Days Used (YTD)', value: stats?.days_used_ytd || 0 },
            { label: 'Employees', value: stats?.total_employees || 0 },
          ].map((card, i) => (
            <div key={i} className="h-20 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {!isCalendarExpanded && conflicts.length > 0 && (
        <div className="max-h-28 shrink-0 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Scheduling Conflicts ({conflicts.length})</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {conflicts.map((c, i) => (
              <div key={i} className={`rounded-lg p-2 ${c.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                <p className="text-sm font-medium">{c.title}</p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={isCalendarExpanded ? 'flex-1 min-h-0 pb-0' : 'grid flex-1 min-h-0 gap-3 pb-0 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'}>
        {!isCalendarExpanded && (
        <section className="flex min-h-[430px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 xl:order-2 xl:min-h-0">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Vacation Requests</h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{overviewTableRows.length} {overviewFilterLabel.toLowerCase()}</p>
            </div>
            <select
              value={overviewVacationFilter}
              onChange={(event) => setOverviewVacationFilter(event.target.value as OverviewVacationFilter)}
              title="Select vacation request view"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {overviewTableOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label} ({option.count})</option>
              ))}
            </select>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50/95 text-left dark:border-gray-700 dark:bg-gray-900/40">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Employee</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Dates</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Hours</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Status</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {overviewTableRows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">No {overviewFilterLabel.toLowerCase()} found</td></tr>
                )}
                {overviewTableRows.map((request) => (
                  <tr key={`${overviewVacationFilter}-${request.id}`} className="transition-colors hover:bg-gray-50/90 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600">
                          {employeeInitials(employeeNameForRequest(request))}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-white">{employeeNameForRequest(request)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Request #{request.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={leaveTypePill(request.leaveType)}>{leaveTypeBadge(request.leaveType)}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{fmtDateShort(request.startDate)} - {fmtDateShort(request.endDate)}</span>
                      {request.reason && <p className="mt-1 max-w-52 truncate text-gray-500 dark:text-gray-400">{request.reason}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{getRequestHours(request)}</td>
                    <td className="px-4 py-3"><span className={statusBadge(request.status)}>{formatLabel(request.status)}</span></td>
                    <td className="px-3 py-3 text-right">
                      {request.status === 'pending' ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setSelectedVacation(request); setShowApproveModal(true); }}
                            title="Approve request"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSelectedVacation(request); setShowDenyModal(true); }}
                            title="Deny request"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white transition-colors hover:bg-red-700"
                          >
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        )}

        <section className={`flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
          isCalendarExpanded ? 'h-full min-h-0' : 'min-h-[560px] xl:order-1 xl:min-h-0'
        }`}>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Vacation Calendar</h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {calendarVacationEvents.length} active request{calendarVacationEvents.length === 1 ? '' : 's'} in {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => changeCalendarMonth(-1)}
                className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Prev
              </button>
              <select
                value={calendarMonth.getMonth()}
                onChange={(event) => setCalendarMonth(prev => new Date(prev.getFullYear(), Number(event.target.value), 1))}
                title="Calendar month"
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {Array.from({ length: 12 }, (_, monthIndex) => (
                  <option key={monthIndex} value={monthIndex}>
                    {new Date(2000, monthIndex, 1).toLocaleDateString('en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={calendarMonth.getFullYear()}
                onChange={(event) => setCalendarMonth(prev => new Date(Number(event.target.value), prev.getMonth(), 1))}
                title="Calendar year"
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {calendarYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
              <button
                type="button"
                onClick={() => changeCalendarMonth(1)}
                className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                }}
                className="h-9 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setIsCalendarExpanded(prev => !prev)}
                title={isCalendarExpanded ? 'Restore calendar' : 'Expand calendar'}
                aria-label={isCalendarExpanded ? 'Restore calendar' : 'Expand calendar'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {isCalendarExpanded ? (
                  <Minimize2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className={isCalendarExpanded ? 'flex min-h-full min-w-[760px] flex-col' : ''}>
              <div className="grid min-w-[760px] shrink-0 grid-cols-7 rounded-t-lg border border-b-0 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="border-r border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-500 last:border-r-0 dark:border-gray-700 dark:text-gray-300">
                    {day}
                  </div>
                ))}
              </div>
              <div className={`grid min-w-[760px] grid-cols-7 rounded-b-lg border border-gray-200 dark:border-gray-700 ${
                isCalendarExpanded ? 'min-h-[620px] flex-1 grid-rows-6' : ''
              }`}>
              {calendarDays.map((day) => {
                const inCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                const isToday = isSameLocalDate(day, new Date());
                const eventsForDay = calendarVacationEvents.filter(event => day >= event.start && day <= event.end);
                const dayBadgeEvents = eventsForDay.slice(0, 3);
                const visibleEvents = isCalendarExpanded ? eventsForDay : eventsForDay.slice(0, 3);

                return (
                  <div
                    key={formatYMD(day)}
                    className={`border-r border-b border-gray-200 p-2 last:border-r-0 dark:border-gray-700 ${
                      isCalendarExpanded ? 'flex min-h-0 flex-col overflow-hidden' : 'min-h-[104px]'
                    } ${
                      inCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/70 text-gray-400 dark:bg-gray-900/20'
                    }`}
                  >
                    <div className="flex shrink-0 items-start justify-between gap-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          isToday
                            ? 'bg-blue-600 text-white'
                            : inCurrentMonth
                              ? 'text-gray-700 dark:text-gray-200'
                              : 'text-gray-400'
                        }`}>
                          {day.getDate()}
                        </span>
                        {dayBadgeEvents.map(event => {
                          const visual = calendarEventVisual(event);
                          return (
                            <span
                              key={`${event.request.id}-${formatYMD(day)}-badge`}
                              title={`${visual.badge}: ${event.employeeName}`}
                              className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${visual.badgeClass}`}
                            >
                              {visual.abbr}
                            </span>
                          );
                        })}
                      </div>
                      {eventsForDay.length > dayBadgeEvents.length && (
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">+{eventsForDay.length - dayBadgeEvents.length}</span>
                      )}
                    </div>
                    <div className={`mt-2 space-y-1 ${isCalendarExpanded ? 'min-h-0 flex-1 overflow-y-auto pr-1' : ''}`}>
                      {visibleEvents.map(event => {
                        const startsHere = isSameLocalDate(day, event.start);
                        const endsHere = isSameLocalDate(day, event.end);
                        const visual = calendarEventVisual(event);
                        return (
                          <div
                            key={`${event.request.id}-${formatYMD(day)}`}
                            title={`${event.employeeName}: ${visual.badge} · ${fmtDateShort(event.request.startDate)} - ${fmtDateShort(event.request.endDate)}`}
                            className={`truncate border px-1.5 py-1 text-[10px] font-semibold shadow-sm ${
                              startsHere ? 'rounded-l-lg' : 'rounded-l-sm'
                            } ${endsHere ? 'rounded-r-lg' : 'rounded-r-sm'} ${visual.pillClass}`}
                          >
                            {event.employeeName}
                          </div>
                        );
                      })}
                      {eventsForDay.length > visibleEvents.length && (
                        <div className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                          +{eventsForDay.length - visibleEvents.length} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  const EmployeesPanel = () => (
    <div className="h-full max-h-full flex flex-col gap-2 overflow-hidden">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 shrink-0">
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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-0">
        <div className="h-full overflow-auto">
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
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Used (Hours)</th>
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
                  <td className="px-4 py-3">{getHoursForDays(emp.vacation_days_used || 0)}h</td>
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
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Filter + Create Button */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm dark:border-gray-700 dark:bg-gray-800/90">
          {['all', 'pending', 'approved', 'denied', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setReqStatusFilter(s)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                reqStatusFilter === s
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setShowCreateModal(true); if (!dropdowns) loadDropdowns(); loadRequesterEmployees(); }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Request
        </button>
      </div>

      {/* Requests Table */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="h-full w-full overflow-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50/95 text-left dark:border-gray-700 dark:bg-gray-900/40">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Employee</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Dates</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Hours</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Submitted</th>
                <th className="w-12 px-3 py-3">
                  <span className="sr-only">Options</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {requests.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No requests found</td></tr>
              )}
              {requests.map((req) => {
                const employeeName = employeeNameForRequest(req);
                const isActiveMenuRow = requestActionMenu?.request.id === req.id;

                return (
                  <tr
                    key={req.id}
                    onContextMenu={(event) => openRequestActionMenu(event, req)}
                    className={`group cursor-context-menu transition-colors ${
                      isActiveMenuRow
                        ? 'bg-blue-50/80 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50/90 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600">
                          {employeeInitials(employeeName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-white">{employeeName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Request #{req.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={leaveTypePill(req.leaveType)}>{leaveTypeBadge(req.leaveType)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {fmtDateRangeLong(req.startDate, req.endDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900 dark:text-white">{getRequestHours(req)}</span>
                    </td>
                    <td className="px-4 py-3"><span className={statusBadge(req.status)}>{formatLabel(req.status)}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtDate(req.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openRequestActionMenu(event, req);
                        }}
                        title="Open request options"
                        aria-haspopup="menu"
                        aria-expanded={isActiveMenuRow}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-gray-500 transition-all hover:border-gray-200 hover:bg-white hover:text-gray-900 focus:border-blue-200 focus:bg-white focus:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white dark:focus:border-blue-800 dark:focus:bg-gray-700 ${
                          isActiveMenuRow ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                        }`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const RequestActionMenu = () => {
    const menuRequest = requestActionMenu?.request;

    const actions = menuRequest
      ? [
          ...(menuRequest.status === 'pending'
            ? [
                {
                  label: 'Edit request',
                  icon: <Pencil className="h-4 w-4" aria-hidden="true" />,
                  onSelect: () => handleOpenEdit(menuRequest),
                  tone: 'default' as const,
                },
                {
                  label: 'Approve request',
                  icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
                  onSelect: () => {
                    setSelectedVacation(menuRequest);
                    setShowApproveModal(true);
                  },
                  tone: 'success' as const,
                },
                {
                  label: 'Deny request',
                  icon: <XCircle className="h-4 w-4" aria-hidden="true" />,
                  onSelect: () => {
                    setSelectedVacation(menuRequest);
                    setShowDenyModal(true);
                  },
                  tone: 'danger' as const,
                },
              ]
            : []),
          ...(menuRequest.status !== 'cancelled'
            ? [
                {
                  label: 'Cancel request',
                  icon: <Ban className="h-4 w-4" aria-hidden="true" />,
                  onSelect: () => handleCancelVacation(menuRequest),
                  tone: 'muted' as const,
                },
              ]
            : []),
          ...(menuRequest.status === 'cancelled'
            ? [
                {
                  label: 'Put back',
                  icon: <RotateCcw className="h-4 w-4" aria-hidden="true" />,
                  onSelect: () => handlePutBackVacation(menuRequest),
                  tone: 'success' as const,
                },
                {
                  label: 'Delete request',
                  icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
                  onSelect: () => handleDeleteCancelled(menuRequest),
                  tone: 'danger' as const,
                },
              ]
            : []),
        ]
      : [];

    const optionClass = (tone: 'default' | 'success' | 'danger' | 'muted') => {
      const tones = {
        default: 'text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-300',
        success: 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-gray-200 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300',
        danger: 'text-gray-700 hover:bg-red-50 hover:text-red-700 dark:text-gray-200 dark:hover:bg-red-900/20 dark:hover:text-red-300',
        muted: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white',
      };

      return tones[tone];
    };

    const runAction = (action: () => void | Promise<void>) => {
      closeRequestActionMenu();
      action();
    };

    return (
      <AnimatePresence>
        {requestActionMenu && menuRequest && (
          <motion.div
            ref={requestMenuRef}
            role="menu"
            aria-label="Request options"
            className="fixed z-[70] w-[236px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl shadow-gray-900/15 dark:border-gray-700 dark:bg-gray-800 dark:shadow-black/30"
            style={{ left: requestActionMenu.x, top: requestActionMenu.y }}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            <div className="border-b border-gray-100 px-3 py-2.5 dark:border-gray-700">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {employeeNameForRequest(menuRequest)}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {fmtDateShort(menuRequest.startDate)} - {fmtDateShort(menuRequest.endDate)}
              </p>
            </div>
            <div className="p-1.5">
              {actions.length > 0 ? (
                actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(action.onSelect)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${optionClass(action.tone)}`}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                  No available actions
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

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
        <div className="modal-fixed-body px-6 py-3">
        <form id="vacation-create-form" onSubmit={handleCreateRequest} className="space-y-3">
          {/* ── Employee Information ── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3 bg-gray-50/50 dark:bg-gray-700/20">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">👤 Employee Information</h4>

            {/* Select existing requester */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select User from List</label>
              <select
                value={selectedRequesterId}
                onChange={(e) => {
                  const employeeId = e.target.value;
                  setSelectedRequesterId(employeeId);
                  if (!employeeId) return;
                  const selectedEmployee = requesterEmployees.find(emp => emp.id === Number(employeeId));
                  if (!selectedEmployee) return;
                  setFormData(prev => ({
                    ...prev,
                    firstName: selectedEmployee.firstname || '',
                    lastName: selectedEmployee.lastname || '',
                    employeeCode: selectedEmployee.employeeCode || '',
                  }));
                }}
                title="Select user from existing vacation requesters"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select user from list...</option>
                {requesterEmployees.map(emp => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.firstname} {emp.lastname}{emp.employeeCode ? ` • ${emp.employeeCode}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => {
                    if (selectedRequesterId) setSelectedRequesterId('');
                    setFormData({ ...formData, firstName: e.target.value });
                  }}
                  required
                  placeholder="John"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => {
                    if (selectedRequesterId) setSelectedRequesterId('');
                    setFormData({ ...formData, lastName: e.target.value });
                  }}
                  required
                  placeholder="Doe"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Department + Shift */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value, shift: '', line: '', area: '' })}
                  title="Department"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  className={`w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${!formData.department ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">{formData.department ? 'Select shift...' : 'Select department first'}</option>
                  {filteredShifts.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.startTime} – {s.endTime})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Area + Line */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Area</label>
                <select
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value, line: '' })}
                  title="Area"
                  disabled={!formData.shift}
                  className={`w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${!formData.shift ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  className={`w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${!formData.area ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">{formData.area ? 'Select line...' : 'Select area first'}</option>
                  {filteredLines.map(l => (
                    <option key={l.id} value={l.name}>{l.lineNumber ? `${l.lineNumber} – ${l.name}` : l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Phone + Employee ID */}
            <div className="grid grid-cols-2 gap-3">
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
                    if (selectedRequesterId) setSelectedRequesterId('');
                    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setFormData({ ...formData, employeeCode: val });
                  }}
                  placeholder="12345"
                  maxLength={5}
                  pattern="\d{5}"
                  title="5-digit employee ID"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* ── Leave Details ── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3 bg-gray-50/50 dark:bg-gray-700/20">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Leave Details</h4>

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Type *</label>
            <select
              value={formData.leaveType}
              onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
              title="Leave type"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {leaveTypeOptions.map(type => (
                <option key={type} value={type}>{leaveTypeBadge(type)}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
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
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              {typeof settings?.minimumNoticeDays === 'number' && settings.minimumNoticeDays > 0 && (
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
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              {typeof settings?.maxConsecutiveDays === 'number' && settings.maxConsecutiveDays > 0 && formData.startDate && (
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days</label>
              <input
                type="number"
                title="Duration in business days"
                value={formData.durationDays}
                readOnly
                placeholder="Auto"
                min="1"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
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
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
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
              rows={2}
              placeholder="Select a quick reason above or type your own..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>
          </div>

          {/* ── Coverage & Emergency ── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3 bg-gray-50/50 dark:bg-gray-700/20">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">📞 Coverage & Emergency</h4>

          {/* Coverage Plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Coverage Plan</label>
            <textarea
              value={formData.coveragePlan}
              onChange={(e) => setFormData({ ...formData, coveragePlan: e.target.value })}
              rows={2}
              placeholder="Who will cover your responsibilities?"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Emergency Contact */}
          <div className="grid grid-cols-2 gap-3">
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
                className={`w-full px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
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
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Filter buttons */}
      <div className="inline-flex shrink-0 flex-wrap gap-2">
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

      {/* Activity Table */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="h-full w-full overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50/95 text-left dark:border-gray-700 dark:bg-gray-900/40">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Activity</th>
                <th className="w-36 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300">Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {activityLog.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500">No activity found</td></tr>
              )}
              {activityLog.map((entry, i) => {
                const employeeName = employeeNameForRequest(entry);
                const actorLabel = entry.approved_by_username
                  ? 'Decided by'
                  : entry.requested_by_username
                    ? 'Requested by'
                    : null;
                const actorName = entry.approved_by_username || entry.requested_by_username;

                return (
                  <tr key={`${entry.id}-${entry.activity_timestamp}-${i}`} className="transition-colors hover:bg-gray-50/90 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white">{employeeName}</p>
                          <span className={statusBadge(entry.status)}>{entry.status}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatLabel(entry.activity_type)} · {leaveTypeBadge(entry.leaveType)} · {fmtDateShort(entry.startDate)} - {fmtDateShort(entry.endDate)} · {entry.durationDays}d
                        </p>
                        {actorLabel && actorName && (
                          <p className="text-xs text-gray-400">{actorLabel}: {actorName}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtDate(entry.activity_timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

  const EditModal = () => showEditModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Pending Vacation Request</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Type</label>
            <select
              value={editForm.leaveType}
              onChange={(e) => setEditForm(prev => ({ ...prev, leaveType: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {editLeaveTypeOptions.map(type => (
                <option key={type} value={type}>{leaveTypeBadge(type)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                value={editForm.endDate}
                min={editForm.startDate || undefined}
                onChange={(e) => setEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
            <textarea
              rows={3}
              value={editForm.reason}
              onChange={(e) => setEditForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Optional note..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={() => setShowEditModal(false)}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Close
          </button>
          <button
            onClick={handleSaveEdit}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Changes
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'employees', label: 'Employees' },
    { key: 'requests', label: 'Requests' },
    { key: 'activity', label: 'Activity Log' },
  ];

  return (
    <ProtectedRoute>
      <div className="h-full min-h-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    Vacation Hub
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
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <main className="p-3 md:p-4 flex-1 min-h-0 overflow-hidden">
          {activeTab === 'overview' && <OverviewPanel />}
          {activeTab === 'employees' && <EmployeesPanel />}
          {activeTab === 'requests' && <RequestsPanel />}
          {activeTab === 'activity' && <ActivityPanel />}
        </main>

        {/* Modals */}
        <ApproveModal />
        <DenyModal />
        <EditModal />
        <RequestActionMenu />
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
                <button onClick={() => { setShowConstraintsModal(false); setEditingSettings(false); setShowBlackoutForm(false); setNewLeaveType(''); }} title="Close" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
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
                                leaveTypes: normalizeLeaveTypeOptions(settings.leaveTypes),
                                vacationHoursPerDay: normalizeVacationHoursPerDay(settings.vacationHoursPerDay),
                              });
                              setNewLeaveType('');
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
                          <button onClick={() => { setEditingSettings(false); setNewLeaveType(''); }} className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
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
	                          { label: 'Hours Per Day', value: `${normalizeVacationHoursPerDay(settings.vacationHoursPerDay)} hours`, hint: 'The number of vacation hours counted for one vacation day' },
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
	                      <div>
	                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" title="The number of vacation hours counted for one vacation day">Hours Per Vacation Day</label>
	                        <input type="number" title="The number of vacation hours counted for one vacation day" min="1" value={settingsForm.vacationHoursPerDay ?? ''} onChange={e => setSettingsForm({...settingsForm, vacationHoursPerDay: e.target.value ? Number(e.target.value) : undefined})}
	                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
	                      </div>
	                      <div className="flex items-center gap-2 pt-5">
                        <input type="checkbox" title="When enabled, employees in essential roles must arrange coverage before taking time off" checked={settingsForm.criticalRoleCoverageRequired ?? false} onChange={e => setSettingsForm({...settingsForm, criticalRoleCoverageRequired: e.target.checked})}
                          className="rounded border-gray-300 text-blue-600" />
                        <label className="text-sm text-gray-700 dark:text-gray-300" title="When enabled, employees in essential roles must arrange coverage before taking time off">Critical Role Coverage</label>
	                      </div>
	                    </div>
	                  ) : null}

                    {!settingsError && settings ? (
                      <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800/40">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Leave Types</h4>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{(editingSettings ? editableLeaveTypes : leaveTypeOptions).length} active</span>
                        </div>

                        {!editingSettings ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {leaveTypeOptions.map(type => (
                              <span
                                key={type}
                                className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                              >
                                {leaveTypeBadge(type)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {editableLeaveTypes.map(type => (
                                <span
                                  key={type}
                                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                >
                                  {leaveTypeBadge(type)}
	                                  <button
	                                    type="button"
	                                    onClick={() => handleRemoveLeaveType(type)}
	                                    disabled={editableLeaveTypes.length <= 1}
	                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-900/30"
	                                    aria-label={`Remove ${leaveTypeBadge(type)}`}
	                                  >
	                                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
	                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                type="text"
                                value={newLeaveType}
                                onChange={(e) => setNewLeaveType(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddLeaveType();
                                  }
                                }}
                                placeholder="Add leave type"
                                className="min-w-0 flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={handleAddLeaveType}
                                disabled={!normalizeLeaveTypeName(newLeaveType)}
                                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
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
	                <button onClick={() => { setShowConstraintsModal(false); setEditingSettings(false); setShowBlackoutForm(false); setNewLeaveType(''); }} className="px-5 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors">
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
