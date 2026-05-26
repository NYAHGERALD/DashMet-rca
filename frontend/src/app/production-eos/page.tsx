'use client';

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import { DashDatePicker, DashTimeDisplay, DashTimeField } from '@/components/ui/DashDateTimeFields';
import api from '@/lib/api';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Calculator,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Factory,
  FileText,
  Filter,
  Gauge,
  History,
  Info,
  Loader2,
  Maximize2,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';

type SectionKey = 'PRODUCTION' | 'CHANGEOVER' | 'REWORK';
type PageTabKey = 'DASHBOARD' | 'PRODUCTION' | 'AUDIT_TRAIL' | 'SUBMIT_REPORT' | 'NOTES';
type NoticeType = 'success' | 'error' | 'info';
type ItemPickerAnchor = {
  rowKey: string;
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  arrowTop: number;
};
type ScheduleStartEditor = {
  rowKey: string;
  location: string;
  currentValue: string;
  draftValue: string;
  top: number;
  left: number;
  width: number;
  arrowTop: number;
};
type DashboardDateRange = {
  id: string;
  startDate: string;
  endDate: string;
};
type DashboardLegendItem = {
  label: string;
  color: string;
  kind?: 'bar' | 'line' | 'dashed';
};

interface ShiftOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface ReporterOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface KpiTarget {
  id?: string | null;
  metricKey: string;
  metricLabel: string;
  comparisonDirection: 'MINIMUM' | 'MAXIMUM' | string;
  valueUnit: 'PERCENT' | 'POUNDS' | string;
  targetValue: number | string;
  isActive: boolean;
}

interface EosLine {
  rowKey: string;
  section: SectionKey;
  sortOrder: number;
  location: string;
  productionLineId?: string | null;
  locationUnavailable?: boolean;
  locationHint?: string | null;
  lineGroup?: string | null;
  stationType?: string | null;
  pairedAssemblyRowKey?: string | null;
  itemNo?: string | null;
  itemDescriptionSnapshot?: string | null;
  casesScheduled?: string | number | null;
  casesProduced?: string | number | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  downMinutes?: string | number | null;
  downtimeComment?: string | null;
  wasteLbs?: string | number | null;
  actualHeadcount?: string | number | null;
  oeePct?: string | number | null;
  scheduledStartTime?: string | null;
  scheduledStartOverridden?: boolean;
  scheduledStartTimes?: Array<{ shiftId: string; scheduledStartTime: string }> | null;
  lbsScheduled?: number | null;
  lbsProduced?: number | null;
  attainmentPct?: number | null;
  totalMinutes?: number | null;
  lateStartMinutes?: number | null;
  wastePct?: number | null;
  standardHeadcount?: number | null;
  headcountPct?: number | null;
  validationWarnings?: string[];
}

interface ReportSummary {
  id: string;
  reportDate: string;
  dayOfWeek: string;
  shiftId?: string | null;
  shiftNameSnapshot: string;
  reportedByName: string;
  status: string;
  totals?: EosTotals;
  updatedAt: string;
  submittedAt?: string | null;
}

interface LoadedReport extends ReportSummary {
  lines: EosLine[];
  notes?: Array<{ lineGroup: string; notes?: string | null; sortOrder?: number }>;
  safetyConcerns?: string | null;
  qualityIssues?: string | null;
}

interface AuditTrailEntry {
  id: string;
  action: string;
  createdAt: string;
  changes?: any;
  user?: AuditTrailUser | null;
  User?: AuditTrailUser | null;
}

interface AuditTrailUser {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    role?: string | null;
    profilePicture?: string | null;
}

interface TemplateResponse {
  rows: EosLine[];
  lineOptions: Array<{ assembly: string; packOff: string; lineGroup: string }>;
  dayOptions: string[];
  shifts: ShiftOption[];
  kpiTargets?: KpiTarget[];
  reporter: {
    mode: 'select_by_role' | 'current_user';
    current: ReporterOption;
    options: ReporterOption[];
  };
}

interface ItemOption {
  id: string;
  itemNo: string;
  description?: string | null;
}

type DashboardMetrics = {
  reportsCount: number;
  submittedCount: number;
  draftCount: number;
  casesScheduled: number;
  casesProduced: number;
  lbsScheduled: number;
  lbsProduced: number;
  wasteLbs: number;
  attainmentPct: number | null;
  wastePct: number | null;
  oeePct?: number | null;
  oeeLineCount?: number;
  lateStartMinutes: number;
  totalMinutes: number;
  downMinutes: number;
  standardHeadcount: number;
  actualHeadcount: number;
  headcountPct: number | null;
  noteCount: number;
  safetyCount: number;
  qualityCount: number;
};

type DashboardTrendRow = DashboardMetrics & { date: string };
type DashboardShiftTrendRow = {
  date: string;
  firstShift: DashboardMetrics;
  secondShift: DashboardMetrics;
};
type DashboardSectionRow = DashboardMetrics & { section: string };
type DashboardLineRow = DashboardMetrics & {
  location: string;
  section: string;
  lineGroup?: string | null;
  stationType?: string | null;
  sortOrder?: number;
  firstShift?: DashboardMetrics;
  secondShift?: DashboardMetrics;
};
type DashboardLineTrendRow = {
  date: string;
  location: string;
  section: string;
  lineGroup?: string | null;
  sortOrder?: number;
  firstShift: DashboardMetrics;
  secondShift: DashboardMetrics;
};
type DashboardShiftRow = DashboardMetrics & { shiftId?: string | null; shiftName: string };
type DashboardItemRow = DashboardMetrics & { itemNo: string; description: string };

interface ProductionEosDashboard {
  range: {
    startDate: string;
    endDate: string;
    lineDate?: string;
    days: number;
    shiftId?: string | null;
    selectedDates?: string[];
  };
  summary: DashboardMetrics;
  trend: DashboardTrendRow[];
  trendByShift?: DashboardShiftTrendRow[];
  sectionMix: DashboardSectionRow[];
  linePerformance: DashboardLineRow[];
  lineTrendByShift?: DashboardLineTrendRow[];
  shiftPerformance: DashboardShiftRow[];
  itemPerformance: DashboardItemRow[];
  wasteDrivers: DashboardLineRow[];
  lateStartDrivers: DashboardLineRow[];
  attainmentWatchlist: DashboardLineRow[];
  recentReports: Array<{
    id: string;
    reportDate: string;
    dayOfWeek: string;
    shiftName: string;
    reportedByName: string;
    status: string;
    updatedAt: string;
    submittedAt?: string | null;
  }>;
}

type EosTotals = Record<string, any>;
type TotalsBySection = Record<SectionKey, EosTotals>;

const SECTION_OPTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: 'PRODUCTION', label: 'Production' },
  { key: 'CHANGEOVER', label: 'Changeovers' },
  { key: 'REWORK', label: 'Rework' },
];

function sectionLabel(section?: string | null) {
  return SECTION_OPTIONS.find((option) => option.key === section)?.label || (section ? String(section) : '');
}

const SECTION_NOTES: Record<SectionKey, { title: string; body: string; accuracy: string }> = {
  PRODUCTION: {
    title: 'Production data view',
    body: 'This tab captures the planned and actual production for the selected shift. Enter the yellow-cell values such as item number, scheduled cases, produced cases, actual times, waste, OEE, and headcount; DashMet calculates pounds, attainment, late start, waste percent, and staffing results from backend formulas.',
    accuracy: 'Accurate production data keeps the shift totals, yield, labor, and follow-up decisions trustworthy.',
  },
  CHANGEOVER: {
    title: 'Changeover data view',
    body: 'This tab uses the same EOS table for changeover activity only. Enter the changeover-specific item, cases, timing, waste, OEE, and headcount values so the backend can calculate the impact separately from normal production.',
    accuracy: 'Clean changeover data helps leaders see transition losses clearly and improve future line readiness.',
  },
  REWORK: {
    title: 'Rework data view',
    body: 'This tab tracks rework output with the same table layout. Enter only the rework activity for the selected shift; calculated cells update from the backend using the same controlled formula flow as the other sections.',
    accuracy: 'Reliable rework data protects inventory accuracy, waste reporting, and quality follow-up.',
  },
};

const NOTE_LINES = ['Line 1', 'Line 2', 'Line 3', 'Line 5'];
const PAIRED_SHARED_INPUT_FIELDS = new Set<keyof EosLine>(['itemNo', 'casesScheduled', 'casesProduced']);
const AUDIT_COLLAPSE_ROW_THRESHOLD = 1;
const DASHBOARD_WEEK_TARGET_DAYS = 5;
const PRODUCTION_TREND_LBS_DOMAIN = [0, 350000];
const PRODUCTION_TREND_LBS_TICKS = [0, 50000, 100000, 150000, 200000, 250000, 300000, 350000];
const DASHBOARD_LINE_COLORS = ['#2563eb', '#f97316', '#059669', '#7c3aed'];
const EOS_TABLE_MIN_WIDTH = '1850px';
const EOS_TABLE_COLUMNS = [
  { key: 'location', width: '140px' },
  { key: 'itemNo', width: '105px' },
  { key: 'description', width: '230px' },
  { key: 'casesScheduled', width: '80px' },
  { key: 'casesProduced', width: '80px' },
  { key: 'lbsScheduled', width: '85px' },
  { key: 'lbsProduced', width: '85px' },
  { key: 'attainment', width: '85px' },
  { key: 'scheduledStart', width: '100px' },
  { key: 'start', width: '105px' },
  { key: 'end', width: '105px' },
  { key: 'totalMinutes', width: '85px' },
  { key: 'lateStart', width: '85px' },
  { key: 'wasteLbs', width: '85px' },
  { key: 'wastePct', width: '85px' },
  { key: 'oeePct', width: '80px' },
  { key: 'standardHeadcount', width: '75px' },
  { key: 'actualHeadcount', width: '80px' },
  { key: 'headcountPct', width: '75px' },
] as const;
const EOS_TABLE_GRID_TEMPLATE = EOS_TABLE_COLUMNS.map((column) => column.width).join(' ');

function resizeNoteTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

function todayInputValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateFromInputValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function inputValueFromDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function currentWeekDashboardRange(anchorDate: string) {
  const anchor = dateFromInputValue(anchorDate || todayInputValue());
  const mondayOffset = (anchor.getDay() + 6) % 7;
  const start = addDays(anchor, -mondayOffset);
  const end = addDays(start, 6);
  return {
    startDate: inputValueFromDate(start),
    endDate: inputValueFromDate(end),
    days: 7,
  };
}

function dateDiffInDays(startDate: string, endDate: string) {
  const start = dateFromInputValue(startDate);
  const end = dateFromInputValue(endDate);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function dateRangeKeys(startDate: string, endDate: string) {
  const span = dateDiffInDays(startDate, endDate);
  return Array.from({ length: span + 1 }, (_, index) => inputValueFromDate(addDays(dateFromInputValue(startDate), index)));
}

function dashboardSelectedDatesFromRanges(ranges: DashboardDateRange[]) {
  return Array.from(new Set(
    ranges.flatMap((range) => {
      const startDate = range.startDate <= range.endDate ? range.startDate : range.endDate;
      const endDate = range.startDate <= range.endDate ? range.endDate : range.startDate;
      return dateRangeKeys(startDate, endDate);
    }),
  )).sort();
}

function normalizeDashboardDateRanges(ranges: DashboardDateRange[]) {
  const selectedDates = dashboardSelectedDatesFromRanges(ranges);
  const normalized: DashboardDateRange[] = [];
  selectedDates.forEach((date) => {
    const lastRange = normalized[normalized.length - 1];
    if (lastRange && dateDiffInDays(lastRange.endDate, date) === 1) {
      lastRange.endDate = date;
      return;
    }
    normalized.push({ id: `range-${date}`, startDate: date, endDate: date });
  });
  return normalized;
}

function dashboardFetchRangeFromDates(anchorDate: string, selectedDates: string[]) {
  if (selectedDates.length) {
    return {
      startDate: selectedDates[0],
      endDate: selectedDates[selectedDates.length - 1],
      days: selectedDates.length,
      dates: selectedDates.join(','),
    };
  }
  return {
    ...currentWeekDashboardRange(anchorDate),
    dates: '',
  };
}

function monthStartDate(value: string) {
  const date = dateFromInputValue(value || todayInputValue());
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function calendarMonthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function dashboardRangeLabel(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDashboardDate(startDate);
  return `${formatDashboardDate(startDate)} - ${formatDashboardDate(endDate)}`;
}

function dashboardFilterScopeLabel(selectedDates: string[]) {
  if (!selectedDates.length) return 'Current week';
  return `${selectedDates.length} selected ${selectedDates.length === 1 ? 'day' : 'days'}`;
}

function dashboardFullChartWidth(rowCount: number, minWidth = 1280) {
  return Math.max(minWidth, rowCount * 36);
}

function dayFromDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}

function dateInputFromValue(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function shiftSequenceNumber(shift: ShiftOption) {
  const name = shift.name.toLowerCase();
  if (/\b(first|1st)\b/.test(name)) return 1;
  if (/\b(second|2nd)\b/.test(name)) return 2;
  if (/\b(third|3rd)\b/.test(name)) return 3;
  const numericMatch = name.match(/\bshift\s*(\d+)\b/) || name.match(/\b(\d+)\s*shift\b/);
  return numericMatch ? Number(numericMatch[1]) : null;
}

function minutesFromTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

function compareShiftOptions(a: ShiftOption, b: ShiftOption) {
  const aNumber = shiftSequenceNumber(a);
  const bNumber = shiftSequenceNumber(b);
  if (aNumber !== null || bNumber !== null) {
    if (aNumber === null) return 1;
    if (bNumber === null) return -1;
    if (aNumber !== bNumber) return aNumber - bNumber;
  }

  const startDiff = minutesFromTime(a.startTime) - minutesFromTime(b.startTime);
  if (startDiff !== 0) return startDiff;
  return a.name.localeCompare(b.name);
}

function sortedShiftOptions(shifts: ShiftOption[] = []) {
  return [...shifts].sort(compareShiftOptions);
}

function actualTimePlaceholdersForShift(shift: ShiftOption | null) {
  const shiftNumber = shift ? shiftSequenceNumber(shift) : null;
  if (shiftNumber === 2) {
    return { start: '16:00', end: '00:00' };
  }
  if (shiftNumber === 1) {
    return { start: '07:00', end: '15:00' };
  }
  return {
    start: shift?.startTime || '07:00',
    end: shift?.endTime || '15:00',
  };
}

function formatNumber(value: unknown, digits = 1) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function formatFixedNumber(value: unknown, digits = 2) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatWastePctPoint(value: unknown) {
  const formatted = formatFixedNumber(value, 2);
  return formatted ? `${formatted}%` : '';
}

function formatPct(value: unknown, digits = 1) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return `${(number * 100).toFixed(digits)}%`;
}

function formatPctInputValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' && value.trim().endsWith('.')) return value.replace(/%/g, '');
  const number = Number(String(value).replace(/%/g, ''));
  if (!Number.isFinite(number)) return '';
  const percent = Math.abs(number) <= 1 ? number * 100 : number;
  return Number.isInteger(percent) ? String(percent) : String(Number(percent.toFixed(2)));
}

function editableBlankDefaultValue(value: unknown): string | number {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(String(value).replace(/,/g, ''));
  if (Number.isFinite(number) && number === 0) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  return String(value);
}

function formatCompactNumber(value: unknown, digits = 1) {
  if (value === null || value === undefined || value === '') return '--';
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(digits)}M`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(digits)}K`;
  return number.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function finiteMetricValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stretchTargetValue(target: number | null | undefined) {
  const targetNumber = finiteMetricValue(target);
  return targetNumber !== null && targetNumber > 0 ? targetNumber * 1.25 : null;
}

function formatDashboardDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function pctValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number * 100 : null;
}

function metricDelta(current: number | null | undefined, previous: number | null | undefined) {
  const currentNumber = Number(current);
  const previousNumber = Number(previous);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber) || previousNumber === 0) return null;
  return (currentNumber - previousNumber) / Math.abs(previousNumber);
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function auditEntryUser(entry: AuditTrailEntry) {
  return entry.user || entry.User || null;
}

function auditActorName(entry: AuditTrailEntry) {
  const directActor = entry.changes?.actor?.name;
  if (directActor) return directActor;
  const entryUser = auditEntryUser(entry);
  const fromUser = `${entryUser?.firstName || ''} ${entryUser?.lastName || ''}`.trim();
  return fromUser || entryUser?.email || 'Unknown user';
}

function auditActorInitials(entry: AuditTrailEntry) {
  const name = auditActorName(entry);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || 'U').toUpperCase();
}

function auditActorProfilePicture(entry: AuditTrailEntry) {
  return auditEntryUser(entry)?.profilePicture || entry.changes?.actor?.profilePicture || '';
}

const REPORT_AUDIT_DISPLAY_FIELDS = new Set([
  'reportDate',
  'shiftNameSnapshot',
  'reportedByName',
  'status',
  'safetyConcerns',
  'qualityIssues',
]);

const LINE_AUDIT_DISPLAY_FIELDS = new Set([
  'itemNo',
  'casesScheduled',
  'casesProduced',
  'scheduledStartTime',
  'actualStartTime',
  'actualEndTime',
  'oeePct',
  'downtimeComment',
  'wasteLbs',
  'actualHeadcount',
]);

const NOTE_AUDIT_DISPLAY_FIELDS = new Set(['notes']);
const SAVE_ONLY_AUDIT_EVENTS = new Set(['DRAFT_CREATED', 'REPORT_CREATED_AND_SUBMITTED']);
const NUMERIC_AUDIT_DISPLAY_FIELDS = new Set([
  'casesScheduled',
  'casesProduced',
  'downMinutes',
  'oeePct',
  'wasteLbs',
  'actualHeadcount',
]);
const TIME_AUDIT_DISPLAY_FIELDS = new Set(['scheduledStartTime', 'actualStartTime', 'actualEndTime']);
const PCT_AUDIT_DISPLAY_FIELDS = new Set(['oeePct']);

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Blank';
  if (Array.isArray(value)) return value.length ? value.map(formatAuditValue).join(', ') : 'None';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatAuditTimeValue(value: unknown) {
  const text = formatAuditValue(value);
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return text;
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(1970, 0, 1, hour, minute));
}

function formatAuditDisplayValue(field: string, value: unknown) {
  if (TIME_AUDIT_DISPLAY_FIELDS.has(field)) return formatAuditTimeValue(value);
  if (PCT_AUDIT_DISPLAY_FIELDS.has(field)) return formatPct(value) || formatAuditValue(value);
  return formatAuditValue(value);
}

function auditComparableValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  if (field === 'reportDate') return dateInputFromValue(value as string | Date);
  if (NUMERIC_AUDIT_DISPLAY_FIELDS.has(field)) {
    const parsed = Number(String(value).replace(/,/g, ''));
    if (Number.isFinite(parsed)) return String(parsed);
  }
  return formatAuditValue(value).trim();
}

function isVisibleAuditChange(change: any, allowedFields: Set<string>) {
  if (!change || !allowedFields.has(String(change.field))) return false;
  return auditComparableValue(String(change.field), change.previousValue) !== auditComparableValue(String(change.field), change.currentValue);
}

function visibleAuditFieldChanges(changes: any[] = [], allowedFields: Set<string>) {
  return changes.filter((change) => isVisibleAuditChange(change, allowedFields));
}

function visibleAuditRowChanges(rows: any[] = [], allowedFields: Set<string>) {
  return rows
    .map((row) => ({
      ...row,
      fields: visibleAuditFieldChanges(row.fields || [], allowedFields),
    }))
    .filter((row) => row.fields.length > 0);
}

function auditChangeRows(reportChanges: any[], lineChanges: any[], noteChanges: any[]) {
  return [
    ...reportChanges.map((change: any) => ({
      key: `report-${change.field}`,
      sectionLabel: '',
      area: 'Report',
      fieldKey: change.field,
      field: change.label,
      previousValue: change.previousValue,
      currentValue: change.currentValue,
    })),
    ...lineChanges.flatMap((row: any) => row.fields.map((change: any) => ({
      key: `line-${row.key}-${change.field}`,
      sectionLabel: sectionLabel(row.section),
      area: row.location || row.key,
      fieldKey: change.field,
      field: change.label,
      previousValue: change.previousValue,
      currentValue: change.currentValue,
    }))),
    ...noteChanges.flatMap((row: any) => row.fields.map((change: any) => ({
      key: `note-${row.key}-${change.field}`,
      sectionLabel: 'Notes',
      area: row.location || row.key,
      fieldKey: change.field,
      field: change.label,
      previousValue: change.previousValue,
      currentValue: change.currentValue,
    }))),
  ];
}

function auditNoDetailText(entry: AuditTrailEntry) {
  const actor = auditActorName(entry);
  const timestamp = formatDateTime(entry.createdAt);
  const eventType = entry.changes?.eventType;
  if (eventType === 'REPORT_CREATED_AND_SUBMITTED' || eventType === 'REPORT_SUBMITTED') {
    return `Report was submitted by ${actor} at ${timestamp}.`;
  }
  if (eventType === 'DRAFT_CREATED') {
    return `Report was saved by ${actor} at ${timestamp}.`;
  }
  return `No user-entered report values changed. Event recorded by ${actor} at ${timestamp}.`;
}

function normalizeItemNoInput(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\D/g, '');
}

function metricTone(value: unknown, higherIsBetter = true, targetValue?: number | null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'text-gray-500 dark:text-gray-400';
  const target = Number.isFinite(Number(targetValue)) ? Number(targetValue) : null;
  if (higherIsBetter) {
    const greenTarget = target ?? 1;
    if (number >= greenTarget) return 'text-emerald-700 dark:text-emerald-300';
    if (number >= greenTarget * 0.85) return 'text-amber-700 dark:text-amber-300';
    return 'text-red-700 dark:text-red-300';
  }
  const greenTarget = target ?? 0.03;
  if (number <= greenTarget) return 'text-emerald-700 dark:text-emerald-300';
  if (number <= greenTarget * 1.67) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

function emptyTotalsBySection(): TotalsBySection {
  return { PRODUCTION: {}, CHANGEOVER: {}, REWORK: {} };
}

function overallTotalsFrom(value: any): EosTotals {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const { bySection, ...overall } = value;
  return overall;
}

function totalsBySectionFrom(value: any): TotalsBySection {
  const bySection = value?.bySection || value;
  return {
    PRODUCTION: bySection?.PRODUCTION || {},
    CHANGEOVER: bySection?.CHANGEOVER || {},
    REWORK: bySection?.REWORK || {},
  };
}

function hasTotals(value: EosTotals) {
  return Boolean(value && Object.keys(value).length);
}

function totalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return 0;
  const number = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function combinedTotalsFromSections(bySection: TotalsBySection): EosTotals {
  const sections = SECTION_OPTIONS.map((section) => bySection[section.key] || {});
  const sumField = (field: string) => sections.reduce((total, section) => total + totalNumber(section[field]), 0);
  const casesScheduled = sumField('casesScheduled');
  const casesProduced = sumField('casesProduced');
  const lbsProduced = sumField('lbsProduced');
  const wasteLbs = sumField('wasteLbs');
  const standardHeadcount = sumField('standardHeadcount');
  const actualHeadcount = sumField('actualHeadcount');
  const oeeWeighted = sections.reduce((total, section) => total + (totalNumber(section.oeePct) * totalNumber(section.oeeLineCount)), 0);
  const oeeLineCount = sections.reduce((total, section) => total + totalNumber(section.oeeLineCount), 0);

  return {
    casesScheduled,
    casesProduced,
    lbsScheduled: sumField('lbsScheduled'),
    lbsProduced,
    attainmentPct: casesScheduled > 0 ? casesProduced / casesScheduled : null,
    oeePct: oeeLineCount > 0 ? oeeWeighted / oeeLineCount : null,
    oeeLineCount,
    totalMinutes: sumField('totalMinutes'),
    lateStartMinutes: sumField('lateStartMinutes'),
    wasteLbs,
    wastePct: lbsProduced > 0 ? wasteLbs / lbsProduced : null,
    standardHeadcount,
    actualHeadcount,
    headcountPct: standardHeadcount > 0 ? actualHeadcount / standardHeadcount : null,
  };
}

function defaultScheduledStartForShift(line: EosLine, selectedShiftId: string) {
  const shiftStarts = line.scheduledStartTimes || [];
  if (shiftStarts.length && selectedShiftId) {
    return shiftStarts.find((row) => row.shiftId === selectedShiftId)?.scheduledStartTime || null;
  }
  if (shiftStarts.length) return null;
  return null;
}

function scheduledStartForShift(line: EosLine, selectedShiftId: string) {
  const defaultScheduledStartTime = defaultScheduledStartForShift(line, selectedShiftId);
  if (line.scheduledStartOverridden) return line.scheduledStartTime || null;
  if (defaultScheduledStartTime) return defaultScheduledStartTime;
  return null;
}

function withSelectedShiftScheduledStart(line: EosLine, selectedShiftId: string): EosLine {
  return {
    ...line,
    scheduledStartTime: scheduledStartForShift(line, selectedShiftId),
  };
}

function lineWithTemplateSchedule(line: EosLine, selectedShiftId: string, templateRows: EosLine[] = []): EosLine {
  const templateLine = templateRows.find((candidate) => candidate.rowKey === line.rowKey);
  const mergedLine = templateLine
    ? {
      ...templateLine,
      ...line,
      productionLineId: line.productionLineId || templateLine.productionLineId,
      scheduledStartTimes: line.scheduledStartTimes?.length ? line.scheduledStartTimes : templateLine.scheduledStartTimes,
    }
    : line;

  return withSelectedShiftScheduledStart(mergedLine, selectedShiftId);
}

function linesWithTemplateSchedule(lines: EosLine[] = [], selectedShiftId: string, templateRows: EosLine[] = []) {
  return lines.map((line) => lineWithTemplateSchedule(line, selectedShiftId, templateRows));
}

function emptyReportLine(line: EosLine, selectedShiftId: string): EosLine {
  return {
    ...line,
    itemNo: null,
    itemDescriptionSnapshot: null,
    casesScheduled: null,
    casesProduced: null,
    actualStartTime: null,
    actualEndTime: null,
    downMinutes: null,
    downtimeComment: null,
    wasteLbs: null,
    actualHeadcount: null,
    oeePct: null,
    scheduledStartTime: scheduledStartForShift(line, selectedShiftId),
    lbsScheduled: null,
    lbsProduced: null,
    attainmentPct: null,
    totalMinutes: null,
    lateStartMinutes: null,
    wastePct: null,
    standardHeadcount: null,
    headcountPct: null,
    validationWarnings: [],
  };
}

function hasUserEnteredLineValue(value: unknown, zeroIsBlank = false) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (zeroIsBlank) {
      const number = Number(trimmed.replace(/,/g, '').replace(/%/g, ''));
      if (Number.isFinite(number) && number === 0) return false;
    }
    return true;
  }
  if (zeroIsBlank && typeof value === 'number' && value === 0) return false;
  return true;
}

function lineHasUserEnteredData(line: EosLine) {
  return Boolean(
    hasUserEnteredLineValue(line.itemNo)
    || hasUserEnteredLineValue(line.casesScheduled, true)
    || hasUserEnteredLineValue(line.casesProduced, true)
    || hasUserEnteredLineValue(line.actualStartTime)
    || hasUserEnteredLineValue(line.actualEndTime)
    || hasUserEnteredLineValue(line.wasteLbs, true)
    || hasUserEnteredLineValue(line.actualHeadcount, true)
    || hasUserEnteredLineValue(line.oeePct, true)
    || hasUserEnteredLineValue(line.downtimeComment)
    || (line.scheduledStartOverridden && hasUserEnteredLineValue(line.scheduledStartTime)),
  );
}

function reportHasSectionRecords(report: LoadedReport | null, section: SectionKey) {
  return Boolean(report?.lines?.some((line) => line.section === section && lineHasUserEnteredData(line)));
}

function reportMatchesSelection(report: LoadedReport | null, reportDate: string, shiftId: string) {
  if (!report || !reportDate || !shiftId) return false;
  return dateInputFromValue(report.reportDate) === reportDate && report.shiftId === shiftId;
}

function emptyLineNotes() {
  return NOTE_LINES.reduce((acc, lineGroup) => {
    acc[lineGroup] = '';
    return acc;
  }, {} as Record<string, string>);
}

function lineNotesFromReport(report?: LoadedReport | null) {
  return (report?.notes || []).reduce((acc, note) => {
    acc[note.lineGroup] = note.notes || '';
    return acc;
  }, emptyLineNotes());
}

function productionEosNotesKey(payload: {
  reportDate: string;
  dayOfWeek: string;
  shiftId: string | null;
  safetyConcerns: string;
  qualityIssues: string;
  notes: Array<{ lineGroup: string; notes: string; sortOrder: number }>;
}) {
  return JSON.stringify({
    reportDate: payload.reportDate,
    dayOfWeek: payload.dayOfWeek,
    shiftId: payload.shiftId,
    safetyConcerns: payload.safetyConcerns,
    qualityIssues: payload.qualityIssues,
    notes: payload.notes,
  });
}

function hasNotesContent(payload: ReturnType<typeof productionEosNotesPayloadShape>) {
  return Boolean(
    payload.safetyConcerns.trim()
    || payload.qualityIssues.trim()
    || payload.notes.some((note) => note.notes.trim()),
  );
}

function productionEosNotesPayloadShape(args: {
  reportDate: string;
  dayOfWeek: string;
  shiftId: string;
  currentShiftName?: string | null;
  user: any;
  safetyConcerns: string;
  qualityIssues: string;
  lineNotes: Record<string, string>;
}) {
  return {
    reportDate: args.reportDate,
    dayOfWeek: args.dayOfWeek,
    shiftId: args.shiftId || null,
    shiftName: args.currentShiftName || null,
    reportedByUserId: args.user?.id || null,
    reportedByName: args.user ? `${args.user.firstName} ${args.user.lastName}`.trim() || args.user.email : '',
    safetyConcerns: args.safetyConcerns,
    qualityIssues: args.qualityIssues,
    notes: NOTE_LINES.map((lineGroup, index) => ({
      lineGroup,
      notes: args.lineNotes[lineGroup] || '',
      sortOrder: index,
    })),
  };
}

export default function ProductionEosPage() {
  const { user } = useAuth();
  const [template, setTemplate] = useState<TemplateResponse | null>(null);
  const [lines, setLines] = useState<EosLine[]>([]);
  const [activePageTab, setActivePageTab] = useState<PageTabKey>('DASHBOARD');
  const [activeSection, setActiveSection] = useState<SectionKey>('PRODUCTION');
  const [reportDate, setReportDate] = useState(todayInputValue());
  const [dayOfWeek, setDayOfWeek] = useState(dayFromDate(todayInputValue()));
  const [shiftId, setShiftId] = useState('');
  const [safetyConcerns, setSafetyConcerns] = useState('');
  const [qualityIssues, setQualityIssues] = useState('');
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({ 'Line 1': '', 'Line 2': '', 'Line 3': '', 'Line 5': '' });
  const [totals, setTotals] = useState<EosTotals>({});
  const [totalsBySection, setTotalsBySection] = useState<TotalsBySection>(() => emptyTotalsBySection());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([]);
  const [inputVersion, setInputVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notesSaveStatus, setNotesSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dashboard, setDashboard] = useState<ProductionEosDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [fabAvailabilityLoading, setFabAvailabilityLoading] = useState(false);
  const [fabReport, setFabReport] = useState<LoadedReport | null>(null);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [selectedReport, setSelectedReport] = useState<LoadedReport | null>(null);
  const [editingReportId, setEditingReportId] = useState('');
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>([]);
  const [expandedAuditEntryIds, setExpandedAuditEntryIds] = useState<Set<string>>(new Set());
  const [auditLoading, setAuditLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);
  const [activeItemRowKey, setActiveItemRowKey] = useState<string | null>(null);
  const [itemPickerAnchor, setItemPickerAnchor] = useState<ItemPickerAnchor | null>(null);
  const [scheduledStartEditor, setScheduledStartEditor] = useState<ScheduleStartEditor | null>(null);
  const [shiftMenuOpen, setShiftMenuOpen] = useState(false);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [dashboardDateRanges, setDashboardDateRanges] = useState<DashboardDateRange[]>([]);
  const [dashboardDraftRanges, setDashboardDraftRanges] = useState<DashboardDateRange[]>([]);
  const [dashboardPendingRangeId, setDashboardPendingRangeId] = useState<string | null>(null);
  const [dashboardCalendarMonth, setDashboardCalendarMonth] = useState<Date>(() => monthStartDate(todayInputValue()));
  const [dashboardFilterOpenFor, setDashboardFilterOpenFor] = useState<string | null>(null);
  const [dashboardFullViewChartId, setDashboardFullViewChartId] = useState<string | null>(null);
  const calculationTimer = useRef<NodeJS.Timeout | null>(null);
  const notesAutosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNotesAutosaveKey = useRef('');
  const notesDirty = useRef(false);
  const activeItemInputRef = useRef<HTMLInputElement | null>(null);
  const scheduledStartTriggerRef = useRef<HTMLElement | null>(null);
  const scheduledStartPopoverRef = useRef<HTMLDivElement | null>(null);
  const shiftMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionMenuRef = useRef<HTMLDivElement | null>(null);
  const dashboardFilterRef = useRef<HTMLDivElement | null>(null);
  const noteTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const reportSelectionRef = useRef({ reportDate: '', shiftId: '' });

  useEffect(() => {
    const showDashboard = () => {
      setActivePageTab('DASHBOARD');
      setFabOpen(false);
      setSectionMenuOpen(false);
    };
    window.addEventListener('production-eos:show-dashboard', showDashboard);
    return () => window.removeEventListener('production-eos:show-dashboard', showDashboard);
  }, []);

  const orderedShifts = useMemo(() => sortedShiftOptions(template?.shifts || []), [template?.shifts]);
  const currentShift = useMemo(
    () => orderedShifts.find((shift) => shift.id === shiftId) || null,
    [orderedShifts, shiftId],
  );
  const kpiTargetByMetric = useMemo(
    () => new Map((template?.kpiTargets || []).map((target) => [target.metricKey, target])),
    [template?.kpiTargets],
  );
  const kpiTargetValue = useCallback((metricKey: string) => {
    const target = kpiTargetByMetric.get(metricKey);
    if (!target || target.isActive === false) return null;
    const value = Number(target.targetValue);
    return Number.isFinite(value) ? value : null;
  }, [kpiTargetByMetric]);
  const dashboardSelectedDates = useMemo(
    () => dashboardSelectedDatesFromRanges(dashboardDateRanges),
    [dashboardDateRanges],
  );
  const dashboardRange = useMemo(
    () => dashboardFetchRangeFromDates(reportDate, dashboardSelectedDates),
    [dashboardSelectedDates, reportDate],
  );
  const dashboardScopeLabel = dashboardFilterScopeLabel(dashboardSelectedDates);
  const dashboardScopeDescription = dashboardSelectedDates.length ? 'Selected dates' : 'Current week';
  const actualTimePlaceholders = useMemo(
    () => actualTimePlaceholdersForShift(currentShift),
    [currentShift],
  );

  const setNoteTextareaRef = useCallback((key: string) => (element: HTMLTextAreaElement | null) => {
    noteTextareaRefs.current[key] = element;
    if (element) {
      window.requestAnimationFrame(() => resizeNoteTextarea(element));
    }
  }, []);

  const isSubmitMode = activePageTab === 'SUBMIT_REPORT';
  const isEditingReport = Boolean(editingReportId);
  const showSectionSelector = activePageTab === 'PRODUCTION' || activePageTab === 'SUBMIT_REPORT';
  const selectedReportMatchesHeader = reportMatchesSelection(selectedReport, reportDate, shiftId);
  const visibleReport = selectedReportMatchesHeader ? selectedReport : null;
  const productionReporterName = activePageTab === 'PRODUCTION' ? visibleReport?.reportedByName?.trim() : '';
  const fabReportMatchesHeader = reportMatchesSelection(fabReport, reportDate, shiftId);
  const actionReport = fabReportMatchesHeader ? fabReport : visibleReport;
  const actionSectionHasRecords = reportHasSectionRecords(actionReport, activeSection);
  const hasActionSelection = Boolean(reportDate && shiftId);
  const canSubmitSelectedSection = hasActionSelection && !fabAvailabilityLoading && !actionSectionHasRecords;
  const canEditSelectedSection = hasActionSelection && !fabAvailabilityLoading && actionSectionHasRecords && Boolean(actionReport?.id);
  const reportTotals = useMemo(() => overallTotalsFrom(visibleReport?.totals), [visibleReport?.totals]);
  const reportTotalsBySection = useMemo(() => totalsBySectionFrom(visibleReport?.totals), [visibleReport?.totals]);
  const combinedReportSectionTotals = useMemo(() => combinedTotalsFromSections(reportTotalsBySection), [reportTotalsBySection]);
  const combinedEntrySectionTotals = useMemo(() => combinedTotalsFromSections(totalsBySection), [totalsBySection]);
  const entryLines = useMemo(
    () => lines.map((line) => withSelectedShiftScheduledStart(line, shiftId)),
    [lines, shiftId],
  );
  const blankTemplateLines = useMemo(
    () => lines
      .map((line) => emptyReportLine(line, shiftId)),
    [lines, shiftId],
  );
  const tableLines = isSubmitMode
    ? entryLines
    : visibleReport?.lines?.length
      ? visibleReport.lines
      : blankTemplateLines;
  const tableSection = showSectionSelector ? activeSection : 'PRODUCTION';

  const visibleLines = useMemo(
    () => tableLines.filter((line) => line.section === tableSection).sort((a, b) => a.sortOrder - b.sortOrder),
    [tableLines, tableSection],
  );

  const activeTotals = useMemo(() => {
    const sourceTotals = isSubmitMode ? totals : reportTotals;
    if (hasTotals(sourceTotals)) return sourceTotals;
    return isSubmitMode ? combinedEntrySectionTotals : combinedReportSectionTotals;
  }, [combinedEntrySectionTotals, combinedReportSectionTotals, isSubmitMode, reportTotals, totals]);
  const activeSectionNote = SECTION_NOTES[tableSection];
  const dashboardTrend = dashboard?.trend || [];
  const lbsProducedTarget = kpiTargetValue('LBS_PRODUCED');
  const attainmentTargetPct = pctValue(kpiTargetValue('ATTAINMENT_PCT'));
  const wasteTargetPct = pctValue(kpiTargetValue('WASTE_PCT'));
  const wasteTargetRatio = kpiTargetValue('WASTE_PCT');
  const weeklyLbsProducedTarget = lbsProducedTarget !== null ? lbsProducedTarget * DASHBOARD_WEEK_TARGET_DAYS : null;
  const dailyWasteLbsTarget = lbsProducedTarget !== null && wasteTargetRatio !== null ? lbsProducedTarget * wasteTargetRatio : null;
  const dashboardRecordDaysCount = dashboardTrend.filter((row) => (
    Number(row.reportsCount || 0) > 0 ||
    Number(row.lbsProduced || 0) > 0 ||
    Number(row.casesProduced || 0) > 0
  )).length;
  const dashboardRecordDaysLabel = `${dashboardRecordDaysCount} ${dashboardRecordDaysCount === 1 ? 'day' : 'days'} record vs Target`;
  const dashboardProducedRecordDaysLabel = `${dashboardRecordDaysCount} ${dashboardRecordDaysCount === 1 ? 'day' : 'days'} record vs 5-day Target`;
  const attainmentGaugeTarget = attainmentTargetPct ?? 100;
  const producedGaugeTarget = weeklyLbsProducedTarget;
  const wasteGaugeTarget = wasteTargetPct ?? 3;
  const oeeGaugeTarget = 100;
  const laborGaugeTarget = 100;
  const dashboardGaugeMetrics = [
    {
      label: 'Weekly Attainment',
      value: pctValue(dashboard?.summary.attainmentPct),
      target: attainmentGaugeTarget,
      stretch: stretchTargetValue(attainmentGaugeTarget),
      valueLabel: formatPct(dashboard?.summary.attainmentPct, 1) || '--',
      detail: `${dashboardRecordDaysLabel} ${formatNumber(attainmentGaugeTarget, 1)}%`,
      targetLabel: `${formatNumber(attainmentGaugeTarget, 1)}%`,
      stretchLabel: `${formatNumber(stretchTargetValue(attainmentGaugeTarget), 1)}%`,
    },
    {
      label: 'Produced Pounds',
      value: finiteMetricValue(dashboard?.summary.lbsProduced),
      target: producedGaugeTarget,
      stretch: stretchTargetValue(producedGaugeTarget),
      valueLabel: `${formatCompactNumber(dashboard?.summary.lbsProduced, 1)} lbs`,
      detail: producedGaugeTarget !== null
        ? `${dashboardProducedRecordDaysLabel} ${formatCompactNumber(producedGaugeTarget, 1)} lbs`
        : `${dashboardProducedRecordDaysLabel} not set`,
      targetLabel: producedGaugeTarget !== null ? `${formatCompactNumber(producedGaugeTarget, 1)} lbs` : 'Not set',
      stretchLabel: stretchTargetValue(producedGaugeTarget) !== null ? `${formatCompactNumber(stretchTargetValue(producedGaugeTarget), 1)} lbs` : '--',
    },
    {
      label: 'Waste',
      value: pctValue(dashboard?.summary.wastePct),
      target: wasteGaugeTarget,
      stretch: stretchTargetValue(wasteGaugeTarget),
      valueLabel: formatPct(dashboard?.summary.wastePct, 2) || '--',
      detail: `${dashboardRecordDaysLabel} ${formatNumber(wasteGaugeTarget, 2)}%`,
      targetLabel: `${formatNumber(wasteGaugeTarget, 2)}%`,
      stretchLabel: `${formatNumber(stretchTargetValue(wasteGaugeTarget), 2)}%`,
      lowerIsBetter: true,
    },
    {
      label: 'OEE',
      value: pctValue(dashboard?.summary.oeePct),
      target: oeeGaugeTarget,
      stretch: stretchTargetValue(oeeGaugeTarget),
      valueLabel: formatPct(dashboard?.summary.oeePct, 1) || '--',
      detail: `${dashboardRecordDaysLabel} ${formatNumber(oeeGaugeTarget, 0)}%`,
      targetLabel: `${formatNumber(oeeGaugeTarget, 0)}%`,
      stretchLabel: `${formatNumber(stretchTargetValue(oeeGaugeTarget), 0)}%`,
    },
    {
      label: 'Labor Fit',
      value: pctValue(dashboard?.summary.headcountPct),
      target: laborGaugeTarget,
      stretch: stretchTargetValue(laborGaugeTarget),
      valueLabel: formatPct(dashboard?.summary.headcountPct, 1) || '--',
      detail: `${dashboardRecordDaysLabel} ${formatNumber(laborGaugeTarget, 0)}%`,
      targetLabel: `${formatNumber(laborGaugeTarget, 0)}%`,
      stretchLabel: `${formatNumber(stretchTargetValue(laborGaugeTarget), 0)}%`,
    },
  ];
  const renderDashboardGaugeGrid = (keyPrefix: string) => (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
      {dashboardGaugeMetrics.map((metric) => (
        <DashboardGaugeKpi
          key={`${keyPrefix}-${metric.label}`}
          {...metric}
          action={dashboardScopeAction(`${keyPrefix}-${metric.label}`, true)}
        />
      ))}
    </div>
  );
  const dashboardSectionChart = (dashboard?.sectionMix || []).map((row) => ({
    ...row,
    sectionLabel: SECTION_OPTIONS.find((section) => section.key === row.section)?.label || row.section,
    attainmentPctValue: pctValue(row.attainmentPct) || 0,
    wastePctValue: pctValue(row.wastePct) || 0,
    headcountPctValue: pctValue(row.headcountPct) || 0,
  }));
  const dashboardTrendByShift = dashboard?.trendByShift || [];
  const dashboardShiftTrendByDate = new Map(dashboardTrendByShift.map((row) => [row.date, row]));
  const dashboardTrendChart = dashboardTrend.map((row) => {
    const shiftTrend = dashboardShiftTrendByDate.get(row.date);
    const lbsProduced = Number.isFinite(Number(row.lbsProduced)) ? Number(row.lbsProduced) : null;
    return {
      ...row,
      dateLabel: formatDashboardDate(row.date),
      firstShiftLbsProduced: shiftTrend?.firstShift?.lbsProduced || 0,
      secondShiftLbsProduced: shiftTrend?.secondShift?.lbsProduced || 0,
      dailyLbsTarget: lbsProducedTarget,
      dailyWasteLbsTarget,
      trendLbsProduced: lbsProduced,
      attainmentPctValue: pctValue(row.attainmentPct),
      wastePctValue: pctValue(row.wastePct),
      headcountPctValue: pctValue(row.headcountPct),
    };
  });
  const combinedAttainmentPctYMax = Math.max(
    dashboardTrendChart.reduce((max, row) => Math.max(max, Number(row.attainmentPctValue) || 0), 0),
    attainmentTargetPct || 0,
    120,
  ) * 1.05;
  const combinedWastePctYMax = Math.max(
    dashboardTrendChart.reduce((max, row) => Math.max(max, Number(row.wastePctValue) || 0), 0),
    wasteTargetPct || 0,
    4,
  ) * 1.18;
  const dashboardLineTrendRows = dashboard?.lineTrendByShift || [];
  const dashboardLineAttainmentCharts = [1, 2, 3, 5].map((lineNumber) => {
    const linePattern = new RegExp(`\\bline\\s*${lineNumber}\\b`, 'i');
    return {
      lineNumber,
      title: `Line ${lineNumber} Attainment`,
      data: dashboardTrend.map((trendRow) => {
        const lineRow = dashboardLineTrendRows.find((row) => {
          if (row.date !== trendRow.date) return false;
          const label = `${row.location || ''} ${row.lineGroup || ''}`;
          return linePattern.test(label);
        });
        return {
          date: trendRow.date,
          dateLabel: formatDashboardDate(trendRow.date),
          firstShiftAttainmentPct: pctValue(lineRow?.firstShift?.attainmentPct) || 0,
          secondShiftAttainmentPct: pctValue(lineRow?.secondShift?.attainmentPct) || 0,
        };
      }),
    };
  });
  const dashboardLineWasteCharts = [1, 2, 3, 5].map((lineNumber) => {
    const linePattern = new RegExp(`\\bline\\s*${lineNumber}\\b`, 'i');
    const data = dashboardTrend.map((trendRow) => {
      const lineRow = dashboardLineTrendRows.find((row) => {
        if (row.date !== trendRow.date) return false;
        const label = `${row.location || ''} ${row.lineGroup || ''}`;
        return linePattern.test(label);
      });
        return {
          date: trendRow.date,
          dateLabel: formatDashboardDate(trendRow.date),
          firstShiftWastePct: pctValue(lineRow?.firstShift?.wastePct) || 0,
          secondShiftWastePct: pctValue(lineRow?.secondShift?.wastePct) || 0,
        };
      });
    const maxWastePct = data.reduce((max, row) => Math.max(max, row.firstShiftWastePct, row.secondShiftWastePct), 0);
    const yMax = Math.max(maxWastePct, wasteTargetPct || 0, 4);
    return {
      lineNumber,
      title: `Line ${lineNumber} Waste %`,
      data,
      wasteTargetPct,
      yMax: yMax > 0 ? yMax * 1.18 : 4,
    };
  });
  const dashboardLateStartPieCharts = ([
    { key: 'firstShift' as const, title: 'First Shift' },
    { key: 'secondShift' as const, title: 'Second Shift' },
  ]).map((shift) => {
    const recordDates = new Set<string>();
    const data = [1, 2, 3, 5].map((lineNumber, index) => {
      const linePattern = new RegExp(`\\bline\\s*${lineNumber}\\b`, 'i');
      const minutes = dashboardLineTrendRows.reduce((total, row) => {
        const label = `${row.location || ''} ${row.lineGroup || ''}`;
        if (!linePattern.test(label)) return total;
        const metrics = row[shift.key];
        const hasRecord = Boolean(
          Number(metrics?.reportsCount || 0) > 0 ||
          Number(metrics?.casesProduced || 0) > 0 ||
          Number(metrics?.lbsProduced || 0) > 0 ||
          Number(metrics?.lateStartMinutes || 0) > 0,
        );
        if (hasRecord) recordDates.add(row.date);
        return total + (Number(metrics?.lateStartMinutes || 0) || 0);
      }, 0);

      return {
        name: `Line ${lineNumber}`,
        value: minutes,
        color: DASHBOARD_LINE_COLORS[index % DASHBOARD_LINE_COLORS.length],
      };
    }).filter((item) => item.value > 0);
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const dates = Array.from(recordDates).sort();

    return {
      ...shift,
      data,
      total,
      dates,
      datesLabel: dates.length ? dates.map(formatDashboardDate).join(', ') : 'No records yet',
    };
  });
  const dashboardFullViewChart = (() => {
    if (!dashboardFullViewChartId) return null;

    if (dashboardFullViewChartId === 'production-trend') {
      return {
        title: 'Production Trend',
        subtitle: `${dashboardScopeDescription} combined shift pounds with vertical dates`,
        width: dashboardFullChartWidth(dashboardTrendChart.length),
        legendItems: [
          { label: 'Combined shift lbs', color: '#2563eb', kind: 'bar' as const },
          { label: 'Production trend', color: '#f97316', kind: 'line' as const },
          ...(lbsProducedTarget !== null ? [{ label: `Daily target (${formatCompactNumber(lbsProducedTarget, 1)})`, color: '#60a5fa', kind: 'dashed' as const }] : []),
        ],
        content: (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dashboardTrendChart} margin={{ top: 24, right: 36, left: 18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dateLabel" interval={0} angle={-90} textAnchor="end" height={88} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" domain={PRODUCTION_TREND_LBS_DOMAIN} ticks={PRODUCTION_TREND_LBS_TICKS} tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactNumber(value, 0)} axisLine={false} tickLine={false} allowDataOverflow />
              <Tooltip content={<DashboardTooltip />} />
              {lbsProducedTarget !== null && (
                <>
                  <ReferenceArea yAxisId="left" y1={PRODUCTION_TREND_LBS_DOMAIN[0]} y2={Math.min(PRODUCTION_TREND_LBS_DOMAIN[1], Math.max(PRODUCTION_TREND_LBS_DOMAIN[0], lbsProducedTarget))} fill="#fee2e2" fillOpacity={0.28} ifOverflow="extendDomain" />
                  <ReferenceLine yAxisId="left" y={lbsProducedTarget} stroke="#60a5fa" strokeWidth={2.25} strokeDasharray="6 4" ifOverflow="extendDomain" label={{ value: formatCompactNumber(lbsProducedTarget, 1), position: 'insideRight', fill: '#2563eb', fontSize: 10, fontWeight: 900 }} />
                </>
              )}
              <Bar yAxisId="left" dataKey="lbsProduced" name="Combined shift lbs" radius={[5, 5, 0, 0]} maxBarSize={34} animationDuration={1000} animationEasing="ease-out">
                {dashboardTrendChart.map((entry) => {
                  const lbsValue = Number(entry.lbsProduced);
                  const isZero = !Number.isFinite(lbsValue) || lbsValue <= 0;
                  const isOnTarget = lbsProducedTarget !== null && lbsValue >= lbsProducedTarget;
                  return <Cell key={`full-production-trend-bar-${entry.date}`} fill={isZero ? '#d1d5db' : isOnTarget ? '#22c55e' : '#ef4444'} fillOpacity={isZero ? 0.55 : 0.92} />;
                })}
              </Bar>
              <Line yAxisId="left" type="monotone" dataKey="trendLbsProduced" name="Production trend" stroke="#f97316" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" dot={{ r: 3.5, strokeWidth: 1.75, stroke: '#ffffff', fill: '#f97316' }} activeDot={{ r: 5, fill: '#ffffff', stroke: '#f97316', strokeWidth: 2 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ),
      };
    }

    if (dashboardFullViewChartId === 'item-output-mix') {
      const itemData = (dashboard?.itemPerformance || []).slice(0, 30);
      return {
        title: 'Item Output Mix',
        subtitle: 'Highest output items in the selected period',
        width: dashboardFullChartWidth(itemData.length, 1280),
        legendItems: [
          { label: 'Lbs produced', color: '#2563eb', kind: 'line' as const },
        ],
        content: (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={itemData} margin={{ top: 24, right: 36, left: 18, bottom: 8 }}>
              <defs>
                <linearGradient id="itemOutputGradientFull" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="itemNo" interval={0} angle={-90} textAnchor="end" height={88} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DashboardTooltip />} />
              <Area type="monotone" dataKey="lbsProduced" name="Lbs produced" stroke="#2563eb" strokeWidth={2.5} fill="url(#itemOutputGradientFull)" />
            </AreaChart>
          </ResponsiveContainer>
        ),
      };
    }

    if (dashboardFullViewChartId === 'combined-attainment-trend') {
      return {
        title: 'Combined Attainment Trend',
        subtitle: `${dashboardScopeDescription} combined first and second shift attainment percentage`,
        width: dashboardFullChartWidth(dashboardTrendChart.length),
        legendItems: [
          { label: 'Combined attainment %', color: '#22c55e', kind: 'bar' as const },
          { label: 'Attainment trend', color: '#f97316', kind: 'line' as const },
          { label: `Target ${formatNumber(attainmentTargetPct ?? 100, 1)}%`, color: '#60a5fa', kind: 'dashed' as const },
        ],
        content: (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dashboardTrendChart} margin={{ top: 24, right: 36, left: 18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dateLabel" interval={0} angle={-90} textAnchor="end" height={88} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, combinedAttainmentPctYMax]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${formatNumber(value, 0)}%`} width={48} />
              <Tooltip content={<DashboardTooltip />} />
              <ReferenceArea y1={0} y2={attainmentTargetPct ?? 100} fill="#fecaca" fillOpacity={0.24} ifOverflow="extendDomain" />
              <ReferenceLine y={attainmentTargetPct ?? 100} stroke="#60a5fa" strokeWidth={2.35} strokeDasharray="6 4" ifOverflow="extendDomain" label={{ value: `${formatNumber(attainmentTargetPct ?? 100, 1)}%`, position: 'insideRight', fill: '#2563eb', fontSize: 10, fontWeight: 900 }} />
              <Bar dataKey="attainmentPctValue" name="Combined attainment %" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive animationDuration={900} animationEasing="ease-out">
                {dashboardTrendChart.map((entry) => {
                  const value = Number(entry.attainmentPctValue);
                  const hasOutput = Number(entry.lbsProduced) > 0 || Number(entry.casesProduced) > 0;
                  const onTarget = value >= (attainmentTargetPct ?? 100);
                  return <Cell key={`full-combined-attainment-${entry.date}`} fill={!hasOutput ? '#d1d5db' : onTarget ? '#22c55e' : '#ef4444'} fillOpacity={!hasOutput ? 0.55 : 0.92} />;
                })}
              </Bar>
              <Line type="monotone" dataKey="attainmentPctValue" name="Attainment trend" stroke="#f97316" strokeWidth={2.2} dot={{ r: 3.5, strokeWidth: 1.75, stroke: '#ffffff', fill: '#f97316' }} activeDot={{ r: 5, fill: '#ffffff', stroke: '#f97316', strokeWidth: 2 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ),
      };
    }

    if (dashboardFullViewChartId === 'combined-waste-trend') {
      return {
        title: 'Combined Waste Trend',
        subtitle: `${dashboardScopeDescription} combined first and second shift waste percentage`,
        width: dashboardFullChartWidth(dashboardTrendChart.length),
        legendItems: [
          { label: 'Combined waste %', color: '#22c55e', kind: 'bar' as const },
          { label: 'Waste trend', color: '#f97316', kind: 'line' as const },
          ...(wasteTargetPct !== null ? [{ label: `Waste target (${formatWastePctPoint(wasteTargetPct)})`, color: '#60a5fa', kind: 'dashed' as const }] : []),
        ],
        content: (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dashboardTrendChart} margin={{ top: 24, right: 36, left: 18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fee2e2" />
              <XAxis dataKey="dateLabel" interval={0} angle={-90} textAnchor="end" height={88} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, combinedWastePctYMax]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatWastePctPoint(value)} width={48} />
              <Tooltip content={<DashboardTooltip />} />
              {wasteTargetPct !== null && (
                <>
                  <ReferenceArea y1={wasteTargetPct} y2={combinedWastePctYMax} fill="#fecaca" fillOpacity={0.24} ifOverflow="extendDomain" />
                  <ReferenceLine y={wasteTargetPct} stroke="#60a5fa" strokeWidth={2.35} strokeDasharray="6 4" ifOverflow="extendDomain" label={{ value: formatWastePctPoint(wasteTargetPct), position: 'insideRight', fill: '#2563eb', fontSize: 10, fontWeight: 900 }} />
                </>
              )}
              <Bar dataKey="wastePctValue" name="Combined waste %" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive animationDuration={900} animationEasing="ease-out">
                {dashboardTrendChart.map((entry) => {
                  const value = Number(entry.wastePctValue);
                  const hasOutput = Number(entry.lbsProduced) > 0 || Number(entry.casesProduced) > 0;
                  const onTarget = wasteTargetPct !== null && value <= wasteTargetPct;
                  return <Cell key={`full-combined-waste-${entry.date}`} fill={!hasOutput ? '#d1d5db' : onTarget ? '#22c55e' : '#ef4444'} fillOpacity={!hasOutput ? 0.55 : 0.92} />;
                })}
              </Bar>
              <Line type="monotone" dataKey="wastePctValue" name="Waste trend" stroke="#f97316" strokeWidth={2.2} dot={{ r: 3.5, strokeWidth: 1.75, stroke: '#ffffff', fill: '#f97316' }} activeDot={{ r: 5, fill: '#ffffff', stroke: '#f97316', strokeWidth: 2 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ),
      };
    }

    const attainmentMatch = dashboardFullViewChartId.match(/^line-(\d+)-attainment$/);
    if (attainmentMatch) {
      const chart = dashboardLineAttainmentCharts.find((candidate) => String(candidate.lineNumber) === attainmentMatch[1]);
      if (!chart) return null;
      return {
        title: chart.title,
        subtitle: `${dashboardScopeDescription} first and second shift attainment for Line ${chart.lineNumber}`,
        width: dashboardFullChartWidth(chart.data.length),
        legendItems: [
          { label: 'First shift attainment', color: '#2563eb', kind: 'bar' as const },
          { label: 'Second shift attainment', color: '#f97316', kind: 'bar' as const },
          { label: `Target ${formatNumber(attainmentTargetPct ?? 100, 1)}%`, color: '#60a5fa', kind: 'dashed' as const },
        ],
        content: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart.data} barGap={1} barCategoryGap="24%" margin={{ top: 24, right: 36, left: 18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dateLabel" interval={0} angle={-90} textAnchor="end" height={88} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 150]} ticks={[0, 50, 100, 150]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} width={48} />
              <Tooltip content={<DashboardTooltip />} />
              <ReferenceArea y1={0} y2={attainmentTargetPct ?? 100} fill="#fecaca" fillOpacity={0.24} ifOverflow="extendDomain" />
              <ReferenceLine y={attainmentTargetPct ?? 100} stroke="#60a5fa" strokeDasharray="6 4" ifOverflow="extendDomain" label={{ value: `${formatNumber(attainmentTargetPct ?? 100, 1)}%`, position: 'insideRight', fill: '#2563eb', fontSize: 10, fontWeight: 900 }} />
              <Bar dataKey="firstShiftAttainmentPct" name="First shift attainment" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive animationDuration={900} animationEasing="ease-out" />
              <Bar dataKey="secondShiftAttainmentPct" name="Second shift attainment" fill="#f97316" radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive animationDuration={900} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        ),
      };
    }

    const wasteMatch = dashboardFullViewChartId.match(/^line-(\d+)-waste$/);
    if (wasteMatch) {
      const chart = dashboardLineWasteCharts.find((candidate) => String(candidate.lineNumber) === wasteMatch[1]);
      if (!chart) return null;
      return {
        title: chart.title,
        subtitle: `${dashboardScopeDescription} first and second shift waste percent for Line ${chart.lineNumber}`,
        width: dashboardFullChartWidth(chart.data.length),
        legendItems: [
          { label: 'First shift waste %', color: '#2563eb', kind: 'bar' as const },
          { label: 'Second shift waste %', color: '#f97316', kind: 'bar' as const },
          ...(chart.wasteTargetPct !== null ? [{ label: `Target ${formatWastePctPoint(chart.wasteTargetPct)}`, color: '#60a5fa', kind: 'dashed' as const }] : []),
        ],
        content: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart.data} barGap={1} barCategoryGap="24%" margin={{ top: 24, right: 36, left: 18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fee2e2" />
              <XAxis dataKey="dateLabel" interval={0} angle={-90} textAnchor="end" height={88} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, chart.yMax]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatWastePctPoint(value)} width={48} />
              <Tooltip content={<DashboardTooltip />} />
              {chart.wasteTargetPct !== null && (
                <>
                  <ReferenceArea y1={chart.wasteTargetPct} y2={chart.yMax} fill="#fecaca" fillOpacity={0.24} ifOverflow="extendDomain" />
                  <ReferenceLine y={chart.wasteTargetPct} stroke="#60a5fa" strokeDasharray="6 4" ifOverflow="extendDomain" label={{ value: formatWastePctPoint(chart.wasteTargetPct), position: 'insideRight', fill: '#2563eb', fontSize: 10, fontWeight: 900 }} />
                </>
              )}
              <Bar dataKey="firstShiftWastePct" name="First shift waste %" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive animationDuration={900} animationEasing="ease-out" />
              <Bar dataKey="secondShiftWastePct" name="Second shift waste %" fill="#f97316" radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive animationDuration={900} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        ),
      };
    }

    return null;
  })();
  const pairedRowsByAssembly = useMemo(() => {
    const pairs = new Map<string, EosLine>();
    visibleLines.forEach((line) => {
      if (line.pairedAssemblyRowKey) {
        pairs.set(line.pairedAssemblyRowKey, line);
      }
    });
    return pairs;
  }, [visibleLines]);

  const notesPayload = useMemo(() => productionEosNotesPayloadShape({
    reportDate,
    dayOfWeek,
    shiftId,
    currentShiftName: currentShift?.name,
    user,
    safetyConcerns,
    qualityIssues,
    lineNotes,
  }), [currentShift?.name, dayOfWeek, lineNotes, qualityIssues, reportDate, safetyConcerns, shiftId, user]);

  const reportPayload = useCallback(() => ({
    reportDate,
    dayOfWeek,
    shiftId: shiftId || null,
    shiftName: currentShift?.name || null,
    reportedByUserId: user?.id || null,
    reportedByName: user ? `${user.firstName} ${user.lastName}`.trim() || user.email : '',
    safetyConcerns,
    qualityIssues,
    lines: lines.map((line) => {
      const normalizedLine = {
        ...line,
        itemNo: normalizeItemNoInput(line.itemNo) || null,
      };

      if (!line.pairedAssemblyRowKey) return normalizedLine;
      return {
        ...normalizedLine,
        itemNo: null,
        casesScheduled: null,
        casesProduced: null,
      };
    }),
    notes: NOTE_LINES.map((lineGroup, index) => ({
      lineGroup,
      notes: lineNotes[lineGroup] || '',
      sortOrder: index,
    })),
  }), [currentShift?.name, dayOfWeek, lineNotes, lines, qualityIssues, reportDate, safetyConcerns, shiftId, user]);

  const showNotice = (type: NoticeType, message: string) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const openDashboardDateFilter = useCallback((cardId: string) => {
    if (dashboardFilterOpenFor === cardId) {
      setDashboardFilterOpenFor(null);
      return;
    }
    setDashboardDraftRanges(dashboardDateRanges);
    setDashboardPendingRangeId(null);
    const firstDate = dashboardSelectedDates[0] || reportDate || todayInputValue();
    setDashboardCalendarMonth(monthStartDate(firstDate));
    setDashboardFilterOpenFor(cardId);
  }, [dashboardDateRanges, dashboardFilterOpenFor, dashboardSelectedDates, reportDate]);

  const selectDashboardCalendarDay = useCallback((date: string) => {
    setDashboardDraftRanges((current) => {
      if (!dashboardPendingRangeId) {
        const id = `draft-${date}-${Date.now()}`;
        setDashboardPendingRangeId(id);
        return [...current, { id, startDate: date, endDate: date }];
      }

      setDashboardPendingRangeId(null);
      return current.map((range) => {
        if (range.id !== dashboardPendingRangeId) return range;
        return date >= range.startDate
          ? { ...range, endDate: date }
          : { ...range, startDate: date, endDate: range.startDate };
      });
    });
  }, [dashboardPendingRangeId]);

  const removeDashboardDraftRange = useCallback((rangeId: string) => {
    setDashboardDraftRanges((current) => current.filter((range) => range.id !== rangeId));
    setDashboardPendingRangeId((current) => current === rangeId ? null : current);
  }, []);

  const clearDashboardDateFilter = useCallback(() => {
    setDashboardDateRanges([]);
    setDashboardDraftRanges([]);
    setDashboardPendingRangeId(null);
    setDashboardFilterOpenFor(null);
  }, []);

  const applyDashboardDateFilter = useCallback(() => {
    const normalizedRanges = normalizeDashboardDateRanges(dashboardDraftRanges);
    const selectedDates = dashboardSelectedDatesFromRanges(normalizedRanges);
    if (selectedDates.length > 93) {
      showNotice('error', 'Dashboard filter supports up to 93 selected days.');
      return;
    }
    setDashboardDateRanges(normalizedRanges);
    setDashboardDraftRanges(normalizedRanges);
    setDashboardPendingRangeId(null);
    setDashboardFilterOpenFor(null);
  }, [dashboardDraftRanges]);

  const dashboardScopeAction = useCallback((cardId: string, compact = false) => (
    <div
      ref={dashboardFilterOpenFor === cardId ? dashboardFilterRef : undefined}
      className="relative shrink-0"
    >
      <div className="flex items-center gap-1">
        {!compact && (
          <span className="inline-flex h-8 items-center rounded-full bg-blue-50 px-3 text-[11px] font-black text-blue-700 shadow-sm dark:bg-blue-950/50 dark:text-blue-200">
            {dashboardScopeLabel}
          </span>
        )}
        <button
          type="button"
          onClick={() => openDashboardDateFilter(cardId)}
          className={`inline-flex ${compact ? 'h-6 w-6' : 'h-8 w-8'} items-center justify-center rounded-full border text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-950/60 ${dashboardFilterOpenFor === cardId ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100 dark:border-blue-700 dark:bg-blue-950/60 dark:ring-blue-950' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'}`}
          aria-label="Filter dashboard dates"
          aria-expanded={dashboardFilterOpenFor === cardId}
        >
          <Filter className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      </div>
      {dashboardFilterOpenFor === cardId && (
        <DashboardDateFilterPopover
          month={dashboardCalendarMonth}
          draftRanges={dashboardDraftRanges}
          pendingRangeId={dashboardPendingRangeId}
          onPreviousMonth={() => setDashboardCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1, 12))}
          onNextMonth={() => setDashboardCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1, 12))}
          onSelectDay={selectDashboardCalendarDay}
          onRemoveRange={removeDashboardDraftRange}
          onClear={() => {
            setDashboardDraftRanges([]);
            setDashboardPendingRangeId(null);
          }}
          onReset={clearDashboardDateFilter}
          onApply={applyDashboardDateFilter}
        />
      )}
    </div>
  ), [
    applyDashboardDateFilter,
    clearDashboardDateFilter,
    dashboardCalendarMonth,
    dashboardDraftRanges,
    dashboardFilterOpenFor,
    dashboardPendingRangeId,
    dashboardScopeLabel,
    openDashboardDateFilter,
    removeDashboardDraftRange,
    selectDashboardCalendarDay,
  ]);

  const showDashboardFullViewButton = dashboardRange.days > 10;
  const dashboardChartAction = useCallback((cardId: string, chartId: string) => (
    <div className="flex shrink-0 items-center gap-1">
      {dashboardScopeAction(cardId)}
      {showDashboardFullViewButton && (
        <button
          type="button"
          onClick={() => setDashboardFullViewChartId(chartId)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:text-blue-200 dark:hover:bg-blue-950/60"
          aria-label="Open chart full view"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  ), [dashboardScopeAction, showDashboardFullViewButton]);

  useEffect(() => {
    if (activePageTab !== 'NOTES') return;
    const frame = window.requestAnimationFrame(() => {
      Object.values(noteTextareaRefs.current).forEach((element) => resizeNoteTextarea(element));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePageTab, lineNotes, qualityIssues, safetyConcerns]);

  const syncNotesFromReport = useCallback((report: LoadedReport) => {
    const normalizedDate = dateInputFromValue(report.reportDate);
    const nextLineNotes = lineNotesFromReport(report);
    setSafetyConcerns(report.safetyConcerns || '');
    setQualityIssues(report.qualityIssues || '');
    setLineNotes(nextLineNotes);
    lastNotesAutosaveKey.current = productionEosNotesKey(productionEosNotesPayloadShape({
      reportDate: normalizedDate,
      dayOfWeek: report.dayOfWeek || dayFromDate(normalizedDate),
      shiftId: report.shiftId || '',
      currentShiftName: report.shiftNameSnapshot,
      user,
      safetyConcerns: report.safetyConcerns || '',
      qualityIssues: report.qualityIssues || '',
      lineNotes: nextLineNotes,
    }));
    setNotesSaveStatus('saved');
    notesDirty.current = false;
  }, [user]);

  const hydrateReportForEditing = useCallback((report: LoadedReport) => {
    const normalizedDate = dateInputFromValue(report.reportDate);
    const selectedReportShiftId = report.shiftId || '';
    setReportDate(normalizedDate);
    setDayOfWeek(report.dayOfWeek || dayFromDate(normalizedDate));
    setShiftId(selectedReportShiftId);
    setLines(linesWithTemplateSchedule(report.lines || [], selectedReportShiftId, template?.rows || []));
    syncNotesFromReport(report);
    const reportTotalsForEdit = report.totals || {};
    setTotals(overallTotalsFrom(reportTotalsForEdit));
    setTotalsBySection(totalsBySectionFrom(reportTotalsForEdit));
    setWarnings([]);
    setEditingReportId(report.id);
    setActivePageTab('SUBMIT_REPORT');
    setFabOpen(false);
  }, [syncNotesFromReport, template?.rows]);

  const loadAuditTrail = useCallback(async (reportId = selectedReportId) => {
    if (!reportId) {
      setAuditTrail([]);
      setExpandedAuditEntryIds(new Set());
      return;
    }
    setAuditLoading(true);
    try {
      const res = await api.get(`/production-eos/reports/${reportId}/audit-trail`);
      setAuditTrail(res.data.auditTrail || []);
      setExpandedAuditEntryIds(new Set());
    } catch (error: any) {
      setAuditTrail([]);
      setExpandedAuditEntryIds(new Set());
      showNotice('error', error.response?.data?.error || 'Could not load Production EOS audit trail.');
    } finally {
      setAuditLoading(false);
    }
  }, [selectedReportId]);

  const toggleAuditEntry = useCallback((entryId: string) => {
    setExpandedAuditEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!template || !user || !notesPayload.shiftId) return;

    const key = productionEosNotesKey(notesPayload);
    if (!lastNotesAutosaveKey.current) {
      lastNotesAutosaveKey.current = key;
      return;
    }
    if (!notesDirty.current) {
      lastNotesAutosaveKey.current = key;
      return;
    }
    if (key === lastNotesAutosaveKey.current) return;
    if (!hasNotesContent(notesPayload) && !selectedReportId && !selectedReport?.id) return;

    if (notesAutosaveTimer.current) {
      clearTimeout(notesAutosaveTimer.current);
    }

    setNotesSaveStatus('saving');
    notesAutosaveTimer.current = setTimeout(async () => {
      try {
        const res = await api.put('/production-eos/reports/notes', notesPayload);
        const report = res.data.report as LoadedReport | null;
        lastNotesAutosaveKey.current = key;
        notesDirty.current = false;
        setNotesSaveStatus('saved');
        if (report) {
          const normalizedReport = {
            ...report,
            reportDate: dateInputFromValue(report.reportDate),
            lines: report.lines || [],
          };
          setSelectedReport(normalizedReport);
          setSelectedReportId(report.id);
          if (activePageTab === 'AUDIT_TRAIL') {
            void loadAuditTrail(report.id);
          }
        }
      } catch (error: any) {
        setNotesSaveStatus('error');
      }
    }, 400);

    return () => {
      if (notesAutosaveTimer.current) {
        clearTimeout(notesAutosaveTimer.current);
      }
    };
  }, [activePageTab, loadAuditTrail, notesPayload, selectedReport?.id, selectedReportId, template, user]);

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const templateRes = await api.get('/production-eos/template');
      const loadedTemplate = templateRes.data.template as TemplateResponse;
      setTemplate(loadedTemplate);
      setLines(loadedTemplate.rows || []);
      const firstShift = sortedShiftOptions(loadedTemplate.shifts || [])[0];
      if (firstShift) setShiftId(firstShift.id);
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not load Production EOS setup.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  useEffect(() => {
    reportSelectionRef.current = { reportDate, shiftId };
  }, [reportDate, shiftId]);

  const loadReportById = useCallback(async (reportId: string) => {
    if (!reportId) {
      setSelectedReport(null);
      return;
    }

    try {
      const res = await api.get(`/production-eos/reports/${reportId}`);
      const report = res.data.report as LoadedReport;
      const normalizedReport = {
        ...report,
        reportDate: dateInputFromValue(report.reportDate),
        lines: report.lines || [],
      };
      const latestSelection = reportSelectionRef.current;
      if (
        latestSelection.reportDate
        && latestSelection.shiftId
        && !reportMatchesSelection(normalizedReport, latestSelection.reportDate, latestSelection.shiftId)
      ) {
        return;
      }
      setSelectedReport(normalizedReport);
      if (!editingReportId) {
        syncNotesFromReport(normalizedReport);
      }
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not load submitted Production EOS report.');
    }
  }, [editingReportId, syncNotesFromReport]);

  const refreshFabAvailability = useCallback(async () => {
    if (!reportDate || !shiftId) {
      setFabAvailabilityLoading(false);
      setFabReport(null);
      return null;
    }

    if (selectedReportMatchesHeader && selectedReport?.lines?.length) {
      setFabAvailabilityLoading(false);
      setFabReport(selectedReport);
      return selectedReport;
    }

    setFabAvailabilityLoading(true);
    try {
      const reportsRes = await api.get('/production-eos/reports', {
        params: { date: reportDate, shiftId },
      });
      const reports = (reportsRes.data.reports || []).map((report: ReportSummary) => ({
        ...report,
        reportDate: dateInputFromValue(report.reportDate),
      }));
      const reportId = reports[0]?.id;
      if (!reportId) {
        setFabReport(null);
        return null;
      }

      const reportRes = await api.get(`/production-eos/reports/${reportId}`);
      const report = {
        ...reportRes.data.report,
        reportDate: dateInputFromValue(reportRes.data.report.reportDate),
        lines: reportRes.data.report.lines || [],
      } as LoadedReport;
      setFabReport(report);
      return report;
    } catch (error: any) {
      setFabReport(null);
      showNotice('error', error.response?.data?.error || 'Could not check existing Production EOS report records.');
      return null;
    } finally {
      setFabAvailabilityLoading(false);
    }
  }, [reportDate, selectedReport, selectedReportMatchesHeader, shiftId]);

  const loadAuditTrailForSelection = useCallback(async () => {
    if (!reportDate || !shiftId) {
      setSelectedReportId('');
      setSelectedReport(null);
      setAuditTrail([]);
      setExpandedAuditEntryIds(new Set());
      return;
    }

    setAuditLoading(true);
    try {
      const res = await api.get('/production-eos/audit-trail', {
        params: { date: reportDate, shiftId },
      });
      const report = res.data.report as LoadedReport | null;
      if (report) {
        const normalizedReport = {
          ...report,
          reportDate: dateInputFromValue(report.reportDate),
          lines: report.lines || [],
        };
        setSelectedReportId(report.id);
        setSelectedReport(normalizedReport);
      } else {
        setSelectedReportId('');
        setSelectedReport(null);
      }
      setAuditTrail(res.data.auditTrail || []);
      setExpandedAuditEntryIds(new Set());
    } catch (error: any) {
      setAuditTrail([]);
      setExpandedAuditEntryIds(new Set());
      showNotice('error', error.response?.data?.error || 'Could not load Production EOS audit trail.');
    } finally {
      setAuditLoading(false);
    }
  }, [reportDate, shiftId]);

  const loadSubmittedReports = useCallback(async () => {
    const selectionDate = reportDate;
    const selectionShiftId = shiftId;
    setSelectedReportId('');
    setSelectedReport(null);

    if (!selectionDate || !selectionShiftId) return;

    try {
      const res = await api.get('/production-eos/reports', {
        params: {
          status: 'SUBMITTED',
          date: selectionDate,
          shiftId: selectionShiftId,
        },
      });
      const reports = (res.data.reports || []).map((report: ReportSummary) => ({
        ...report,
        reportDate: dateInputFromValue(report.reportDate),
      }));
      const latestSelection = reportSelectionRef.current;
      if (latestSelection.reportDate !== selectionDate || latestSelection.shiftId !== selectionShiftId) return;

      const nextReport = reports.find((report: ReportSummary) => report.shiftId === selectionShiftId) || reports[0];
      setSelectedReportId(nextReport?.id || '');
      if (nextReport?.id) void loadReportById(nextReport.id);
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not load submitted Production EOS reports.');
    }
  }, [loadReportById, reportDate, shiftId]);

  const loadDashboard = useCallback(async () => {
    if (!reportDate) return;
    setDashboardLoading(true);
    try {
      const res = await api.get('/production-eos/dashboard', {
        params: {
          endDate: dashboardRange.endDate,
          days: dashboardRange.days,
          dates: dashboardRange.dates || undefined,
        },
      });
      setDashboard(res.data.dashboard || null);
    } catch (error: any) {
      setDashboard(null);
      showNotice('error', error.response?.data?.error || 'Could not load Production EOS dashboard.');
    } finally {
      setDashboardLoading(false);
    }
  }, [dashboardRange.days, dashboardRange.dates, dashboardRange.endDate, reportDate]);

  const clearNotesForSelectedShift = useCallback(() => {
    const nextLineNotes = emptyLineNotes();
    setSelectedReportId('');
    setSelectedReport(null);
    setSafetyConcerns('');
    setQualityIssues('');
    setLineNotes(nextLineNotes);
    lastNotesAutosaveKey.current = productionEosNotesKey(productionEosNotesPayloadShape({
      reportDate,
      dayOfWeek,
      shiftId,
      currentShiftName: currentShift?.name,
      user,
      safetyConcerns: '',
      qualityIssues: '',
      lineNotes: nextLineNotes,
    }));
    notesDirty.current = false;
    setNotesSaveStatus('idle');
  }, [currentShift?.name, dayOfWeek, reportDate, shiftId, user]);

  const loadNotesReport = useCallback(async () => {
    if (!reportDate || !shiftId || notesDirty.current) return;

    try {
      const res = await api.get('/production-eos/reports', {
        params: {
          date: reportDate,
          shiftId,
        },
      });
      const reports = (res.data.reports || []).map((report: ReportSummary) => ({
        ...report,
        reportDate: dateInputFromValue(report.reportDate),
      }));
      if (reports[0]?.id) {
        setSelectedReportId(reports[0].id);
        await loadReportById(reports[0].id);
      } else {
        clearNotesForSelectedShift();
      }
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not load Production EOS notes.');
    }
  }, [clearNotesForSelectedShift, loadReportById, reportDate, shiftId]);

  useEffect(() => {
    if (activePageTab === 'PRODUCTION') {
      void loadSubmittedReports();
    }
  }, [activePageTab, loadSubmittedReports]);

  useEffect(() => {
    if (activePageTab === 'DASHBOARD' || activePageTab === 'PRODUCTION') {
      void loadDashboard();
    }
  }, [activePageTab, loadDashboard]);

  useEffect(() => {
    if (activePageTab === 'NOTES') {
      void loadNotesReport();
    }
  }, [activePageTab, loadNotesReport]);

  useEffect(() => {
    if (selectedReportId) void loadReportById(selectedReportId);
  }, [loadReportById, selectedReportId]);

  useEffect(() => {
    if (activePageTab === 'AUDIT_TRAIL') {
      void loadAuditTrailForSelection();
    }
  }, [activePageTab, loadAuditTrailForSelection]);

  useEffect(() => {
    setFabAvailabilityLoading(false);
    setFabReport(null);
  }, [reportDate, shiftId]);

  useEffect(() => {
    if (!shiftMenuOpen && !sectionMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (shiftMenuOpen && !shiftMenuRef.current?.contains(target)) setShiftMenuOpen(false);
      if (sectionMenuOpen && !sectionMenuRef.current?.contains(target)) setSectionMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShiftMenuOpen(false);
        setSectionMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sectionMenuOpen, shiftMenuOpen]);

  useEffect(() => {
    if (!dashboardFilterOpenFor) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (dashboardFilterRef.current?.contains(target)) return;
      setDashboardFilterOpenFor(null);
      setDashboardPendingRangeId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setDashboardFilterOpenFor(null);
      setDashboardPendingRangeId(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dashboardFilterOpenFor]);

  useEffect(() => {
    const day = dayFromDate(reportDate);
    if (day) setDayOfWeek(day);
  }, [reportDate]);

  const runCalculation = useCallback(async (quiet = false) => {
    if (!lines.length || !reportDate) return;
    setCalculating(true);
    try {
      const res = await api.post('/production-eos/calculate', reportPayload());
      const calculation = res.data.calculation;
      setLines(linesWithTemplateSchedule(calculation.lines || lines, shiftId, template?.rows || []));
      setTotals(calculation.totals || {});
      setTotalsBySection(totalsBySectionFrom(calculation.totalsBySection || calculation.totals));
      setWarnings(calculation.validationWarnings || []);
      if (!quiet) showNotice('success', 'Report recalculated from backend formulas.');
    } catch (error: any) {
      if (!quiet) showNotice('error', error.response?.data?.error || 'Calculation failed.');
    } finally {
      setCalculating(false);
    }
  }, [lines, reportDate, reportPayload, shiftId, template?.rows]);

  useEffect(() => {
    if (!template || !lines.length) return;
    if (calculationTimer.current) clearTimeout(calculationTimer.current);
    calculationTimer.current = setTimeout(() => runCalculation(true), 650);
    return () => {
        if (calculationTimer.current) clearTimeout(calculationTimer.current);
      };
    // Intentionally keyed by manual input changes so backend-calculated rows do not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputVersion, reportDate, dayOfWeek, shiftId, template]);

  const searchItems = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) return;
    try {
      const res = await api.get('/production-eos/items', { params: { query } });
      const incoming = res.data.items || [];
      setItemOptions((prev) => {
        const map = new Map(prev.map((item) => [item.itemNo, item]));
        incoming.forEach((item: ItemOption) => map.set(item.itemNo, item));
        return Array.from(map.values()).slice(0, 80);
      });
    } catch {
      // Search should not interrupt typing.
    }
  }, []);

  const positionItemPicker = useCallback((rowKey: string, element: HTMLInputElement) => {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;
    const maxPanelWidth = Math.max(260, viewportWidth - 24);
    const panelWidth = Math.min(420, Math.max(320, rect.width * 3.4), maxPanelWidth);
    const top = Math.max(12, rect.top - 6);
    const preferredLeft = rect.right + 12;
    const left = Math.min(Math.max(12, preferredLeft), viewportWidth - panelWidth - 12);
    const maxHeight = Math.max(120, viewportHeight - top - 12);
    const arrowTop = Math.min(maxHeight - 18, Math.max(18, rect.top + (rect.height / 2) - top));

    setItemPickerAnchor({
      rowKey,
      top,
      left,
      width: panelWidth,
      maxHeight,
      arrowTop,
    });
  }, []);

  const positionScheduledStartEditor = useCallback((line: EosLine, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;
    const panelWidth = Math.min(320, Math.max(280, viewportWidth - 24));
    const top = Math.max(12, rect.top - 18);
    const preferredLeft = rect.right + 12;
    const left = Math.min(Math.max(12, preferredLeft), viewportWidth - panelWidth - 12);
    const maxPanelHeight = 210;
    const panelTop = Math.min(top, Math.max(12, viewportHeight - maxPanelHeight - 12));
    const arrowTop = Math.min(maxPanelHeight - 20, Math.max(22, rect.top + (rect.height / 2) - panelTop));
    const currentValue = line.scheduledStartTime || '';

    setScheduledStartEditor((current) => ({
      rowKey: line.rowKey,
      location: line.locationUnavailable ? 'Unavailable' : line.location,
      currentValue,
      draftValue: current?.rowKey === line.rowKey ? current.draftValue : currentValue,
      top: panelTop,
      left,
      width: panelWidth,
      arrowTop,
    }));
  }, []);

  useEffect(() => {
    if (!activeItemRowKey || !activeItemInputRef.current) return;

    const syncPickerPosition = () => {
      if (activeItemInputRef.current) {
        positionItemPicker(activeItemRowKey, activeItemInputRef.current);
      }
    };

    window.addEventListener('resize', syncPickerPosition);
    document.addEventListener('scroll', syncPickerPosition, true);
    return () => {
      window.removeEventListener('resize', syncPickerPosition);
      document.removeEventListener('scroll', syncPickerPosition, true);
    };
  }, [activeItemRowKey, positionItemPicker]);

  useEffect(() => {
    if (!scheduledStartEditor?.rowKey || !scheduledStartTriggerRef.current) return;

    const syncEditorPosition = () => {
      const line = lines.find((candidate) => candidate.rowKey === scheduledStartEditor.rowKey);
      if (line && scheduledStartTriggerRef.current) {
        positionScheduledStartEditor(line, scheduledStartTriggerRef.current);
      }
    };

    window.addEventListener('resize', syncEditorPosition);
    document.addEventListener('scroll', syncEditorPosition, true);
    return () => {
      window.removeEventListener('resize', syncEditorPosition);
      document.removeEventListener('scroll', syncEditorPosition, true);
    };
  }, [lines, positionScheduledStartEditor, scheduledStartEditor?.rowKey]);

  useEffect(() => {
    if (!scheduledStartEditor) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (scheduledStartPopoverRef.current?.contains(target)) return;
      if (scheduledStartTriggerRef.current?.contains(target)) return;
      setScheduledStartEditor(null);
      scheduledStartTriggerRef.current = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setScheduledStartEditor(null);
      scheduledStartTriggerRef.current = null;
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [scheduledStartEditor]);

  const updateLine = (rowKey: string, field: keyof EosLine, value: string) => {
    const nextValue = field === 'itemNo' ? normalizeItemNoInput(value) : value;
    const selectedLineOption = field === 'location'
      ? template?.lineOptions.find((item) => item.assembly === value)
      : undefined;

    setLines((prev) => prev.map((line) => {
      if (selectedLineOption && line.pairedAssemblyRowKey === rowKey) {
        return {
          ...line,
          location: selectedLineOption.packOff,
          lineGroup: selectedLineOption.lineGroup,
        };
      }

      if (PAIRED_SHARED_INPUT_FIELDS.has(field) && line.pairedAssemblyRowKey === rowKey) {
        return { ...line, [field]: null };
      }

      if (line.rowKey !== rowKey) return line;

      const next = { ...line, [field]: nextValue };
      if (field === 'scheduledStartTime') {
        next.scheduledStartOverridden = Boolean(nextValue);
      }
      if (selectedLineOption) {
        next.location = selectedLineOption.assembly;
        next.lineGroup = selectedLineOption.lineGroup;
      }
      return next;
    }));
    setInputVersion((version) => version + 1);
    if (field === 'itemNo') searchItems(nextValue);
  };

  const itemSuggestionsFor = (value: unknown) => {
    const query = normalizeItemNoInput(value);
    return itemOptions
      .filter((item) => !query || item.itemNo.includes(query))
      .slice(0, 50);
  };

  const selectItem = (rowKey: string, itemNo: string) => {
    updateLine(rowKey, 'itemNo', itemNo);
    setActiveItemRowKey(null);
    setItemPickerAnchor(null);
    activeItemInputRef.current = null;
  };

  const openScheduledStartEditor = (line: EosLine, element: HTMLElement) => {
    scheduledStartTriggerRef.current = element;
    setActiveItemRowKey(null);
    setItemPickerAnchor(null);
    activeItemInputRef.current = null;
    positionScheduledStartEditor(line, element);
  };

  const closeScheduledStartEditor = () => {
    setScheduledStartEditor(null);
    scheduledStartTriggerRef.current = null;
  };

  const saveScheduledStartOverride = () => {
    if (!scheduledStartEditor) return;
    updateLine(scheduledStartEditor.rowKey, 'scheduledStartTime', scheduledStartEditor.draftValue);
    closeScheduledStartEditor();
    showNotice('info', 'Scheduled start updated for this report. Save the report to record the change in Audit Trail.');
  };

  const saveReport = async (submit = false) => {
    if (!shiftId) {
      showNotice('error', 'Select a shift before saving.');
      return;
    }
    setSaving(true);
    try {
      const payload = reportPayload();
      const res = editingReportId
        ? await api.patch(`/production-eos/reports/${editingReportId}`, payload)
        : await api.post(submit ? '/production-eos/reports/submit' : '/production-eos/reports', payload);
      const report = res.data.report;
      const savedTotals = report.totals || {};
      setLines(linesWithTemplateSchedule(report.lines || lines, shiftId, template?.rows || []));
      setTotals(overallTotalsFrom(savedTotals));
      setTotalsBySection(totalsBySectionFrom(savedTotals));
      setWarnings(report.validationWarnings || []);
      showNotice('success', editingReportId ? 'Production EOS report changes saved and logged.' : submit ? 'Production EOS report submitted.' : 'Production EOS draft saved.');
      if (submit || editingReportId) {
        setSelectedReportId(report.id);
        setSelectedReport(report);
        setEditingReportId('');
        setActivePageTab('PRODUCTION');
        void loadAuditTrail(report.id);
        void loadSubmittedReports();
      }
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not save Production EOS report.');
    } finally {
      setSaving(false);
    }
  };

  const openSubmitReportTab = async () => {
    if (!reportDate || !shiftId) {
      showNotice('error', 'Select a date and Production shift before creating a Production EOS report.');
      setFabOpen(false);
      return;
    }

    const report = actionReport || await refreshFabAvailability();
    if (reportHasSectionRecords(report, activeSection)) {
      showNotice('info', `${sectionLabel(activeSection)} already has saved records for the selected date and shift. Use Edit Report.`);
      setFabOpen(false);
      return;
    }

    setEditingReportId(report?.id || '');
    if (report) {
      setSelectedReport(report);
      setLines(linesWithTemplateSchedule(report.lines || [], shiftId, template?.rows || []));
      syncNotesFromReport(report);
      const reportTotalsForEntry = report.totals || {};
      setTotals(overallTotalsFrom(reportTotalsForEntry));
      setTotalsBySection(totalsBySectionFrom(reportTotalsForEntry));
    } else {
      setLines(template?.rows || []);
      setSafetyConcerns('');
      setQualityIssues('');
      setLineNotes({ 'Line 1': '', 'Line 2': '', 'Line 3': '', 'Line 5': '' });
      setTotals({});
      setTotalsBySection(emptyTotalsBySection());
    }
    setWarnings([]);
    setActivePageTab('SUBMIT_REPORT');
    setFabOpen(false);
  };

  const cancelSubmitReport = () => {
    setEditingReportId('');
    setActivePageTab('PRODUCTION');
    setFabOpen(false);
    setScheduledStartEditor(null);
    scheduledStartTriggerRef.current = null;
    setActiveItemRowKey(null);
    setItemPickerAnchor(null);
    activeItemInputRef.current = null;
    setSectionMenuOpen(false);
    setLines(template?.rows || []);
    setTotals({});
    setTotalsBySection(emptyTotalsBySection());
    setWarnings([]);
    showNotice('info', 'Report entry canceled. No changes were saved.');
  };

  const openEditReport = async () => {
    const reportForAction = actionReport || await refreshFabAvailability();
    const reportId = reportForAction?.id;
    if (!reportId || !reportHasSectionRecords(reportForAction, activeSection)) {
      showNotice('error', `${sectionLabel(activeSection)} has no saved records for the selected date and shift. Use Submit Report first.`);
      setFabOpen(false);
      return;
    }
    try {
      const res = await api.get(`/production-eos/reports/${reportId}`);
      const report = {
        ...res.data.report,
        reportDate: dateInputFromValue(res.data.report.reportDate),
        lines: res.data.report.lines || [],
      } as LoadedReport;
      setSelectedReport(report);
      hydrateReportForEditing(report);
      showNotice('info', 'Editing existing report. Every saved change will be recorded in Audit Trail.');
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not open report for editing.');
      setFabOpen(false);
    }
  };

  const toggleFabMenu = () => {
    setFabOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) void refreshFabAvailability();
      return nextOpen;
    });
  };

  const editableClass = 'w-full min-w-[92px] rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-amber-800 dark:bg-amber-950/40 dark:text-gray-100';
  const noteTextareaClass = `${editableClass} min-h-[112px] resize-y overflow-y-auto leading-5`;
  const headerLabelClass = 'mb-0 block text-[9px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400';
  const headerFieldClass = 'h-8 w-full rounded-md border border-amber-200 bg-amber-50 px-2 text-[11px] font-medium text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-gray-100';
  const tableInputClass = 'mx-auto block h-7 w-[90%] min-w-[72px] rounded-none border-0 bg-transparent px-1 py-1 text-[12px] leading-tight text-gray-900 outline-none ring-0 focus:bg-transparent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 dark:text-gray-100';
  const calcClass = 'min-w-[72px] px-1 py-1 text-[12px] font-medium leading-tight text-gray-700 dark:text-gray-200';
  const emptyValueClass = 'text-gray-400 dark:text-gray-500';
  const tableCellClass = 'h-9 border border-gray-200 px-1.5 py-1 align-middle dark:border-gray-800';
  const editableCellClass = `${tableCellClass} bg-yellow-50 dark:bg-yellow-950/25`;
  const tableHeaderCellClass = 'h-9 whitespace-nowrap border border-blue-300 bg-blue-700 px-1.5 py-2 text-[9px] font-bold uppercase tracking-normal text-white dark:border-blue-800 dark:bg-blue-900';
  const stickyLocationHeaderClass = 'sticky left-0 z-30 bg-blue-700 shadow-[inset_-1px_0_0_#111827] dark:bg-blue-900 dark:shadow-[inset_-1px_0_0_#e5e7eb]';
  const stickyLocationCellClass = 'sticky left-0 z-20 bg-white shadow-[inset_-1px_0_0_#111827] dark:bg-gray-900 dark:shadow-[inset_-1px_0_0_#e5e7eb]';
  const limitLeftClass = '!border-l-black dark:!border-l-gray-200';
  const limitRightClass = '!border-r-black dark:!border-r-gray-200';
  const limitTopClass = 'border-t-black dark:border-t-gray-200';
  const limitBottomClass = 'border-b-black dark:border-b-gray-200';
  const activeItemLine = activeItemRowKey ? lines.find((line) => line.rowKey === activeItemRowKey) : null;
  const activeItemSuggestions = activeItemLine ? itemSuggestionsFor(activeItemLine.itemNo) : [];

  return (
    <ProtectedRoute>
      <div className="flex h-full min-h-0 flex-col bg-gray-50 dark:bg-gray-950">
        {(notice || warnings.length > 0) && (
          <div className="pointer-events-none fixed right-4 top-5 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
            {notice && (
              <div className="production-eos-toast pointer-events-auto rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-start gap-2">
                  {notice.type === 'success' ? <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600" /> : notice.type === 'error' ? <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" /> : <ClipboardList className="mt-0.5 h-5 w-5 text-blue-600" />}
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{notice.message}</p>
                </div>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="production-eos-toast pointer-events-auto rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-xl dark:border-amber-800 dark:bg-amber-950/95">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-amber-950 dark:text-amber-100">Check report details</p>
                    <div className="mt-1 space-y-1 text-sm font-medium text-amber-900 dark:text-amber-100">
                      {warnings.map((warning) => <p key={warning}>{warning}</p>)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWarnings([])}
                    className="rounded-md p-1 text-amber-700 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
                    aria-label="Dismiss report detail warning"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activePageTab !== 'DASHBOARD' && (
        <div className="shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="px-4 py-1.5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
              <div className="flex min-w-0 items-center gap-2 xl:w-[280px]">
                <Factory className="h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold leading-5 text-gray-900 dark:text-white">Production EOS</h1>
                  <p className="truncate text-[11px] leading-4 text-gray-600 dark:text-gray-400">Production end-of-shift report with backend-owned calculations.</p>
                </div>
              </div>

              <div className={`grid w-full gap-1.5 xl:w-auto xl:items-end ${activePageTab === 'SUBMIT_REPORT' ? 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[124px_116px_190px_146px_94px_86px_78px]' : activePageTab === 'PRODUCTION' ? 'sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-[132px_126px_190px_140px_190px]' : 'sm:grid-cols-3 xl:grid-cols-[150px_160px_200px]'}`}>
                <label className="block">
                  <span className={`${headerLabelClass} flex items-center gap-1`}>
                    <Calendar className="h-3 w-3" /> Date
                </span>
                <DashDatePicker
                  value={reportDate}
                  onChange={(value) => {
                    setReportDate(value);
                    setInputVersion((version) => version + 1);
                  }}
                  ariaLabel="Production EOS report date"
                  variant="compact"
                  className="!h-8 !min-h-8 border-amber-200 bg-amber-50 text-[11px] dark:border-amber-800 dark:bg-amber-950/40"
                />
              </label>
              <div className="block">
                <span className={headerLabelClass}>Day</span>
                <div
                  className={`${headerFieldClass} flex items-center text-left`}
                  aria-label="Report day derived from selected date"
                >
                  <span className={`min-w-0 truncate ${dayOfWeek ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                    {dayOfWeek || 'Select date'}
                  </span>
                </div>
              </div>
              <div className="block" ref={shiftMenuRef}>
                <span className={headerLabelClass}>Shift</span>
                <div className="relative">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={shiftMenuOpen}
                    onClick={() => setShiftMenuOpen((open) => !open)}
                    className={`${headerFieldClass} flex items-center justify-between gap-2 text-left`}
                  >
                    <span className={`min-w-0 truncate ${currentShift ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                      {currentShift ? currentShift.name : 'Select shift'}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${shiftMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {shiftMenuOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[260px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900">
                      <div className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" />
                      <div className="max-h-[280px] overflow-y-auto py-1" role="listbox" aria-label="Select shift">
                        <button
                          type="button"
                          role="option"
                          aria-selected={!shiftId}
                          onClick={() => {
                            setShiftId('');
                            setShiftMenuOpen(false);
                            setInputVersion((version) => version + 1);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${!shiftId ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800'}`}
                        >
                          <span className="font-semibold">Select shift</span>
                          {!shiftId && <Check className="h-4 w-4" />}
                        </button>
                        {orderedShifts.map((shift) => {
                          const selected = shift.id === shiftId;
                          return (
                            <button
                              key={shift.id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => {
                                setShiftId(shift.id);
                                setShiftMenuOpen(false);
                                setInputVersion((version) => version + 1);
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${selected ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200' : 'text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800'}`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">{shift.name}</span>
                                <span className="mt-0.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                                  {shift.startTime} - {shift.endTime}
                                </span>
                              </span>
                              {selected && <Check className="h-4 w-4 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {showSectionSelector && (
                <>
                  <div className="block" ref={sectionMenuRef}>
                    <span className={headerLabelClass}>Report Section</span>
                    <div className="relative">
                      <button
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={sectionMenuOpen}
                        onClick={() => setSectionMenuOpen((open) => !open)}
                        className={`${headerFieldClass} flex items-center justify-between gap-2 text-left`}
                      >
                        <span className="min-w-0 truncate">
                          {SECTION_OPTIONS.find((section) => section.key === activeSection)?.label || 'Select section'}
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${sectionMenuOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {sectionMenuOpen && (
                        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[200px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900">
                          <div className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" />
                          <div className="py-1" role="listbox" aria-label="Select report section">
                            {SECTION_OPTIONS.map((section) => {
                              const selected = activeSection === section.key;
                              return (
                                <button
                                  key={section.key}
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onClick={() => {
                                    setActiveSection(section.key);
                                    setSectionMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${selected ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200' : 'text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800'}`}
                                >
                                  <span className="font-semibold">{section.label}</span>
                                  {selected && <Check className="h-4 w-4 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {isSubmitMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => runCalculation(false)}
                        disabled={calculating}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 text-[11px] font-bold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                      >
                        {calculating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calculator className="h-3 w-3" />}
                        Recalculate
                      </button>
                      <button
                        type="button"
                        onClick={cancelSubmitReport}
                        disabled={saving}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-[11px] font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-gray-950 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveReport(true)}
                        disabled={saving}
                        aria-label={isEditingReport ? 'Save edited Production EOS report' : 'Save Production EOS report'}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Save
                      </button>
                    </>
                  )}
                </>
              )}
              {activePageTab === 'PRODUCTION' && (
                <div
                  className={`flex h-9 min-w-0 items-center justify-center rounded-md border px-3 text-[12px] font-bold shadow-[0_8px_14px_rgba(16,185,129,0.16),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ${productionReporterName ? 'border-emerald-200 bg-emerald-50 text-emerald-900 ring-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-900/50' : 'border-emerald-100 bg-emerald-50/70 text-emerald-700/60 ring-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200/50 dark:ring-emerald-950'}`}
                  title={`Reported by ${productionReporterName || 'None'}`}
                >
                  <span className="truncate">Reported by {productionReporterName || 'None'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-4 lg:px-5">
          {loading ? (
            <div className="flex min-h-[360px] flex-1 items-center justify-center">
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                Loading Production EOS...
              </div>
            </div>
          ) : (
            <>
              {activePageTab === 'DASHBOARD' && (
                <section
                  id="production-eos-panel-dashboard"
                  role="tabpanel"
                  className="production-eos-tab-panel space-y-3"
                >
                  {dashboardLoading && !dashboard ? (
                    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
                      Loading dashboard...
                    </div>
                  ) : !dashboard || !dashboard.summary.reportsCount ? (
                    <div className="relative rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
                      <div className="absolute right-3 top-3">
                        {dashboardScopeAction('dashboard-empty')}
                      </div>
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
                        <BarChart3 className="h-6 w-6" />
                      </div>
                      <h3 className="mt-3 text-base font-black text-gray-950 dark:text-white">No Production EOS dashboard data yet</h3>
                      <p className="mx-auto mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-400">
                        The dashboard will populate from saved Production EOS reports for the selected date window and shift.
                      </p>
                    </div>
                  ) : (
                    <>
                      {renderDashboardGaugeGrid('dashboard-gauge')}

                      <div className="grid gap-3 xl:grid-cols-2">
                        <DashboardPanel
                          title="Production Trend"
                          subtitle={`${dashboardScopeDescription} combined shift pounds with target threshold and accurate trend`}
                          action={dashboardChartAction('production-trend', 'production-trend')}
                        >
                          <div className="h-[215px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={dashboardTrendChart} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis
                                  yAxisId="left"
                                  domain={PRODUCTION_TREND_LBS_DOMAIN}
                                  ticks={PRODUCTION_TREND_LBS_TICKS}
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={(value) => formatCompactNumber(value, 0)}
                                  axisLine={false}
                                  tickLine={false}
                                  allowDataOverflow
                                />
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend
                                  wrapperStyle={{ fontSize: 11 }}
                                  payload={[
                                    { value: 'Combined shift lbs', type: 'square', color: '#2563eb' },
                                    { value: 'Production trend', type: 'line', color: '#f97316' },
                                    ...(lbsProducedTarget !== null ? [{ value: `Daily target (${formatCompactNumber(lbsProducedTarget, 1)})`, type: 'line' as const, color: '#60a5fa' }] : []),
                                  ]}
                                />
                                {lbsProducedTarget !== null && (
                                  <ReferenceArea
                                    yAxisId="left"
                                    y1={PRODUCTION_TREND_LBS_DOMAIN[0]}
                                    y2={Math.min(PRODUCTION_TREND_LBS_DOMAIN[1], Math.max(PRODUCTION_TREND_LBS_DOMAIN[0], lbsProducedTarget))}
                                    fill="#fee2e2"
                                    fillOpacity={0.28}
                                    ifOverflow="extendDomain"
                                  />
                                )}
                                <Bar yAxisId="left" dataKey="lbsProduced" name="Combined shift lbs" radius={[5, 5, 0, 0]} maxBarSize={42} animationDuration={1000} animationEasing="ease-out">
                                  {dashboardTrendChart.map((entry) => {
                                    const lbsValue = Number(entry.lbsProduced);
                                    const isZero = !Number.isFinite(lbsValue) || lbsValue <= 0;
                                    const isOnTarget = lbsProducedTarget !== null && lbsValue >= lbsProducedTarget;
                                    return (
                                      <Cell
                                        key={`production-trend-bar-${entry.date}`}
                                        fill={isZero ? '#d1d5db' : isOnTarget ? '#22c55e' : '#ef4444'}
                                        fillOpacity={isZero ? 0.55 : 0.92}
                                      />
                                    );
                                  })}
                                  <LabelList
                                    dataKey="lbsProduced"
                                    position="top"
                                    formatter={(value: unknown) => Number(value || 0) > 0 ? formatCompactNumber(value, 1) : ''}
                                    style={{ fontSize: 10, fontWeight: 800, fill: '#1f2937' }}
                                  />
                                </Bar>
                                <Line
                                  yAxisId="left"
                                  type="monotone"
                                  dataKey="trendLbsProduced"
                                  name="Production trend"
                                  stroke="#f97316"
                                  strokeWidth={2.35}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  dot={{ r: 3.5, strokeWidth: 1.75, stroke: '#ffffff', fill: '#f97316' }}
                                  activeDot={{ r: 5, fill: '#ffffff', stroke: '#f97316', strokeWidth: 2 }}
                                  connectNulls={false}
                                  animationDuration={1200}
                                  animationEasing="ease-in-out"
                                />
                                {lbsProducedTarget !== null && (
                                  <ReferenceLine
                                    yAxisId="left"
                                    y={lbsProducedTarget}
                                    stroke="#60a5fa"
                                    strokeWidth={2.25}
                                    strokeDasharray="6 4"
                                    ifOverflow="extendDomain"
                                    label={{ value: formatCompactNumber(lbsProducedTarget, 1), position: 'insideRight', fill: '#2563eb', fontSize: 10, fontWeight: 900 }}
                                  />
                                )}
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </DashboardPanel>

                        <DashboardPanel title="Item Output Mix" subtitle="Highest output items in the selected period" action={dashboardChartAction('item-output-mix', 'item-output-mix')}>
                          <div className="h-[215px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={(dashboard.itemPerformance || []).slice(0, 10)} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="itemOutputGradient" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.45} />
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="itemNo" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Area type="monotone" dataKey="lbsProduced" name="Lbs produced" stroke="#2563eb" strokeWidth={2.5} fill="url(#itemOutputGradient)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </DashboardPanel>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <DashboardPanel
                          title="Combined Attainment Trend"
                          subtitle={`${dashboardScopeDescription} combined first and second shift attainment percentage`}
                          action={dashboardChartAction('combined-attainment-trend', 'combined-attainment-trend')}
                        >
                          <div className="h-[215px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={dashboardTrendChart} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis
                                  domain={[0, combinedAttainmentPctYMax]}
                                  tick={{ fontSize: 10 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => `${formatNumber(value, 0)}%`}
                                  width={42}
                                />
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend
                                  wrapperStyle={{ fontSize: 10, fontWeight: 800 }}
                                  payload={[
                                    { value: 'Combined attainment %', type: 'square', color: '#22c55e' },
                                    { value: 'Attainment trend', type: 'line', color: '#f97316' },
                                    { value: `Attainment target (${formatNumber(attainmentTargetPct ?? 100, 1)}%)`, type: 'line' as const, color: '#60a5fa' },
                                  ]}
                                />
                                <ReferenceArea
                                  y1={0}
                                  y2={attainmentTargetPct ?? 100}
                                  fill="#fecaca"
                                  fillOpacity={0.24}
                                  ifOverflow="extendDomain"
                                />
                                <ReferenceLine
                                  y={attainmentTargetPct ?? 100}
                                  stroke="#60a5fa"
                                  strokeWidth={2.35}
                                  strokeDasharray="6 4"
                                  ifOverflow="extendDomain"
                                  label={{ value: `${formatNumber(attainmentTargetPct ?? 100, 1)}%`, position: 'insideRight', fill: '#2563eb', fontSize: 9, fontWeight: 900 }}
                                />
                                <Bar dataKey="attainmentPctValue" name="Combined attainment %" radius={[5, 5, 0, 0]} maxBarSize={42} isAnimationActive animationDuration={900} animationEasing="ease-out">
                                  {dashboardTrendChart.map((entry) => {
                                    const value = Number(entry.attainmentPctValue);
                                    const hasOutput = Number(entry.lbsProduced) > 0 || Number(entry.casesProduced) > 0;
                                    const onTarget = value >= (attainmentTargetPct ?? 100);
                                    return (
                                      <Cell
                                        key={`combined-attainment-${entry.date}`}
                                        fill={!hasOutput ? '#d1d5db' : onTarget ? '#22c55e' : '#ef4444'}
                                        fillOpacity={!hasOutput ? 0.55 : 0.92}
                                      />
                                    );
                                  })}
                                  <LabelList
                                    dataKey="attainmentPctValue"
                                    position="top"
                                    formatter={(value: unknown) => Number(value || 0) > 0 ? `${formatNumber(value, 1)}%` : ''}
                                    style={{ fontSize: 9, fontWeight: 900, fill: '#1f2937' }}
                                  />
                                </Bar>
                                <Line
                                  type="monotone"
                                  dataKey="attainmentPctValue"
                                  name="Attainment trend"
                                  stroke="#f97316"
                                  strokeWidth={2.35}
                                  dot={{ r: 3.5, strokeWidth: 1.75, stroke: '#ffffff', fill: '#f97316' }}
                                  activeDot={{ r: 5, fill: '#ffffff', stroke: '#f97316', strokeWidth: 2 }}
                                  connectNulls={false}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </DashboardPanel>

                        <DashboardPanel
                          title="Combined Waste Trend"
                          subtitle={`${dashboardScopeDescription} combined first and second shift waste percentage`}
                          action={dashboardChartAction('combined-waste-trend', 'combined-waste-trend')}
                        >
                          <div className="h-[215px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={dashboardTrendChart} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#fee2e2" />
                                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis
                                  domain={[0, combinedWastePctYMax]}
                                  tick={{ fontSize: 10 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(value) => formatWastePctPoint(value)}
                                  width={42}
                                />
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend
                                  wrapperStyle={{ fontSize: 10, fontWeight: 800 }}
                                  payload={[
                                    { value: 'Combined waste %', type: 'square', color: '#22c55e' },
                                    { value: 'Waste trend', type: 'line', color: '#f97316' },
                                    ...(wasteTargetPct !== null ? [{ value: `Waste target (${formatWastePctPoint(wasteTargetPct)})`, type: 'line' as const, color: '#60a5fa' }] : []),
                                  ]}
                                />
                                {wasteTargetPct !== null && (
                                  <>
                                    <ReferenceArea
                                      y1={wasteTargetPct}
                                      y2={combinedWastePctYMax}
                                      fill="#fecaca"
                                      fillOpacity={0.24}
                                      ifOverflow="extendDomain"
                                    />
                                    <ReferenceLine
                                      y={wasteTargetPct}
                                      stroke="#60a5fa"
                                      strokeWidth={2.35}
                                      strokeDasharray="6 4"
                                      ifOverflow="extendDomain"
                                      label={{ value: formatWastePctPoint(wasteTargetPct), position: 'insideRight', fill: '#2563eb', fontSize: 9, fontWeight: 900 }}
                                    />
                                  </>
                                )}
                                <Bar dataKey="wastePctValue" name="Combined waste %" radius={[5, 5, 0, 0]} maxBarSize={42} isAnimationActive animationDuration={900} animationEasing="ease-out">
                                  {dashboardTrendChart.map((entry) => {
                                    const value = Number(entry.wastePctValue);
                                    const hasOutput = Number(entry.lbsProduced) > 0 || Number(entry.casesProduced) > 0;
                                    const onTarget = wasteTargetPct !== null && value <= wasteTargetPct;
                                    return (
                                      <Cell
                                        key={`combined-waste-${entry.date}`}
                                        fill={!hasOutput ? '#d1d5db' : onTarget ? '#22c55e' : '#ef4444'}
                                        fillOpacity={!hasOutput ? 0.55 : 0.92}
                                      />
                                    );
                                  })}
                                  <LabelList
                                    dataKey="wastePctValue"
                                    position="top"
                                    formatter={(value: unknown) => Number(value || 0) > 0 ? formatWastePctPoint(value) : ''}
                                    style={{ fontSize: 9, fontWeight: 900, fill: '#1f2937' }}
                                  />
                                </Bar>
                                <Line
                                  type="monotone"
                                  dataKey="wastePctValue"
                                  name="Waste trend"
                                  stroke="#f97316"
                                  strokeWidth={2.35}
                                  dot={{ r: 3.5, strokeWidth: 1.75, stroke: '#ffffff', fill: '#f97316' }}
                                  activeDot={{ r: 5, fill: '#ffffff', stroke: '#f97316', strokeWidth: 2 }}
                                  connectNulls={false}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </DashboardPanel>

                        <div className="mt-1 flex h-8 items-center border-t border-blue-100 pt-2 text-[11px] font-black uppercase tracking-[0.08em] text-blue-700 dark:border-blue-900 dark:text-blue-300">
                          Attainment by Line
                        </div>
                        <div className="mt-1 flex h-8 items-center border-t border-red-100 pt-2 text-[11px] font-black uppercase tracking-[0.08em] text-red-700 dark:border-red-900 dark:text-red-300">
                          Waste by Line
                        </div>

                        {dashboardLineAttainmentCharts.map((attainmentChart) => {
                          const wasteChart = dashboardLineWasteCharts.find((chart) => chart.lineNumber === attainmentChart.lineNumber);

                          return (
                            <div key={`line-metrics-${attainmentChart.lineNumber}`} className="contents">
                              <DashboardPanel
                                title={attainmentChart.title}
                                subtitle={`${dashboardScopeDescription} first and second shift attainment for Line ${attainmentChart.lineNumber}`}
                                action={dashboardChartAction(`line-${attainmentChart.lineNumber}-attainment`, `line-${attainmentChart.lineNumber}-attainment`)}
                              >
                                <div className="h-[215px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={attainmentChart.data} barGap={1} barCategoryGap="28%" margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                      <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                      <YAxis
                                        domain={[0, 150]}
                                        ticks={[0, 50, 100, 150]}
                                        tick={{ fontSize: 10 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                                        width={42}
                                      />
                                      <Tooltip content={<DashboardTooltip />} />
                                      <Legend wrapperStyle={{ fontSize: 10, fontWeight: 800 }} />
                                      <ReferenceArea
                                        y1={0}
                                        y2={attainmentTargetPct ?? 100}
                                        fill="#fecaca"
                                        fillOpacity={0.24}
                                        ifOverflow="extendDomain"
                                      />
                                      <ReferenceLine
                                        y={attainmentTargetPct ?? 100}
                                        stroke="#60a5fa"
                                        strokeDasharray="6 4"
                                        ifOverflow="extendDomain"
                                        label={{ value: `${formatNumber(attainmentTargetPct ?? 100, 1)}%`, position: 'insideRight', fill: '#2563eb', fontSize: 9, fontWeight: 900 }}
                                      />
                                      <Bar dataKey="firstShiftAttainmentPct" name="First shift attainment" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive animationDuration={900} animationEasing="ease-out">
                                        <LabelList
                                          dataKey="firstShiftAttainmentPct"
                                          position="top"
                                          formatter={(value: unknown) => Number(value || 0) > 0 ? `${formatNumber(value, 1)}%` : ''}
                                          style={{ fontSize: 9, fontWeight: 900, fill: '#1d4ed8' }}
                                        />
                                      </Bar>
                                      <Bar dataKey="secondShiftAttainmentPct" name="Second shift attainment" fill="#f97316" radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive animationDuration={900} animationEasing="ease-out">
                                        <LabelList
                                          dataKey="secondShiftAttainmentPct"
                                          position="top"
                                          formatter={(value: unknown) => Number(value || 0) > 0 ? `${formatNumber(value, 1)}%` : ''}
                                          style={{ fontSize: 9, fontWeight: 900, fill: '#c2410c' }}
                                        />
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </DashboardPanel>

                              {wasteChart && (
                                <DashboardPanel
                                  title={wasteChart.title}
                                  subtitle={`${dashboardScopeDescription} first and second shift waste percent for Line ${wasteChart.lineNumber}`}
                                  action={dashboardChartAction(`line-${wasteChart.lineNumber}-waste`, `line-${wasteChart.lineNumber}-waste`)}
                                >
                                  <div className="h-[215px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={wasteChart.data} barGap={1} barCategoryGap="28%" margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#fee2e2" />
                                        <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis
                                          domain={[0, wasteChart.yMax]}
                                          tick={{ fontSize: 10 }}
                                          axisLine={false}
                                          tickLine={false}
                                          tickFormatter={(value) => formatWastePctPoint(value)}
                                          width={42}
                                        />
                                        <Tooltip content={<DashboardTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 800 }} />
                                        {wasteChart.wasteTargetPct !== null && (
                                          <>
                                            <ReferenceArea
                                              y1={wasteChart.wasteTargetPct}
                                              y2={wasteChart.yMax}
                                              fill="#fecaca"
                                              fillOpacity={0.24}
                                              ifOverflow="extendDomain"
                                            />
                                            <ReferenceLine
                                              y={wasteChart.wasteTargetPct}
                                              stroke="#60a5fa"
                                              strokeDasharray="6 4"
                                              ifOverflow="extendDomain"
                                              label={{ value: formatWastePctPoint(wasteChart.wasteTargetPct), position: 'insideRight', fill: '#2563eb', fontSize: 9, fontWeight: 900 }}
                                            />
                                          </>
                                        )}
                                        <Bar dataKey="firstShiftWastePct" name="First shift waste %" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive animationDuration={900} animationEasing="ease-out">
                                          <LabelList
                                            dataKey="firstShiftWastePct"
                                            position="top"
                                            formatter={(value: unknown) => Number(value || 0) > 0 ? formatWastePctPoint(value) : ''}
                                            style={{ fontSize: 9, fontWeight: 900, fill: '#1d4ed8' }}
                                          />
                                        </Bar>
                                        <Bar dataKey="secondShiftWastePct" name="Second shift waste %" fill="#f97316" radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive animationDuration={900} animationEasing="ease-out">
                                          <LabelList
                                            dataKey="secondShiftWastePct"
                                            position="top"
                                            formatter={(value: unknown) => Number(value || 0) > 0 ? formatWastePctPoint(value) : ''}
                                            style={{ fontSize: 9, fontWeight: 900, fill: '#c2410c' }}
                                          />
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </DashboardPanel>
                              )}
                            </div>
                          );
                        })}

                        <DashboardPanel
                          title="Late Start by Line"
                          subtitle={`${dashboardScopeDescription} cumulative late-start minutes by line and shift`}
                          action={dashboardScopeAction('late-start-by-line')}
                          className="xl:col-span-2"
                        >
                          <div className="grid gap-3 lg:grid-cols-2">
                            {dashboardLateStartPieCharts.map((chart) => (
                              <div key={chart.key} className="rounded-md border border-gray-200 bg-gradient-to-br from-white via-white to-blue-50/40 p-3 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
                                <div className="mb-2 flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h4 className="text-[12px] font-black text-gray-950 dark:text-white">{chart.title}</h4>
                                    <p className="mt-0.5 text-[10px] font-bold text-gray-500 dark:text-gray-400">Dates: {chart.datesLabel}</p>
                                  </div>
                                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
                                    {formatNumber(chart.total, 0)} min
                                  </span>
                                </div>
                                <div className="grid min-h-[190px] gap-2 md:grid-cols-[1.15fr_0.85fr]">
                                  <div className="relative h-[180px]">
                                    {chart.total > 0 ? (
                                      <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                          <Tooltip content={<DashboardPieTooltip valueSuffix=" min" />} />
                                          <Pie
                                            data={chart.data}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={76}
                                            paddingAngle={1}
                                            stroke="#ffffff"
                                            strokeWidth={2}
                                            isAnimationActive
                                            animationDuration={900}
                                            label={DashboardPiePercentageLabel}
                                            labelLine={false}
                                          >
                                            {chart.data.map((entry) => (
                                              <Cell key={`${chart.key}-${entry.name}`} fill={entry.color} />
                                            ))}
                                          </Pie>
                                        </PieChart>
                                      </ResponsiveContainer>
                                    ) : (
                                      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-gray-300 bg-white text-center text-[11px] font-bold text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                        No late-start minutes recorded
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col justify-center gap-2">
                                    {([1, 2, 3, 5]).map((lineNumber, index) => {
                                      const slice = chart.data.find((item) => item.name === `Line ${lineNumber}`);
                                      const minutes = slice?.value || 0;
                                      const percent = chart.total > 0 ? (minutes / chart.total) * 100 : 0;
                                      const color = DASHBOARD_LINE_COLORS[index % DASHBOARD_LINE_COLORS.length];
                                      return (
                                        <div key={`${chart.key}-legend-${lineNumber}`} className="flex items-center justify-between gap-2 rounded-sm border border-gray-100 bg-white/90 px-2 py-1.5 text-[11px] font-bold shadow-sm dark:border-gray-800 dark:bg-gray-900/90">
                                          <span className="flex min-w-0 items-center gap-2 text-gray-700 dark:text-gray-200">
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                            <span className="truncate">Line {lineNumber}</span>
                                          </span>
                                          <span className="shrink-0 text-gray-950 dark:text-white">
                                            {formatNumber(minutes, 0)} min
                                            {chart.total > 0 && <span className="ml-1 text-gray-400">({formatNumber(percent, 0)}%)</span>}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </DashboardPanel>

                      </div>
                    </>
                  )}
                </section>
              )}

              {activePageTab === 'AUDIT_TRAIL' && (
                <section
                  id="production-eos-panel-audit_trail"
                  role="tabpanel"
                  className="production-eos-tab-panel rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <History className="h-5 w-5 text-blue-600" />
                        Audit Trail
                      </h2>
                      <p className="mt-1 truncate text-sm text-gray-600 dark:text-gray-400">
                        {selectedReport
                          ? `${dateInputFromValue(selectedReport.reportDate)} • ${selectedReport.shiftNameSnapshot} • ${selectedReport.status} • All sections`
                          : 'Select a date and Production shift to review Production, Changeovers, Rework, and Notes together.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadAuditTrailForSelection()}
                      disabled={!reportDate || !shiftId || auditLoading}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-[12px] font-bold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                    >
                      {auditLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                      Refresh
                    </button>
                  </div>

                  {!selectedReportId ? (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
                      No EOS report exists for the selected date and shift yet.
                    </div>
                  ) : auditLoading ? (
                    <div className="flex min-h-[220px] items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
                      Loading audit trail...
                    </div>
                  ) : auditTrail.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
                      No audit entries have been recorded for this report yet.
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute bottom-3 left-[19px] top-3 w-px bg-gray-200 dark:bg-gray-800" aria-hidden="true" />
                      {auditTrail.map((entry) => {
                        const changes = entry.changes || {};
                        const saveOnlyEvent = SAVE_ONLY_AUDIT_EVENTS.has(String(changes.eventType || ''));
                        const reportChanges = saveOnlyEvent ? [] : visibleAuditFieldChanges(changes.reportChanges || [], REPORT_AUDIT_DISPLAY_FIELDS);
                        const lineChanges = saveOnlyEvent ? [] : visibleAuditRowChanges(changes.lineChanges || [], LINE_AUDIT_DISPLAY_FIELDS);
                        const noteChanges = saveOnlyEvent ? [] : visibleAuditRowChanges(changes.noteChanges || [], NOTE_AUDIT_DISPLAY_FIELDS);
                        const lineFieldChangeCount = lineChanges.reduce((total: number, row: any) => total + row.fields.length, 0);
                        const noteFieldChangeCount = noteChanges.reduce((total: number, row: any) => total + row.fields.length, 0);
                        const visibleFieldChangeCount = reportChanges.length + lineFieldChangeCount + noteFieldChangeCount;
                        const changeRows = auditChangeRows(reportChanges, lineChanges, noteChanges);
                        const actorProfilePicture = auditActorProfilePicture(entry);
                        const isDenseAuditEntry = changeRows.length > AUDIT_COLLAPSE_ROW_THRESHOLD;
                        const isAuditEntryExpanded = !isDenseAuditEntry || expandedAuditEntryIds.has(entry.id);
                        const showAuditPointList = changeRows.length > 0 && changeRows.length <= AUDIT_COLLAPSE_ROW_THRESHOLD;
                        return (
                          <article key={entry.id} className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-3 border-b border-gray-100 py-3 last:border-b-0 dark:border-gray-800">
                            <div className="relative z-10 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white bg-blue-100 text-[12px] font-black text-blue-700 shadow-sm ring-2 ring-white dark:border-gray-900 dark:bg-blue-950 dark:text-blue-200 dark:ring-gray-900">
                              {actorProfilePicture ? (
                                <img src={actorProfilePicture} alt={auditActorName(entry)} className="h-full w-full object-cover" />
                              ) : (
                                <span>{auditActorInitials(entry)}</span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <h3 className="text-[13px] font-bold text-gray-950 dark:text-gray-50">{changes.eventLabel || entry.action}</h3>
                                    <span className="text-[12px] text-gray-400">by</span>
                                    <span className="text-[12px] font-bold text-gray-700 dark:text-gray-200">{auditActorName(entry)}</span>
                                  </div>
                                  <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{formatDateTime(entry.createdAt)}</p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-1.5 text-[11px] font-bold">
                                  {visibleFieldChangeCount > 0 && (
                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-950 dark:text-blue-200">{visibleFieldChangeCount} fields</span>
                                  )}
                                  {lineChanges.length > 0 && (
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">{lineChanges.length} lines</span>
                                  )}
                                  {noteChanges.length > 0 && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-200">{noteChanges.length} notes</span>
                                  )}
                                  {isDenseAuditEntry && (
                                    <button
                                      type="button"
                                      onClick={() => toggleAuditEntry(entry.id)}
                                      aria-expanded={isAuditEntryExpanded}
                                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-700 dark:hover:text-blue-200"
                                    >
                                      <ChevronDown className={`h-3 w-3 transition-transform ${isAuditEntryExpanded ? 'rotate-180' : ''}`} />
                                      {isAuditEntryExpanded ? 'Collapse' : 'Details'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {showAuditPointList ? (
                                <ul className="mt-2 space-y-1.5 text-[12px] text-gray-700 dark:text-gray-200">
                                  {changeRows.map((change) => (
                                    <li key={change.key} className="flex gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900">
                                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                                      <span className="min-w-0 break-words">
                                        {change.sectionLabel && (
                                          <>
                                            <span className="mr-1 inline-flex rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-black text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/70">{change.sectionLabel}</span>
                                          </>
                                        )}
                                        <span className="font-bold text-gray-950 dark:text-gray-50">{change.area}</span>
                                        <span> {change.field} changed from </span>
                                        <span className="inline-flex rounded bg-yellow-100 px-1.5 py-0.5 font-black text-yellow-900 ring-1 ring-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-100 dark:ring-yellow-800/70">{formatAuditDisplayValue(change.fieldKey, change.previousValue)}</span>
                                        <span> to </span>
                                        <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 font-black text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/70">{formatAuditDisplayValue(change.fieldKey, change.currentValue)}</span>
                                        <span>.</span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : changeRows.length > 0 && isAuditEntryExpanded ? (
                                <div className="mt-2 overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
                                  <div className="grid grid-cols-[minmax(92px,0.55fr)_minmax(110px,0.75fr)_minmax(100px,0.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] bg-gray-50 text-[10px] font-bold uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                    <div className="px-3 py-1.5">Section</div>
                                    <div className="px-3 py-1.5">Area</div>
                                    <div className="px-3 py-1.5">Field</div>
                                    <div className="px-3 py-1.5">Previous</div>
                                    <div className="px-3 py-1.5">Changed</div>
                                  </div>
                                  <div className="divide-y divide-gray-100 text-[12px] dark:divide-gray-800">
                                    {changeRows.map((change) => (
                                      <div key={change.key} className="grid grid-cols-[minmax(92px,0.55fr)_minmax(110px,0.75fr)_minmax(100px,0.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] bg-white dark:bg-gray-950">
                                        <div className="break-words px-3 py-2 font-bold text-blue-700 dark:text-blue-200">{change.sectionLabel || 'Report'}</div>
                                        <div className="break-words px-3 py-2 font-semibold text-gray-700 dark:text-gray-200">{change.area}</div>
                                        <div className="break-words px-3 py-2 text-gray-600 dark:text-gray-300">{change.field}</div>
                                        <div className="break-words bg-yellow-50 px-3 py-2 font-bold text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-100">{formatAuditDisplayValue(change.fieldKey, change.previousValue)}</div>
                                        <div className="break-words bg-emerald-50 px-3 py-2 font-bold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">{formatAuditDisplayValue(change.fieldKey, change.currentValue)}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : changeRows.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => toggleAuditEntry(entry.id)}
                                  className="mt-2 w-full rounded-md border border-blue-100 bg-blue-50/70 px-3 py-2 text-left text-[12px] font-semibold text-blue-800 transition hover:border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50"
                                >
                                  {visibleFieldChangeCount} changed fields are collapsed. Expand to review previous and changed values.
                                </button>
                              ) : (
                                <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                                  {auditNoDetailText(entry)}
                                </p>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {activePageTab === 'NOTES' && (
                <section
                  id="production-eos-panel-notes"
                  role="tabpanel"
                  className="production-eos-tab-panel rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Downtime and Shift Notes
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Safety, quality, and line notes save automatically for the selected date and shift.</p>
                    </div>
                    <div className={`inline-flex h-8 items-center rounded-md border px-3 text-[12px] font-bold shadow-sm ${
                      notesSaveStatus === 'saving'
                        ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                        : notesSaveStatus === 'error'
                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                    }`}>
                      {notesSaveStatus === 'saving' ? 'Saving notes...' : notesSaveStatus === 'error' ? 'Notes not saved' : notesSaveStatus === 'saved' ? 'Notes saved' : 'Auto-save ready'}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Safety Concerns / Incidents</span>
                      <textarea
                        ref={setNoteTextareaRef('safetyConcerns')}
                        value={safetyConcerns}
                        onChange={(event) => {
                          notesDirty.current = true;
                          setSafetyConcerns(event.target.value);
                          resizeNoteTextarea(event.currentTarget);
                        }}
                        rows={3}
                        className={noteTextareaClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">Quality Issues / Holds</span>
                      <textarea
                        ref={setNoteTextareaRef('qualityIssues')}
                        value={qualityIssues}
                        onChange={(event) => {
                          notesDirty.current = true;
                          setQualityIssues(event.target.value);
                          resizeNoteTextarea(event.currentTarget);
                        }}
                        rows={3}
                        className={noteTextareaClass}
                      />
                    </label>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {NOTE_LINES.map((lineGroup) => (
                      <label key={lineGroup} className="block">
                        <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">{lineGroup} Notes</span>
                        <textarea
                          ref={setNoteTextareaRef(`lineNotes-${lineGroup}`)}
                          value={lineNotes[lineGroup] || ''}
                          onChange={(event) => {
                            notesDirty.current = true;
                            setLineNotes((prev) => ({ ...prev, [lineGroup]: event.target.value }));
                            resizeNoteTextarea(event.currentTarget);
                          }}
                          rows={3}
                          className={noteTextareaClass}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {(activePageTab === 'PRODUCTION' || activePageTab === 'SUBMIT_REPORT') && (
                <>
                  <div
                    key={`${activePageTab}-${tableSection}-${selectedReportId || 'entry'}`}
                    id={`production-eos-panel-${activePageTab.toLowerCase()}`}
                    role="tabpanel"
                    className="production-eos-tab-panel shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
                  >
                <div className="overflow-x-auto overflow-y-hidden">
                  <table className="table-fixed border-collapse text-xs" style={{ width: EOS_TABLE_MIN_WIDTH }}>
                    <colgroup>
                      {EOS_TABLE_COLUMNS.map((column) => <col key={column.key} style={{ width: column.width }} />)}
                    </colgroup>
                    <thead className="bg-gray-100 text-[10px] uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      <tr>
                        <th className={`${tableHeaderCellClass} ${stickyLocationHeaderClass} ${limitTopClass} ${limitBottomClass} ${limitLeftClass} ${limitRightClass} text-left`}>Location</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} ${limitLeftClass} text-left`}>Item No.</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-left`}>Description</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>Cs Scheduled</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>Cs Produced</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>Lbs Scheduled</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>Lbs Produced</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} ${limitRightClass} text-right`}>Attainment</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-left`}>Scheduled Start</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-left`}>Start</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-left`}>End</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>Total Min</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} ${limitRightClass} text-right`}>Late Start</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>Waste lbs</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>Waste %</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>OEE</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>HC STD</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>HC Actual</th>
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} ${limitRightClass} text-right`}>HC %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLines.map((line, index) => {
                        const sharedRowSpan = line.stationType === 'PACK_OFF' ? 0 : pairedRowsByAssembly.has(line.rowKey) ? 2 : 1;
                        const showSharedCells = sharedRowSpan > 0;
                        const isGroupStart = index === 0 || line.stationType === 'KITCHEN' || line.stationType === 'ASSEMBLY';
                        const isGroupEnd = index === visibleLines.length - 1 || line.stationType === 'KITCHEN' || line.stationType === 'PACK_OFF';
                        const rowLimitClass = `${isGroupStart ? limitTopClass : ''} ${isGroupEnd ? limitBottomClass : ''}`;
                        const sharedRowLimitClass = `${isGroupStart ? limitTopClass : ''} ${(sharedRowSpan > 1 || isGroupEnd) ? limitBottomClass : ''}`;

                      return (
                        <tr key={line.rowKey} className="border-t border-gray-100 dark:border-gray-800">
                          <td className={`${tableCellClass} ${stickyLocationCellClass} ${rowLimitClass} ${limitLeftClass} ${limitRightClass} font-semibold ${line.locationUnavailable ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
                            <span className="flex min-w-[128px] items-center gap-1.5 whitespace-nowrap">
                              <span>{line.locationUnavailable ? 'Unavailable' : line.location}</span>
                              {line.locationUnavailable && (
                                <span title={line.locationHint || 'Contact your Admin to create this Production line.'}>
                                  <Info
                                    className="h-3.5 w-3.5 shrink-0 text-amber-500"
                                    aria-label={line.locationHint || 'Production line is unavailable'}
                                  />
                                </span>
                              )}
                            </span>
                          </td>

                          {showSharedCells && (
                            <>
                              <td rowSpan={sharedRowSpan} className={`${isSubmitMode ? editableCellClass : tableCellClass} ${sharedRowLimitClass} ${limitLeftClass}`}>
                                {isSubmitMode ? (
                                  <div className="relative flex min-w-[92px] justify-center">
                                    <input
                                      value={normalizeItemNoInput(line.itemNo)}
                                      onChange={(event) => {
                                        updateLine(line.rowKey, 'itemNo', event.target.value);
                                        positionItemPicker(line.rowKey, event.currentTarget);
                                      }}
                                      onFocus={(event) => {
                                        activeItemInputRef.current = event.currentTarget;
                                        setActiveItemRowKey(line.rowKey);
                                        positionItemPicker(line.rowKey, event.currentTarget);
                                      }}
                                      onBlur={() => {
                                        window.setTimeout(() => {
                                          setActiveItemRowKey((current) => (current === line.rowKey ? null : current));
                                          setItemPickerAnchor((current) => (current?.rowKey === line.rowKey ? null : current));
                                          if (activeItemInputRef.current?.value === normalizeItemNoInput(line.itemNo)) {
                                            activeItemInputRef.current = null;
                                          }
                                        }, 120);
                                      }}
                                      className={`${tableInputClass} production-eos-cell-input`}
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      placeholder="Item"
                                    />
                                  </div>
                                ) : (
                                  <div className={`${calcClass} ${normalizeItemNoInput(line.itemNo) ? 'text-gray-800 dark:text-gray-100' : emptyValueClass}`}>
                                    {normalizeItemNoInput(line.itemNo) || '--'}
                                  </div>
                                )}
                              </td>
                              <td rowSpan={sharedRowSpan} className={`${tableCellClass} ${sharedRowLimitClass}`}>
                                <div className="min-w-[220px] max-w-[260px] whitespace-normal text-[12px] leading-snug text-gray-700 dark:text-gray-200">{line.itemDescriptionSnapshot || ''}</div>
                              </td>
                              <td rowSpan={sharedRowSpan} className={`${isSubmitMode ? editableCellClass : tableCellClass} ${sharedRowLimitClass} text-right`}>
                                {isSubmitMode ? (
                                  <input value={line.casesScheduled ?? ''} onChange={(event) => updateLine(line.rowKey, 'casesScheduled', event.target.value)} className={`${tableInputClass} text-right`} />
                                ) : (
                                  <div className={calcClass}>{formatNumber(line.casesScheduled, 0)}</div>
                                )}
                              </td>
                              <td rowSpan={sharedRowSpan} className={`${isSubmitMode ? editableCellClass : tableCellClass} ${sharedRowLimitClass} text-right`}>
                                {isSubmitMode ? (
                                  <input value={line.casesProduced ?? ''} onChange={(event) => updateLine(line.rowKey, 'casesProduced', event.target.value)} className={`${tableInputClass} text-right`} />
                                ) : (
                                  <div className={calcClass}>{formatNumber(line.casesProduced, 0)}</div>
                                )}
                              </td>
                              <td rowSpan={sharedRowSpan} className={`${tableCellClass} ${sharedRowLimitClass} text-right`}><div className={calcClass}>{formatNumber(line.lbsScheduled)}</div></td>
                              <td rowSpan={sharedRowSpan} className={`${tableCellClass} ${sharedRowLimitClass} text-right`}><div className={`${calcClass} ${metricTone(line.lbsProduced, true, kpiTargetValue('LBS_PRODUCED'))}`}>{formatNumber(line.lbsProduced)}</div></td>
                              <td rowSpan={sharedRowSpan} className={`${tableCellClass} ${sharedRowLimitClass} ${limitRightClass} text-right`}><div className={`${calcClass} ${metricTone(line.attainmentPct, true, kpiTargetValue('ATTAINMENT_PCT'))}`}>{formatPct(line.attainmentPct)}</div></td>
                            </>
                          )}

                          <td className={`${isSubmitMode ? editableCellClass : tableCellClass} ${rowLimitClass} text-right`}>
                            {isSubmitMode ? (
                              <button
                                type="button"
                                onClick={(event) => openScheduledStartEditor(line, event.currentTarget)}
                                className={`mx-auto flex h-7 w-[90%] min-w-[72px] items-center justify-end rounded-sm px-1 py-1 text-[12px] font-semibold leading-tight outline-none transition hover:bg-blue-50 hover:text-blue-700 focus-visible:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-200 ${scheduledStartEditor?.rowKey === line.rowKey ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-300 dark:bg-blue-950/40 dark:text-blue-200' : 'bg-transparent text-gray-800 dark:text-gray-100'}`}
                                aria-label={`Change scheduled start for ${line.location}`}
                              >
                                {line.scheduledStartTime ? (
                                  <DashTimeDisplay value={line.scheduledStartTime} />
                                ) : (
                                  <span className={emptyValueClass}>None</span>
                                )}
                              </button>
                            ) : (
                              <div className={calcClass}>
                                {line.scheduledStartTime ? (
                                  <DashTimeDisplay value={line.scheduledStartTime} />
                                ) : (
                                  <span className={`font-medium ${emptyValueClass}`}>None</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className={`${isSubmitMode ? editableCellClass : tableCellClass} ${rowLimitClass}`}>
                            {isSubmitMode ? (
                              <DashTimeField
                                value={line.actualStartTime || ''}
                                onChange={(value) => updateLine(line.rowKey, 'actualStartTime', value)}
                                ariaLabel={`${line.location} actual start time`}
                                variant="cell"
                                placeholderTime={actualTimePlaceholders.start}
                              />
                            ) : (
                              <div className={calcClass}>
                                {line.actualStartTime ? <DashTimeDisplay value={line.actualStartTime} /> : <span className={emptyValueClass}>--</span>}
                              </div>
                            )}
                          </td>
                          <td className={`${isSubmitMode ? editableCellClass : tableCellClass} ${rowLimitClass}`}>
                            {isSubmitMode ? (
                              <DashTimeField
                                value={line.actualEndTime || ''}
                                onChange={(value) => updateLine(line.rowKey, 'actualEndTime', value)}
                                ariaLabel={`${line.location} actual end time`}
                                variant="cell"
                                placeholderTime={actualTimePlaceholders.end}
                              />
                            ) : (
                              <div className={calcClass}>
                                {line.actualEndTime ? <DashTimeDisplay value={line.actualEndTime} /> : <span className={emptyValueClass}>--</span>}
                              </div>
                            )}
                          </td>
                          <td className={`${tableCellClass} ${rowLimitClass} text-right`}><div className={calcClass}>{formatNumber(line.totalMinutes)}</div></td>
                          <td className={`${tableCellClass} ${rowLimitClass} ${limitRightClass} text-right`}><div className={calcClass}>{formatNumber(line.lateStartMinutes)}</div></td>
                          <td className={`${isSubmitMode ? editableCellClass : tableCellClass} ${rowLimitClass} text-right`}>
                            {isSubmitMode ? (
                              <input value={editableBlankDefaultValue(line.wasteLbs)} onChange={(event) => updateLine(line.rowKey, 'wasteLbs', event.target.value)} className={`${tableInputClass} text-right`} />
                            ) : (
                              <div className={calcClass}>{formatNumber(line.wasteLbs)}</div>
                            )}
                          </td>
                          <td className={`${tableCellClass} ${rowLimitClass} text-right`}><div className={`${calcClass} ${metricTone(line.wastePct, false, kpiTargetValue('WASTE_PCT'))}`}>{formatPct(line.wastePct)}</div></td>
                          <td className={`${isSubmitMode ? editableCellClass : tableCellClass} ${rowLimitClass} text-right`}>
                            {isSubmitMode ? (
                              <input
                                value={formatPctInputValue(line.oeePct)}
                                onChange={(event) => updateLine(line.rowKey, 'oeePct', event.target.value)}
                                className={`${tableInputClass} text-right`}
                                inputMode="decimal"
                                placeholder="%"
                              />
                            ) : (
                              <div className={`${calcClass} ${metricTone(line.oeePct)}`}>{formatPct(line.oeePct)}</div>
                            )}
                          </td>
                          <td className={`${tableCellClass} ${rowLimitClass} text-right`}><div className={calcClass}>{formatNumber(line.standardHeadcount)}</div></td>
                          <td className={`${isSubmitMode ? editableCellClass : tableCellClass} ${rowLimitClass} text-right`}>
                            {isSubmitMode ? (
                              <input value={line.actualHeadcount ?? ''} onChange={(event) => updateLine(line.rowKey, 'actualHeadcount', event.target.value)} className={`${tableInputClass} text-right`} />
                            ) : (
                              <div className={calcClass}>{formatNumber(line.actualHeadcount)}</div>
                            )}
                          </td>
                          <td className={`${tableCellClass} ${rowLimitClass} ${limitRightClass} text-right`}><div className={`${calcClass} ${metricTone(line.headcountPct)}`}>{formatPct(line.headcountPct)}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="min-h-[72px] bg-white px-0 py-4 dark:bg-gray-900" style={{ width: EOS_TABLE_MIN_WIDTH }}>
                  <div className="grid items-center gap-y-3" style={{ gridTemplateColumns: EOS_TABLE_GRID_TEMPLATE, gridTemplateRows: 'auto' }}>
                    <div
                      className="pl-4 text-[12px] font-bold text-gray-800 dark:text-gray-100"
                      style={{ gridColumn: '1 / 4', gridRow: '1' }}
                    >
                      Shift Totals:
                    </div>
                    <ShiftTotalCard value={formatNumber(activeTotals.casesScheduled)} style={{ gridColumn: '4', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.casesProduced)} style={{ gridColumn: '5', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.lbsScheduled)} style={{ gridColumn: '6', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.lbsProduced)} tone={metricTone(activeTotals.lbsProduced, true, kpiTargetValue('LBS_PRODUCED'))} style={{ gridColumn: '7', gridRow: '1' }} />
                    <ShiftTotalCard value={formatPct(activeTotals.attainmentPct)} tone={metricTone(activeTotals.attainmentPct, true, kpiTargetValue('ATTAINMENT_PCT'))} style={{ gridColumn: '8', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.totalMinutes)} style={{ gridColumn: '12', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.lateStartMinutes)} style={{ gridColumn: '13', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.wasteLbs)} style={{ gridColumn: '14', gridRow: '1' }} />
                    <ShiftTotalCard value={formatPct(activeTotals.wastePct)} tone={metricTone(activeTotals.wastePct, false, kpiTargetValue('WASTE_PCT'))} style={{ gridColumn: '15', gridRow: '1' }} />
                    <ShiftTotalCard value={formatPct(activeTotals.oeePct)} tone={metricTone(activeTotals.oeePct)} style={{ gridColumn: '16', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.standardHeadcount)} style={{ gridColumn: '17', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.actualHeadcount)} style={{ gridColumn: '18', gridRow: '1' }} />
                    <ShiftTotalCard value={formatPct(activeTotals.headcountPct)} tone={metricTone(activeTotals.headcountPct)} style={{ gridColumn: '19', gridRow: '1' }} />
                  </div>
                </div>
                </div>
                {isSubmitMode && (
                  <div
                    key={tableSection}
                    className="production-eos-note-card m-4 max-w-[760px] rounded-md border border-gray-300 bg-gradient-to-b from-white to-gray-50 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_5px_rgba(15,23,42,0.12)] dark:border-gray-700 dark:from-gray-900 dark:to-gray-950"
                  >
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold text-gray-900 dark:text-gray-100">{activeSectionNote.title}</div>
                        <p className="mt-0.5 text-[11px] leading-snug text-gray-600 dark:text-gray-300">{activeSectionNote.body}</p>
                        <p className="mt-1 text-[11px] font-semibold leading-snug text-blue-700 dark:text-blue-300">{activeSectionNote.accuracy}</p>
                      </div>
                    </div>
                  </div>
                )}
                  </div>
                  {activePageTab === 'PRODUCTION' && (
                    <div className="production-eos-tab-panel">
                      {renderDashboardGaugeGrid('production-view-gauge')}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>

        {dashboardFullViewChart && (
          <DashboardFullViewModal
            title={dashboardFullViewChart.title}
            subtitle={dashboardFullViewChart.subtitle}
            scopeLabel={dashboardScopeLabel}
            width={dashboardFullViewChart.width}
            legendItems={dashboardFullViewChart.legendItems}
            onClose={() => setDashboardFullViewChartId(null)}
          >
            {dashboardFullViewChart.content}
          </DashboardFullViewModal>
        )}

        {isSubmitMode && activeItemRowKey && itemPickerAnchor?.rowKey === activeItemRowKey && activeItemSuggestions.length > 0 && (
          <div
            className="fixed z-40"
            style={{
              top: itemPickerAnchor.top,
              left: itemPickerAnchor.left,
              width: itemPickerAnchor.width,
            }}
          >
            <div
              className="absolute -left-1.5 h-3 w-3 rotate-45 border-b border-l border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900"
              style={{ top: itemPickerAnchor.arrowTop - 6 }}
            />
            <div
              className="overflow-y-auto overscroll-contain rounded-md border border-gray-300 bg-white py-1 text-left shadow-xl dark:border-gray-700 dark:bg-gray-900"
              style={{ maxHeight: itemPickerAnchor.maxHeight }}
            >
              {activeItemSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectItem(activeItemRowKey, item.itemNo);
                  }}
                  className="block w-full px-3 py-2 text-left text-[12px] leading-tight hover:bg-blue-50 focus:bg-blue-50 focus:outline-none dark:hover:bg-blue-950/40 dark:focus:bg-blue-950/40"
                >
                  <span className="block font-semibold text-gray-900 dark:text-gray-100">{item.itemNo}</span>
                  <span className="block truncate text-gray-600 dark:text-gray-300">{item.description || item.itemNo}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isSubmitMode && scheduledStartEditor && (
          <div
            ref={scheduledStartPopoverRef}
            className="production-eos-schedule-popover fixed z-40"
            style={{
              top: scheduledStartEditor.top,
              left: scheduledStartEditor.left,
              width: scheduledStartEditor.width,
            }}
          >
            <div
              className="absolute -left-1.5 h-3 w-3 rotate-45 border-b border-l border-blue-100 bg-white shadow-sm dark:border-blue-900 dark:bg-gray-900"
              style={{ top: scheduledStartEditor.arrowTop - 6 }}
            />
            <div className="rounded-xl border border-blue-100 bg-white p-3 shadow-2xl ring-1 ring-black/5 dark:border-blue-900 dark:bg-gray-900">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[12px] font-black text-gray-950 dark:text-white">
                    <Clock3 className="h-3.5 w-3.5 text-blue-600" />
                    Scheduled start
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{scheduledStartEditor.location}</p>
                </div>
                <button
                  type="button"
                  onClick={closeScheduledStartEditor}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label="Close scheduled start editor"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-[92px_1fr] items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2 text-[11px] dark:border-gray-800 dark:bg-gray-950/60">
                <span className="font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Current</span>
                <span className="text-right font-black text-gray-900 dark:text-gray-100">
                  {scheduledStartEditor.currentValue ? <DashTimeDisplay value={scheduledStartEditor.currentValue} /> : 'None'}
                </span>
              </div>

              <label className="mt-3 block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Change to</span>
                <DashTimeField
                  value={scheduledStartEditor.draftValue}
                  onChange={(value) => setScheduledStartEditor((current) => (current ? { ...current, draftValue: value } : current))}
                  ariaLabel={`Scheduled start for ${scheduledStartEditor.location}`}
                  variant="compact"
                />
              </label>

              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold leading-snug text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                This change is specific to this report and will be recorded in Audit Trail when the report is saved.
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeScheduledStartEditor}
                  className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-3 text-[12px] font-bold text-gray-600 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveScheduledStartOverride}
                  disabled={scheduledStartEditor.draftValue === scheduledStartEditor.currentValue}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[12px] font-black text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {fabOpen && (
            <div className="production-eos-fab-menu w-60 rounded-2xl border border-gray-200/80 bg-white/95 p-2 shadow-2xl ring-1 ring-black/5 backdrop-blur dark:border-gray-700/80 dark:bg-gray-900/95">
              <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">Report actions</div>
              <button
                type="button"
                onClick={openSubmitReportTab}
                disabled={!canSubmitSelectedSection || saving}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-gray-800 transition hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-gray-400 disabled:opacity-55 dark:text-gray-100 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200 dark:disabled:text-gray-500"
                title={actionSectionHasRecords ? `${sectionLabel(activeSection)} already has saved records. Use Edit Report.` : 'Create report records for this section'}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200">
                  {fabAvailabilityLoading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : <Send className="h-4 w-4" />}
                </span>
                Submit Report
              </button>
              <button
                type="button"
                onClick={openEditReport}
                disabled={!canEditSelectedSection}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-gray-800 transition hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-gray-400 disabled:opacity-55 dark:text-gray-100 dark:hover:bg-amber-950/40 dark:hover:text-amber-200 dark:disabled:text-gray-500"
                title={actionSectionHasRecords ? 'Edit existing report records for this section' : `${sectionLabel(activeSection)} has no saved records yet.`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-200">
                  <Pencil className="h-4 w-4" />
                </span>
                Edit Report
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePageTab('SUBMIT_REPORT');
                  setFabOpen(false);
                  void saveReport(false);
                }}
                disabled={saving}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-gray-800 transition hover:bg-blue-50 hover:text-blue-800 disabled:opacity-60 dark:text-gray-100 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-200">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </span>
                Draft
              </button>

              <div className="my-2 h-px bg-gray-200 dark:bg-gray-800" />
              <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">Views</div>
              <button
                type="button"
                onClick={() => {
                  setActivePageTab('DASHBOARD');
                  setFabOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-black transition ${activePageTab === 'DASHBOARD' ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200' : 'text-gray-800 hover:bg-blue-50 hover:text-blue-800 dark:text-gray-100 dark:hover:bg-blue-950/40 dark:hover:text-blue-200'}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-200">
                  <BarChart3 className="h-4 w-4" />
                </span>
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePageTab('PRODUCTION');
                  setFabOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-black transition ${activePageTab === 'PRODUCTION' ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200' : 'text-gray-800 hover:bg-blue-50 hover:text-blue-800 dark:text-gray-100 dark:hover:bg-blue-950/40 dark:hover:text-blue-200'}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-200">
                  <Factory className="h-4 w-4" />
                </span>
                Production
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePageTab('NOTES');
                  setFabOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-black transition ${activePageTab === 'NOTES' ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200' : 'text-gray-800 hover:bg-blue-50 hover:text-blue-800 dark:text-gray-100 dark:hover:bg-blue-950/40 dark:hover:text-blue-200'}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-200">
                  <MessageSquareText className="h-4 w-4" />
                </span>
                Notes
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePageTab('AUDIT_TRAIL');
                  setFabOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-black transition ${activePageTab === 'AUDIT_TRAIL' ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200' : 'text-gray-800 hover:bg-blue-50 hover:text-blue-800 dark:text-gray-100 dark:hover:bg-blue-950/40 dark:hover:text-blue-200'}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-200">
                  <History className="h-4 w-4" />
                </span>
                Audit Trail
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={toggleFabMenu}
            aria-label="Open Production EOS actions"
            aria-expanded={fabOpen}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-cyan-500 text-white shadow-[0_18px_35px_rgba(37,99,235,0.36)] ring-4 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(37,99,235,0.42)] focus:outline-none focus:ring-4 focus:ring-blue-200 dark:ring-blue-950"
          >
            {fabOpen ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
          </button>
        </div>
        <style jsx global>{`
          @keyframes productionEosTabIn {
            0% {
              opacity: 0.72;
              transform: translateY(7px) scale(0.996);
              filter: blur(1px);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          @keyframes productionEosNoteSweep {
            0% {
              transform: translateX(-120%);
            }
            100% {
              transform: translateX(120%);
            }
          }

          @keyframes productionEosToastIn {
            0% {
              opacity: 0;
              transform: translateX(28px) scale(0.98);
            }
            100% {
              opacity: 1;
              transform: translateX(0) scale(1);
            }
          }

          @keyframes productionEosFabMenuIn {
            0% {
              opacity: 0;
              transform: translateY(10px) scale(0.96);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes productionEosSchedulePopoverIn {
            0% {
              opacity: 0;
              transform: translateX(-10px) scale(0.96);
            }
            58% {
              opacity: 1;
              transform: translateX(3px) scale(1.025);
            }
            100% {
              opacity: 1;
              transform: translateX(0) scale(1);
            }
          }

          @keyframes productionEosDateFilterIn {
            0% {
              opacity: 0;
              transform: translateY(-8px) scale(0.97);
            }
            55% {
              opacity: 1;
              transform: translateY(2px) scale(1.015);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .production-eos-tab-panel {
            animation: productionEosTabIn 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
          }

          .production-eos-toast {
            animation: productionEosToastIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
          }

          .production-eos-fab-menu {
            animation: productionEosFabMenuIn 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
            transform-origin: bottom right;
          }

          .production-eos-schedule-popover {
            animation: productionEosSchedulePopoverIn 260ms cubic-bezier(0.2, 0.85, 0.25, 1.1);
            transform-origin: left center;
          }

          .production-eos-date-filter-popover {
            animation: productionEosDateFilterIn 240ms cubic-bezier(0.2, 0.85, 0.25, 1.1);
            transform-origin: top right;
          }

          .production-eos-note-card {
            position: relative;
            overflow: hidden;
            animation: productionEosTabIn 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
          }

          .production-eos-note-card::after {
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
            transform: translateX(-120%);
            background: linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.14), transparent);
            animation: productionEosNoteSweep 620ms ease-out;
          }

          @media (prefers-reduced-motion: reduce) {
            .production-eos-tab-panel,
            .production-eos-toast,
            .production-eos-fab-menu,
            .production-eos-schedule-popover,
            .production-eos-date-filter-popover,
            .production-eos-note-card,
            .production-eos-note-card::after {
              animation: none;
            }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}

function ShiftTotalCard({ value, tone = 'text-gray-900 dark:text-white', style }: { value: string; tone?: string; style: CSSProperties }) {
  return (
    <div className="px-1" style={style}>
      <div className="flex h-9 items-center justify-end rounded-sm border border-gray-300 bg-gradient-to-b from-white via-gray-50 to-gray-200 px-2 text-[12px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(15,23,42,0.12),0_1px_2px_rgba(15,23,42,0.12)] dark:border-gray-700 dark:from-gray-800 dark:via-gray-900 dark:to-gray-950">
        <span className={tone}>{value || '--'}</span>
      </div>
    </div>
  );
}

function DashboardPanel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <div className="mb-2 flex min-h-[28px] items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-black text-gray-950 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function DashboardFullViewModal({
  title,
  subtitle,
  scopeLabel,
  width,
  legendItems = [],
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  scopeLabel: string;
  width: number;
  legendItems?: DashboardLegendItem[];
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={`${title} full view`}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black text-gray-950 dark:text-white">{title}</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
                {scopeLabel}
              </span>
            </div>
            {subtitle && <p className="mt-1 text-[12px] font-medium text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Close full view"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-gradient-to-br from-white via-white to-blue-50/30 p-4 dark:from-gray-950 dark:via-gray-950 dark:to-blue-950/10">
          <div className="h-full min-h-[520px]" style={{ width }}>
            {children}
          </div>
        </div>
        {legendItems.length > 0 && (
          <DashboardFullViewLegendFooter items={legendItems} />
        )}
      </div>
    </div>
  );
}

function DashboardFullViewLegendFooter({ items }: { items: DashboardLegendItem[] }) {
  return (
    <footer className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-gray-700 dark:text-gray-200">
        {items.map((item) => (
          <span key={`${item.label}-${item.color}`} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {item.kind === 'line' || item.kind === 'dashed' ? (
              <span
                className="inline-block h-0 w-5 border-t-2"
                style={{
                  borderColor: item.color,
                  borderStyle: item.kind === 'dashed' ? 'dashed' : 'solid',
                }}
              />
            ) : (
              <span className="h-2.5 w-3.5 rounded-[2px]" style={{ backgroundColor: item.color }} />
            )}
            <span>{item.label}</span>
          </span>
        ))}
      </div>
    </footer>
  );
}

function DashboardDateFilterPopover({
  month,
  draftRanges,
  pendingRangeId,
  onPreviousMonth,
  onNextMonth,
  onSelectDay,
  onRemoveRange,
  onClear,
  onReset,
  onApply,
}: {
  month: Date;
  draftRanges: DashboardDateRange[];
  pendingRangeId: string | null;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (date: string) => void;
  onRemoveRange: (rangeId: string) => void;
  onClear: () => void;
  onReset: () => void;
  onApply: () => void;
}) {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const gridStart = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const key = inputValueFromDate(date);
    const owningRange = draftRanges.find((range) => {
      const startDate = range.startDate <= range.endDate ? range.startDate : range.endDate;
      const endDate = range.startDate <= range.endDate ? range.endDate : range.startDate;
      return key >= startDate && key <= endDate;
    });
    const isRangeStart = owningRange && key === owningRange.startDate;
    const isRangeEnd = owningRange && key === owningRange.endDate;
    const isSingleDayRange = owningRange && owningRange.startDate === owningRange.endDate;
    const isPendingStart = owningRange?.id === pendingRangeId && isSingleDayRange;

    return {
      key,
      date,
      label: date.getDate(),
      inMonth: date.getMonth() === month.getMonth(),
      owningRange,
      isRangeStart,
      isRangeEnd,
      isSingleDayRange,
      isPendingStart,
    };
  });
  const selectedDates = dashboardSelectedDatesFromRanges(draftRanges);

  return (
    <div className="production-eos-date-filter-popover absolute right-0 z-50 mt-2 w-[330px] rounded-2xl border border-gray-200 bg-white p-3 text-gray-900 shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
      <div className="absolute right-8 top-[-7px] h-3.5 w-3.5 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-normal uppercase tracking-wide text-blue-700 dark:text-blue-300">
            <Calendar className="h-3 w-3" />
            Dashboard date scope
          </p>
          <p className="mt-1 max-w-[230px] text-[10px] font-normal leading-4 text-gray-500 dark:text-gray-400">
            Pick one day, or pick a second day to create a range. Add more ranges to skip non-working days.
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-normal text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
          {selectedDates.length || 0} days
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-2 py-1.5 dark:bg-gray-900">
        <button
          type="button"
          onClick={onPreviousMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-white hover:text-blue-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-200"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[12px] font-normal text-gray-950 dark:text-white">{calendarMonthLabel(monthStart)}</span>
        <button
          type="button"
          onClick={onNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-white hover:text-blue-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-200"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-[9px] font-normal uppercase tracking-wide text-gray-400">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {calendarCells.map((cell) => {
          const selectedClass = cell.owningRange
            ? cell.isSingleDayRange
              ? 'rounded-full bg-blue-600 text-white shadow-sm'
              : cell.isRangeStart
                ? 'rounded-l-full bg-blue-600 text-white shadow-sm'
                : cell.isRangeEnd
                  ? 'rounded-r-full bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100'
            : 'hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-200';
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDay(cell.key)}
              className={`mx-auto flex h-8 w-full items-center justify-center text-[11px] font-normal transition ${selectedClass} ${cell.inMonth ? '' : 'text-gray-300 dark:text-gray-700'} ${cell.isPendingStart ? 'ring-2 ring-blue-300 ring-offset-1 ring-offset-white dark:ring-blue-500 dark:ring-offset-gray-950' : ''}`}
              aria-label={`Select ${cell.key}`}
            >
              {cell.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900">
        {draftRanges.length ? (
          <div className="flex flex-wrap gap-1.5">
            {draftRanges.map((range) => {
              const startDate = range.startDate <= range.endDate ? range.startDate : range.endDate;
              const endDate = range.startDate <= range.endDate ? range.endDate : range.startDate;
              return (
              <span
                key={range.id}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[9px] font-normal text-blue-800 dark:bg-blue-950/70 dark:text-blue-200"
              >
                {dashboardRangeLabel(startDate, endDate)}
                <button
                  type="button"
                  onClick={() => onRemoveRange(range.id)}
                  className="rounded-full p-0.5 text-blue-500 hover:bg-blue-200 hover:text-blue-900 dark:hover:bg-blue-900"
                  aria-label={`Remove ${dashboardRangeLabel(startDate, endDate)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );})}
          </div>
        ) : (
          <p className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
            No custom dates selected. Current week records are shown.
          </p>
        )}
      </div>

      <p className="mt-2 text-[9px] font-normal leading-4 text-gray-500 dark:text-gray-400">
        Filters change the records shown. KPI targets remain the backend standard; produced pounds uses the 5-day target.
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg px-3 py-2 text-[10px] font-normal text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
        >
          Current week
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-normal text-gray-600 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onApply}
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-[10px] font-normal text-white shadow-sm transition hover:bg-blue-700"
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardGaugeKpi({
  label,
  value,
  target,
  stretch,
  valueLabel,
  detail,
  targetLabel,
  stretchLabel,
  action,
  lowerIsBetter = false,
}: {
  label: string;
  value: number | null;
  target: number | null;
  stretch: number | null;
  valueLabel: string;
  detail: string;
  targetLabel: string;
  stretchLabel: string;
  action?: ReactNode;
  lowerIsBetter?: boolean;
}) {
  const cx = 100;
  const cy = 94;
  const radius = 66;
  const valueNumber = finiteMetricValue(value);
  const targetNumber = finiteMetricValue(target);
  const stretchNumber = finiteMetricValue(stretch);
  const maxValue = stretchNumber && stretchNumber > 0
    ? stretchNumber
    : Math.max(targetNumber ? targetNumber * 1.25 : 0, valueNumber ? valueNumber * 1.25 : 0, 1);
  const targetPct = targetNumber ? Math.max(0, Math.min(1, targetNumber / maxValue)) : 0.8;
  const valuePct = valueNumber !== null ? Math.max(0, Math.min(1, valueNumber / maxValue)) : 0;
  const onTarget = valueNumber !== null && targetNumber !== null
    ? lowerIsBetter ? valueNumber <= targetNumber : valueNumber >= targetNumber
    : false;
  const needleColor = valueNumber === null ? '#94a3b8' : onTarget ? '#16a34a' : '#dc2626';
  const firstZoneColor = lowerIsBetter ? '#22c55e' : '#ef4444';
  const secondZoneColor = lowerIsBetter ? '#ef4444' : '#22c55e';
  const offTargetLabel = lowerIsBetter ? 'Above target' : 'Below target';
  const statusLabel = valueNumber === null ? 'No data' : onTarget ? 'On target' : offTargetLabel;
  const statusClass = valueNumber === null
    ? 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-300'
    : onTarget
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200'
      : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-200';

  const pointAt = (pct: number, offset = 0) => {
    const angle = Math.PI - Math.max(0, Math.min(1, pct)) * Math.PI;
    const distance = radius + offset;
    return {
      x: cx + Math.cos(angle) * distance,
      y: cy - Math.sin(angle) * distance,
    };
  };

  const arcPath = (fromPct: number, toPct: number) => {
    const start = pointAt(fromPct);
    const end = pointAt(toPct);
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  };

  const targetInner = pointAt(targetPct, -12);
  const targetOuter = pointAt(targetPct, 13);
  const needleEnd = pointAt(valuePct, -12);

  return (
    <section className="rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-lg font-black text-gray-950 dark:text-white">{valueLabel || '--'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${statusClass}`}>
            {statusLabel}
          </span>
          {action}
        </div>
      </div>

      <svg className="mt-1 h-[92px] w-full overflow-visible" viewBox="0 0 200 120" role="img" aria-label={`${label} gauge`}>
        <path d={arcPath(0, 1)} fill="none" stroke="#e5e7eb" strokeWidth="19" strokeLinecap="butt" />
        <path d={arcPath(0, targetPct)} fill="none" stroke={firstZoneColor} strokeWidth="19" strokeLinecap="butt" opacity="0.88" />
        <path d={arcPath(targetPct, 1)} fill="none" stroke={secondZoneColor} strokeWidth="19" strokeLinecap="butt" opacity="0.88" />
        <line
          x1={targetInner.x}
          y1={targetInner.y}
          x2={targetOuter.x}
          y2={targetOuter.y}
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y} stroke={needleColor} strokeWidth="4" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={needleColor} stroke="#ffffff" strokeWidth="2" />
        <text x="32" y="112" textAnchor="middle" className="fill-gray-500 text-[10px] font-bold">0</text>
        <text x="168" y="112" textAnchor="middle" className="fill-gray-500 text-[10px] font-bold">{stretchLabel || '--'}</text>
      </svg>

      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold">
        <span className="min-w-0 leading-tight text-gray-500 dark:text-gray-400">{detail}</span>
        <span className="shrink-0 text-blue-700 dark:text-blue-300">Target {targetLabel || '--'}</span>
      </div>
    </section>
  );
}

function DashboardKpi({
  label,
  value,
  detail,
  icon,
  tone = 'blue',
  delta,
  inverseDelta = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan';
  delta?: number | null;
  inverseDelta?: boolean;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-900',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900',
    red: 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900',
    cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-950/50 dark:text-cyan-200 dark:ring-cyan-900',
  };
  const deltaIsGood = delta === null || delta === undefined ? null : inverseDelta ? delta <= 0 : delta >= 0;

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2.5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1.5 text-xl font-black tracking-normal text-gray-950 dark:text-white">{value || '--'}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${colors[tone]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-bold">
        <span className="truncate text-gray-500 dark:text-gray-400">{detail}</span>
        {delta !== null && delta !== undefined && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${deltaIsGood ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200' : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-200'}`}>
            {deltaIsGood ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {formatPct(Math.abs(delta), 1)}
          </span>
        )}
      </div>
    </div>
  );
}

function DashboardTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-1 font-black text-gray-900 dark:text-white">{label}</p>
      <div className="space-y-0.5">
        {payload.map((item: any) => (
          <DashboardTooltipRow key={`${item.name}-${item.dataKey}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function DashboardPieTooltip({ active, payload, valueSuffix = '' }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || item.payload?.color }} />
        <span className="font-semibold text-gray-600 dark:text-gray-300">{item.name}:</span>
        <span className="font-black text-gray-900 dark:text-white">{formatNumber(item.value, 0)}{valueSuffix}</span>
      </div>
    </div>
  );
}

function DashboardPiePercentageLabel({ cx, cy, midAngle, outerRadius, percent, value }: any) {
  const number = Number(value || 0);
  const pct = Number(percent || 0) * 100;
  if (!number || pct < 4) return null;

  const radius = Number(outerRadius || 0) * 0.62;
  const angle = -Number(midAngle || 0) * (Math.PI / 180);
  const x = Number(cx || 0) + radius * Math.cos(angle);
  const y = Number(cy || 0) + radius * Math.sin(angle);

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#ffffff"
      stroke="#111827"
      strokeOpacity={0.45}
      strokeWidth={2.4}
      paintOrder="stroke"
      className="text-[10px] font-black"
    >
      {formatNumber(pct, 0)}%
    </text>
  );
}

function DashboardTooltipRow({ item }: { item: any }) {
  const dataKey = String(item.dataKey).toLowerCase();
  const isPct = dataKey.includes('pct');
  const isWastePct = dataKey.includes('waste') && isPct;
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
      <span className="font-semibold text-gray-600 dark:text-gray-300">{item.name}:</span>
      <span className="font-black text-gray-900 dark:text-white">
        {isWastePct ? formatWastePctPoint(item.value) : isPct ? `${Number(item.value || 0).toFixed(1)}%` : formatNumber(item.value, 1)}
      </span>
    </div>
  );
}
