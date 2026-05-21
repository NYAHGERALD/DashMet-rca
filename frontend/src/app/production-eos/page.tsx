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
  Legend,
  Line,
  Pie,
  PieChart,
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
  ClipboardList,
  Clock3,
  Factory,
  FileText,
  Gauge,
  History,
  Info,
  Layers3,
  Loader2,
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
  scheduledStartTime?: string | null;
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
type DashboardSectionRow = DashboardMetrics & { section: string };
type DashboardLineRow = DashboardMetrics & { location: string; section: string; lineGroup?: string | null };
type DashboardShiftRow = DashboardMetrics & { shiftId?: string | null; shiftName: string };
type DashboardItemRow = DashboardMetrics & { itemNo: string; description: string };

interface ProductionEosDashboard {
  range: {
    startDate: string;
    endDate: string;
    days: number;
    shiftId?: string | null;
  };
  summary: DashboardMetrics;
  trend: DashboardTrendRow[];
  sectionMix: DashboardSectionRow[];
  linePerformance: DashboardLineRow[];
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

const SECTION_NOTES: Record<SectionKey, { title: string; body: string; accuracy: string }> = {
  PRODUCTION: {
    title: 'Production data view',
    body: 'This tab captures the planned and actual production for the selected shift. Enter the yellow-cell values such as item number, scheduled cases, produced cases, actual times, waste, downtime, and headcount; DashMet calculates pounds, attainment, late start, waste percent, and staffing results from backend formulas.',
    accuracy: 'Accurate production data keeps the shift totals, yield, labor, and follow-up decisions trustworthy.',
  },
  CHANGEOVER: {
    title: 'Changeover data view',
    body: 'This tab uses the same EOS table for changeover activity only. Enter the changeover-specific item, cases, timing, waste, downtime, and headcount values so the backend can calculate the impact separately from normal production.',
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
const AUDIT_COLLAPSE_ROW_THRESHOLD = 8;
const DASHBOARD_RANGE_DAYS = 30;
const DASHBOARD_COLORS = ['#2563eb', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#4f46e5', '#65a30d'];
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
  { key: 'downMinutes', width: '80px' },
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

function formatNumber(value: unknown, digits = 1) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function formatPct(value: unknown, digits = 1) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return `${(number * 100).toFixed(digits)}%`;
}

function formatCompactNumber(value: unknown, digits = 1) {
  if (value === null || value === undefined || value === '') return '--';
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(digits)}M`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(digits)}K`;
  return number.toLocaleString('en-US', { maximumFractionDigits: digits });
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
  'actualStartTime',
  'actualEndTime',
  'downMinutes',
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
  'wasteLbs',
  'actualHeadcount',
]);

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Blank';
  if (Array.isArray(value)) return value.length ? value.map(formatAuditValue).join(', ') : 'None';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
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
      area: 'Report',
      field: change.label,
      previousValue: change.previousValue,
      currentValue: change.currentValue,
    })),
    ...lineChanges.flatMap((row: any) => row.fields.map((change: any) => ({
      key: `line-${row.key}-${change.field}`,
      area: row.location || row.key,
      field: change.label,
      previousValue: change.previousValue,
      currentValue: change.currentValue,
    }))),
    ...noteChanges.flatMap((row: any) => row.fields.map((change: any) => ({
      key: `note-${row.key}-${change.field}`,
      area: row.location || row.key,
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

function metricTone(value: unknown, higherIsBetter = true) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'text-gray-500 dark:text-gray-400';
  if (higherIsBetter) {
    if (number >= 1) return 'text-emerald-700 dark:text-emerald-300';
    if (number >= 0.85) return 'text-amber-700 dark:text-amber-300';
    return 'text-red-700 dark:text-red-300';
  }
  if (number <= 0.03) return 'text-emerald-700 dark:text-emerald-300';
  if (number <= 0.05) return 'text-amber-700 dark:text-amber-300';
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

function scheduledStartForShift(line: EosLine, selectedShiftId: string) {
  const shiftStarts = line.scheduledStartTimes || [];
  if (shiftStarts.length && selectedShiftId) {
    return shiftStarts.find((row) => row.shiftId === selectedShiftId)?.scheduledStartTime || null;
  }
  if (shiftStarts.length) return null;
  return line.scheduledStartTime || null;
}

function withSelectedShiftScheduledStart(line: EosLine, selectedShiftId: string): EosLine {
  return {
    ...line,
    scheduledStartTime: scheduledStartForShift(line, selectedShiftId),
  };
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
  const [submitTabVisible, setSubmitTabVisible] = useState(false);
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
  const [selectedReportId, setSelectedReportId] = useState('');
  const [selectedReport, setSelectedReport] = useState<LoadedReport | null>(null);
  const [editingReportId, setEditingReportId] = useState('');
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>([]);
  const [expandedAuditEntryIds, setExpandedAuditEntryIds] = useState<Set<string>>(new Set());
  const [auditLoading, setAuditLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);
  const [activeItemRowKey, setActiveItemRowKey] = useState<string | null>(null);
  const [itemPickerAnchor, setItemPickerAnchor] = useState<ItemPickerAnchor | null>(null);
  const [shiftMenuOpen, setShiftMenuOpen] = useState(false);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const calculationTimer = useRef<NodeJS.Timeout | null>(null);
  const notesAutosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNotesAutosaveKey = useRef('');
  const notesDirty = useRef(false);
  const activeItemInputRef = useRef<HTMLInputElement | null>(null);
  const shiftMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionMenuRef = useRef<HTMLDivElement | null>(null);
  const noteTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const orderedShifts = useMemo(() => sortedShiftOptions(template?.shifts || []), [template?.shifts]);
  const currentShift = useMemo(
    () => orderedShifts.find((shift) => shift.id === shiftId) || null,
    [orderedShifts, shiftId],
  );

  const primaryTabs = useMemo(() => {
    const tabs: Array<{ key: PageTabKey; label: string }> = [
      { key: 'DASHBOARD', label: 'Dashboard' },
      { key: 'PRODUCTION', label: 'Production' },
    ];
    if (submitTabVisible) tabs.push({ key: 'SUBMIT_REPORT', label: 'Submit Report' });
    tabs.push({ key: 'NOTES', label: 'Notes' });
    tabs.push({ key: 'AUDIT_TRAIL', label: 'Audit Trail' });
    return tabs;
  }, [submitTabVisible]);

  const setNoteTextareaRef = useCallback((key: string) => (element: HTMLTextAreaElement | null) => {
    noteTextareaRefs.current[key] = element;
    if (element) {
      window.requestAnimationFrame(() => resizeNoteTextarea(element));
    }
  }, []);

  const isSubmitMode = activePageTab === 'SUBMIT_REPORT';
  const isEditingReport = Boolean(editingReportId);
  const showSectionSelector = activePageTab === 'PRODUCTION' || activePageTab === 'SUBMIT_REPORT';
  const productionReporterName = activePageTab === 'PRODUCTION' ? selectedReport?.reportedByName?.trim() : '';
  const reportTotals = useMemo(() => overallTotalsFrom(selectedReport?.totals), [selectedReport?.totals]);
  const reportTotalsBySection = useMemo(() => totalsBySectionFrom(selectedReport?.totals), [selectedReport?.totals]);
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
    : selectedReport?.lines?.length
      ? selectedReport.lines
      : blankTemplateLines;
  const tableSection = showSectionSelector ? activeSection : 'PRODUCTION';

  const visibleLines = useMemo(
    () => tableLines.filter((line) => line.section === tableSection).sort((a, b) => a.sortOrder - b.sortOrder),
    [tableLines, tableSection],
  );

  const activeTotals = useMemo(() => {
    const sourceTotalsBySection = isSubmitMode ? totalsBySection : reportTotalsBySection;
    const sourceTotals = isSubmitMode ? totals : reportTotals;
    const sectionTotals = sourceTotalsBySection[tableSection];
    return hasTotals(sectionTotals) ? sectionTotals : sourceTotals;
  }, [isSubmitMode, reportTotals, reportTotalsBySection, tableSection, totals, totalsBySection]);
  const activeSectionNote = SECTION_NOTES[tableSection];
  const dashboardTrend = dashboard?.trend || [];
  const dashboardCurrent = dashboardTrend[dashboardTrend.length - 1];
  const dashboardPrevious = dashboardTrend.length > 1 ? dashboardTrend[dashboardTrend.length - 2] : null;
  const dashboardAttainmentDelta = metricDelta(dashboardCurrent?.attainmentPct, dashboardPrevious?.attainmentPct);
  const dashboardOutputDelta = metricDelta(dashboardCurrent?.lbsProduced, dashboardPrevious?.lbsProduced);
  const dashboardWasteDelta = metricDelta(dashboardCurrent?.wastePct, dashboardPrevious?.wastePct);
  const dashboardLateDelta = metricDelta(dashboardCurrent?.lateStartMinutes, dashboardPrevious?.lateStartMinutes);
  const dashboardSectionChart = (dashboard?.sectionMix || []).map((row) => ({
    ...row,
    sectionLabel: SECTION_OPTIONS.find((section) => section.key === row.section)?.label || row.section,
    attainmentPctValue: pctValue(row.attainmentPct) || 0,
    wastePctValue: pctValue(row.wastePct) || 0,
    headcountPctValue: pctValue(row.headcountPct) || 0,
  }));
  const dashboardTrendChart = dashboardTrend.map((row) => ({
    ...row,
    dateLabel: formatDashboardDate(row.date),
    attainmentPctValue: pctValue(row.attainmentPct),
    wastePctValue: pctValue(row.wastePct),
    headcountPctValue: pctValue(row.headcountPct),
  }));
  const dashboardLineChart = (dashboard?.linePerformance || []).slice(0, 10).map((row) => ({
    ...row,
    shortLocation: row.location.replace(/^(.{18}).+$/, '$1...'),
    attainmentPctValue: pctValue(row.attainmentPct) || 0,
    wastePctValue: pctValue(row.wastePct) || 0,
    headcountPctValue: pctValue(row.headcountPct) || 0,
  }));
  const dashboardShiftChart = (dashboard?.shiftPerformance || []).map((row) => ({
    ...row,
    attainmentPctValue: pctValue(row.attainmentPct) || 0,
    wastePctValue: pctValue(row.wastePct) || 0,
  }));

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
    setReportDate(normalizedDate);
    setDayOfWeek(report.dayOfWeek || dayFromDate(normalizedDate));
    setShiftId(report.shiftId || '');
    setLines(report.lines || []);
    syncNotesFromReport(report);
    const reportTotalsForEdit = report.totals || {};
    setTotals(overallTotalsFrom(reportTotalsForEdit));
    setTotalsBySection(totalsBySectionFrom(reportTotalsForEdit));
    setWarnings([]);
    setEditingReportId(report.id);
    setSubmitTabVisible(true);
    setActivePageTab('SUBMIT_REPORT');
    setFabOpen(false);
  }, [syncNotesFromReport]);

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
      setSelectedReport(normalizedReport);
      if (!editingReportId) {
        syncNotesFromReport(normalizedReport);
      }
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not load submitted Production EOS report.');
    }
  }, [editingReportId, syncNotesFromReport]);

  const loadSubmittedReports = useCallback(async () => {
    try {
      const res = await api.get('/production-eos/reports', {
        params: {
          status: 'SUBMITTED',
          ...(reportDate ? { date: reportDate } : {}),
          ...(shiftId ? { shiftId } : {}),
        },
      });
      const reports = (res.data.reports || []).map((report: ReportSummary) => ({
        ...report,
        reportDate: dateInputFromValue(report.reportDate),
      }));

      const selectedStillVisible = reports.some((report: ReportSummary) => report.id === selectedReportId);
      if (!selectedStillVisible) {
        setSelectedReportId(reports[0]?.id || '');
        setSelectedReport(null);
        if (reports[0]?.id) void loadReportById(reports[0].id);
      }
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not load submitted Production EOS reports.');
    }
  }, [loadReportById, reportDate, selectedReportId, shiftId]);

  const loadDashboard = useCallback(async () => {
    if (!reportDate) return;
    setDashboardLoading(true);
    try {
      const res = await api.get('/production-eos/dashboard', {
        params: {
          endDate: reportDate,
          days: DASHBOARD_RANGE_DAYS,
          ...(shiftId ? { shiftId } : {}),
        },
      });
      setDashboard(res.data.dashboard || null);
    } catch (error: any) {
      setDashboard(null);
      showNotice('error', error.response?.data?.error || 'Could not load Production EOS dashboard.');
    } finally {
      setDashboardLoading(false);
    }
  }, [reportDate, shiftId]);

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
    if (activePageTab === 'DASHBOARD') {
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
      void loadNotesReport();
    }
  }, [activePageTab, loadNotesReport]);

  useEffect(() => {
    if (activePageTab === 'AUDIT_TRAIL' && selectedReportId) {
      void loadAuditTrail(selectedReportId);
    }
  }, [activePageTab, loadAuditTrail, selectedReportId]);

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
    const day = dayFromDate(reportDate);
    if (day) setDayOfWeek(day);
  }, [reportDate]);

  const runCalculation = useCallback(async (quiet = false) => {
    if (!lines.length || !reportDate) return;
    setCalculating(true);
    try {
      const res = await api.post('/production-eos/calculate', reportPayload());
      const calculation = res.data.calculation;
      setLines(calculation.lines || lines);
      setTotals(calculation.totals || {});
      setTotalsBySection(totalsBySectionFrom(calculation.totalsBySection || calculation.totals));
      setWarnings(calculation.validationWarnings || []);
      if (!quiet) showNotice('success', 'Report recalculated from backend formulas.');
    } catch (error: any) {
      if (!quiet) showNotice('error', error.response?.data?.error || 'Calculation failed.');
    } finally {
      setCalculating(false);
    }
  }, [lines, reportDate, reportPayload]);

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
      setLines(report.lines || lines);
      setTotals(overallTotalsFrom(savedTotals));
      setTotalsBySection(totalsBySectionFrom(savedTotals));
      setWarnings(report.validationWarnings || []);
      showNotice('success', editingReportId ? 'Production EOS report changes saved and logged.' : submit ? 'Production EOS report submitted.' : 'Production EOS draft saved.');
      if (submit || editingReportId) {
        setSelectedReportId(report.id);
        setSelectedReport(report);
        setEditingReportId('');
        setSubmitTabVisible(false);
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

  const openSubmitReportTab = () => {
    setEditingReportId('');
    setLines(template?.rows || []);
    setSafetyConcerns('');
    setQualityIssues('');
    setLineNotes({ 'Line 1': '', 'Line 2': '', 'Line 3': '', 'Line 5': '' });
    setTotals({});
    setTotalsBySection(emptyTotalsBySection());
    setWarnings([]);
    setSubmitTabVisible(true);
    setActivePageTab('SUBMIT_REPORT');
    setFabOpen(false);
  };

  const openEditReport = async () => {
    const reportId = selectedReportId || selectedReport?.id;
    if (!reportId) {
      showNotice('error', 'Select a submitted report before editing.');
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
      showNotice('info', 'Editing submitted report. Every saved change will be recorded in Audit Trail.');
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not open report for editing.');
      setFabOpen(false);
    }
  };

  const editableClass = 'w-full min-w-[92px] rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-amber-800 dark:bg-amber-950/40 dark:text-gray-100';
  const noteTextareaClass = `${editableClass} min-h-[112px] resize-y overflow-y-auto leading-5`;
  const headerLabelClass = 'mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400';
  const headerFieldClass = 'h-9 w-full rounded-md border border-amber-200 bg-amber-50 px-2 text-[12px] font-medium text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-gray-100';
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

        <div className="shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
              <div className="flex min-w-0 items-center gap-2 xl:w-[300px]">
                <Factory className="h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold leading-6 text-gray-900 dark:text-white">Production EOS</h1>
                  <p className="truncate text-[12px] leading-4 text-gray-600 dark:text-gray-400">Production end-of-shift report with backend-owned calculations.</p>
                </div>
              </div>

              <div className={`grid w-full gap-2 xl:w-auto xl:items-end ${activePageTab === 'SUBMIT_REPORT' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[132px_132px_220px_160px_104px_118px]' : activePageTab === 'PRODUCTION' ? 'sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-[142px_142px_210px_150px_210px]' : 'sm:grid-cols-3 xl:grid-cols-[170px_180px_220px]'}`}>
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
                  className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
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
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 text-[12px] font-bold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                      >
                        {calculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
                        Recalculate
                      </button>
                      <button
                        type="button"
                        onClick={() => saveReport(true)}
                        disabled={saving}
                        aria-label={isEditingReport ? 'Save edited Production EOS report' : 'Save Production EOS report'}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
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

        <main className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex min-h-[360px] flex-1 items-center justify-center">
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                Loading Production EOS...
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 border-b border-gray-200 dark:border-gray-800" role="tablist" aria-label="Production EOS views">
                <div className="flex items-end gap-6">
                  {primaryTabs.map((tab) => {
                    const isActive = activePageTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`production-eos-panel-${tab.key.toLowerCase()}`}
                        onClick={() => setActivePageTab(tab.key)}
                        className={`production-eos-tab-trigger ${isActive ? 'is-active text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'} relative -mb-px px-1 pb-3 pt-1 text-sm font-bold outline-none transition-colors focus-visible:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 dark:focus-visible:text-blue-300 dark:focus-visible:ring-blue-700 dark:focus-visible:ring-offset-gray-950`}
                      >
                        <span className="production-eos-tab-label">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activePageTab === 'DASHBOARD' && (
                <section
                  id="production-eos-panel-dashboard"
                  role="tabpanel"
                  className="production-eos-tab-panel space-y-4"
                >
                  <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-900">
                          <BarChart3 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-black text-gray-950 dark:text-white">Production EOS Dashboard</h2>
                          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                            {dashboard?.range
                              ? `${formatDashboardDate(dashboard.range.startDate)} - ${formatDashboardDate(dashboard.range.endDate)}${currentShift ? ` • ${currentShift.name}` : ''}`
                              : 'Live operational performance from Production EOS reports'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-200">{dashboard?.summary?.reportsCount || 0} reports</span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">{dashboard?.summary?.submittedCount || 0} submitted</span>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">{dashboard?.summary?.draftCount || 0} drafts</span>
                        <button
                          type="button"
                          onClick={() => loadDashboard()}
                          disabled={dashboardLoading}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                        >
                          {dashboardLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Refresh
                        </button>
                      </div>
                    </div>
                  </div>

                  {dashboardLoading && !dashboard ? (
                    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
                      Loading dashboard...
                    </div>
                  ) : !dashboard || !dashboard.summary.reportsCount ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <DashboardKpi
                          label="Schedule attainment"
                          value={formatPct(dashboard.summary.attainmentPct, 1) || '--'}
                          detail={`${formatCompactNumber(dashboard.summary.casesProduced, 1)} of ${formatCompactNumber(dashboard.summary.casesScheduled, 1)} cases`}
                          icon={<Gauge className="h-5 w-5" />}
                          tone="blue"
                          delta={dashboardAttainmentDelta}
                        />
                        <DashboardKpi
                          label="Produced pounds"
                          value={`${formatCompactNumber(dashboard.summary.lbsProduced, 1)} lbs`}
                          detail={`${formatCompactNumber(dashboard.summary.casesProduced, 1)} produced cases`}
                          icon={<Activity className="h-5 w-5" />}
                          tone="green"
                          delta={dashboardOutputDelta}
                        />
                        <DashboardKpi
                          label="Waste"
                          value={formatPct(dashboard.summary.wastePct, 2) || '--'}
                          detail={`${formatCompactNumber(dashboard.summary.wasteLbs, 1)} lbs total`}
                          icon={<AlertTriangle className="h-5 w-5" />}
                          tone="red"
                          delta={dashboardWasteDelta}
                          inverseDelta
                        />
                        <DashboardKpi
                          label="Late start"
                          value={`${formatCompactNumber(dashboard.summary.lateStartMinutes, 1)} min`}
                          detail={`${formatCompactNumber(dashboard.summary.downMinutes, 1)} downtime min`}
                          icon={<Clock3 className="h-5 w-5" />}
                          tone="amber"
                          delta={dashboardLateDelta}
                          inverseDelta
                        />
                        <DashboardKpi
                          label="Labor fit"
                          value={formatPct(dashboard.summary.headcountPct, 1) || '--'}
                          detail={`${formatNumber(dashboard.summary.actualHeadcount, 1)} actual / ${formatNumber(dashboard.summary.standardHeadcount, 1)} std`}
                          icon={<Users className="h-5 w-5" />}
                          tone="violet"
                        />
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
                        <DashboardPanel
                          title="Production Trend"
                          subtitle="Daily output, attainment, and waste across the selected period"
                          action={<span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700 dark:bg-blue-950 dark:text-blue-200">{DASHBOARD_RANGE_DAYS} days</span>}
                        >
                          <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={dashboardTrendChart} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar yAxisId="left" dataKey="lbsProduced" name="Lbs produced" fill="#2563eb" radius={[3, 3, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="attainmentPctValue" name="Attainment %" stroke="#059669" strokeWidth={2.5} dot={false} />
                                <Line yAxisId="right" type="monotone" dataKey="wastePctValue" name="Waste %" stroke="#dc2626" strokeWidth={2} dot={false} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </DashboardPanel>

                        <DashboardPanel title="Section Mix" subtitle="Output contribution by report section">
                          <div className="grid gap-3 md:grid-cols-[190px_1fr] xl:grid-cols-1">
                            <div className="h-[190px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Tooltip content={<DashboardTooltip />} />
                                  <Pie data={dashboardSectionChart} dataKey="lbsProduced" nameKey="sectionLabel" innerRadius={54} outerRadius={82} paddingAngle={2}>
                                    {dashboardSectionChart.map((entry, index) => (
                                      <Cell key={entry.section} fill={DASHBOARD_COLORS[index % DASHBOARD_COLORS.length]} />
                                    ))}
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="space-y-2">
                              {dashboardSectionChart.map((section, index) => (
                                <div key={section.section} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-950">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DASHBOARD_COLORS[index % DASHBOARD_COLORS.length] }} />
                                      <span className="truncate text-[12px] font-black text-gray-900 dark:text-white">{section.sectionLabel}</span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{formatPct(section.attainmentPct, 1) || '--'} attainment</p>
                                  </div>
                                  <span className="text-[12px] font-black text-gray-900 dark:text-white">{formatCompactNumber(section.lbsProduced, 1)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </DashboardPanel>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <DashboardPanel title="Line Performance" subtitle="Top lines by produced pounds with attainment overlay">
                          <div className="h-[310px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={dashboardLineChart} layout="vertical" margin={{ top: 4, right: 22, left: 20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="shortLocation" width={110} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Bar dataKey="lbsProduced" name="Lbs produced" fill="#0891b2" radius={[0, 4, 4, 0]} />
                                <Line type="monotone" dataKey="attainmentPctValue" name="Attainment %" stroke="#059669" strokeWidth={2} dot={false} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </DashboardPanel>

                        <DashboardPanel title="Shift Comparison" subtitle="Output, attainment, and waste by shift">
                          <div className="h-[310px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={dashboardShiftChart} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="shiftName" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="lbsProduced" name="Lbs produced" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="wasteLbs" name="Waste lbs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </DashboardPanel>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-3">
                        <DashboardPanel title="Waste Drivers" subtitle="Highest waste lbs by line">
                          <div className="space-y-2">
                            {(dashboard.wasteDrivers || []).slice(0, 6).map((row, index) => (
                              <div key={`${row.section}-${row.location}`} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0 dark:border-gray-800">
                                <div className="min-w-0">
                                  <p className="truncate text-[12px] font-black text-gray-900 dark:text-white">{index + 1}. {row.location}</p>
                                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{formatPct(row.wastePct, 2) || '--'} waste</p>
                                </div>
                                <span className="rounded bg-red-50 px-2 py-1 text-[11px] font-black text-red-700 dark:bg-red-950/50 dark:text-red-200">{formatNumber(row.wasteLbs, 1)} lbs</span>
                              </div>
                            ))}
                          </div>
                        </DashboardPanel>

                        <DashboardPanel title="Late Start Drivers" subtitle="Largest late-start minute contributors">
                          <div className="space-y-2">
                            {(dashboard.lateStartDrivers || []).slice(0, 6).map((row, index) => (
                              <div key={`${row.section}-${row.location}`} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0 dark:border-gray-800">
                                <div className="min-w-0">
                                  <p className="truncate text-[12px] font-black text-gray-900 dark:text-white">{index + 1}. {row.location}</p>
                                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{row.section}</p>
                                </div>
                                <span className="rounded bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">{formatNumber(row.lateStartMinutes, 1)} min</span>
                              </div>
                            ))}
                          </div>
                        </DashboardPanel>

                        <DashboardPanel title="Attainment Watchlist" subtitle="Lowest schedule attainment lines">
                          <div className="space-y-2">
                            {(dashboard.attainmentWatchlist || []).slice(0, 6).map((row, index) => (
                              <div key={`${row.section}-${row.location}`} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0 dark:border-gray-800">
                                <div className="min-w-0">
                                  <p className="truncate text-[12px] font-black text-gray-900 dark:text-white">{index + 1}. {row.location}</p>
                                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{formatCompactNumber(row.casesProduced, 1)} produced cases</p>
                                </div>
                                <span className="rounded bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">{formatPct(row.attainmentPct, 1) || '--'}</span>
                              </div>
                            ))}
                          </div>
                        </DashboardPanel>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <DashboardPanel title="Item Output Mix" subtitle="Highest output items in the selected period">
                          <div className="h-[280px]">
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

                        <DashboardPanel title="Recent Reports" subtitle="Latest Production EOS activity">
                          <div className="space-y-2">
                            {(dashboard.recentReports || []).slice(0, 7).map((report) => (
                              <div key={report.id} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-950">
                                <div className="min-w-0">
                                  <p className="truncate text-[12px] font-black text-gray-900 dark:text-white">{formatDashboardDate(report.reportDate)} • {report.shiftName}</p>
                                  <p className="truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">{report.reportedByName || 'Unknown'} • {formatDateTime(report.updatedAt)}</p>
                                </div>
                                <span className={`rounded px-2 py-1 text-[10px] font-black ${report.status === 'SUBMITTED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200'}`}>
                                  {report.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </DashboardPanel>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                          <div className="flex items-center gap-2 text-sm font-black text-gray-950 dark:text-white"><Layers3 className="h-4 w-4 text-blue-600" /> Report Quality Signals</div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-md bg-gray-50 px-2 py-2 dark:bg-gray-950">
                              <p className="text-lg font-black text-gray-950 dark:text-white">{dashboard.summary.noteCount}</p>
                              <p className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">Line notes</p>
                            </div>
                            <div className="rounded-md bg-gray-50 px-2 py-2 dark:bg-gray-950">
                              <p className="text-lg font-black text-gray-950 dark:text-white">{dashboard.summary.safetyCount}</p>
                              <p className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">Safety</p>
                            </div>
                            <div className="rounded-md bg-gray-50 px-2 py-2 dark:bg-gray-950">
                              <p className="text-lg font-black text-gray-950 dark:text-white">{dashboard.summary.qualityCount}</p>
                              <p className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">Quality</p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                          <div className="flex items-center gap-2 text-sm font-black text-gray-950 dark:text-white"><ClipboardList className="h-4 w-4 text-emerald-600" /> Completion</div>
                          <p className="mt-3 text-2xl font-black text-gray-950 dark:text-white">{formatPct(dashboard.summary.submittedCount / Math.max(dashboard.summary.reportsCount, 1), 1)}</p>
                          <p className="mt-1 text-[12px] font-medium text-gray-500 dark:text-gray-400">{dashboard.summary.submittedCount} submitted of {dashboard.summary.reportsCount} reports</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                          <div className="flex items-center gap-2 text-sm font-black text-gray-950 dark:text-white"><Info className="h-4 w-4 text-cyan-600" /> Decision Focus</div>
                          <p className="mt-3 text-[12px] font-semibold leading-5 text-gray-600 dark:text-gray-300">
                            Prioritize high waste, late start, and low-attainment lines first; these drivers have the clearest impact on yield, labor, and follow-up actions.
                          </p>
                        </div>
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
                          ? `${dateInputFromValue(selectedReport.reportDate)} • ${selectedReport.shiftNameSnapshot} • ${selectedReport.status}`
                          : 'Select a submitted report by date and shift to review its audit trail.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadAuditTrail()}
                      disabled={!selectedReportId || auditLoading}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-[12px] font-bold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                    >
                      {auditLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                      Refresh
                    </button>
                  </div>

                  {!selectedReportId ? (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
                      No submitted report is selected for the current date and shift.
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
                                        <span className="font-bold text-gray-950 dark:text-gray-50">{change.area}</span>
                                        <span> {change.field} changed from </span>
                                        <span className="inline-flex rounded bg-yellow-100 px-1.5 py-0.5 font-black text-yellow-900 ring-1 ring-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-100 dark:ring-yellow-800/70">{formatAuditValue(change.previousValue)}</span>
                                        <span> to </span>
                                        <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 font-black text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/70">{formatAuditValue(change.currentValue)}</span>
                                        <span>.</span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : changeRows.length > 0 && isAuditEntryExpanded ? (
                                <div className="mt-2 overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
                                  <div className="grid grid-cols-[minmax(110px,0.8fr)_minmax(100px,0.7fr)_minmax(0,1.25fr)_minmax(0,1.25fr)] bg-gray-50 text-[10px] font-bold uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                    <div className="px-3 py-1.5">Area</div>
                                    <div className="px-3 py-1.5">Field</div>
                                    <div className="px-3 py-1.5">Previous</div>
                                    <div className="px-3 py-1.5">Changed</div>
                                  </div>
                                  <div className="divide-y divide-gray-100 text-[12px] dark:divide-gray-800">
                                    {changeRows.map((change) => (
                                      <div key={change.key} className="grid grid-cols-[minmax(110px,0.8fr)_minmax(100px,0.7fr)_minmax(0,1.25fr)_minmax(0,1.25fr)] bg-white dark:bg-gray-950">
                                        <div className="break-words px-3 py-2 font-semibold text-gray-700 dark:text-gray-200">{change.area}</div>
                                        <div className="break-words px-3 py-2 text-gray-600 dark:text-gray-300">{change.field}</div>
                                        <div className="break-words bg-yellow-50 px-3 py-2 font-bold text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-100">{formatAuditValue(change.previousValue)}</div>
                                        <div className="break-words bg-emerald-50 px-3 py-2 font-bold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">{formatAuditValue(change.currentValue)}</div>
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
                        <th className={`${tableHeaderCellClass} ${limitTopClass} ${limitBottomClass} text-right`}>Down Min</th>
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
                              <td rowSpan={sharedRowSpan} className={`${tableCellClass} ${sharedRowLimitClass} text-right`}><div className={calcClass}>{formatNumber(line.lbsProduced)}</div></td>
                              <td rowSpan={sharedRowSpan} className={`${tableCellClass} ${sharedRowLimitClass} ${limitRightClass} text-right`}><div className={`${calcClass} ${metricTone(line.attainmentPct)}`}>{formatPct(line.attainmentPct)}</div></td>
                            </>
                          )}

                          <td className={`${tableCellClass} ${rowLimitClass} text-right`}>
                            <div className={calcClass}>
                              {line.scheduledStartTime ? (
                                <DashTimeDisplay value={line.scheduledStartTime} />
                              ) : (
                                <span className={`font-medium ${emptyValueClass}`}>None</span>
                              )}
                            </div>
                          </td>
                          <td className={`${isSubmitMode ? editableCellClass : tableCellClass} ${rowLimitClass}`}>
                            {isSubmitMode ? (
                              <DashTimeField value={line.actualStartTime || ''} onChange={(value) => updateLine(line.rowKey, 'actualStartTime', value)} ariaLabel={`${line.location} actual start time`} variant="cell" />
                            ) : (
                              <div className={calcClass}>
                                {line.actualStartTime ? <DashTimeDisplay value={line.actualStartTime} /> : <span className={emptyValueClass}>--</span>}
                              </div>
                            )}
                          </td>
                          <td className={`${isSubmitMode ? editableCellClass : tableCellClass} ${rowLimitClass}`}>
                            {isSubmitMode ? (
                              <DashTimeField value={line.actualEndTime || ''} onChange={(value) => updateLine(line.rowKey, 'actualEndTime', value)} ariaLabel={`${line.location} actual end time`} variant="cell" />
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
                              <input value={line.wasteLbs ?? ''} onChange={(event) => updateLine(line.rowKey, 'wasteLbs', event.target.value)} className={`${tableInputClass} text-right`} />
                            ) : (
                              <div className={calcClass}>{formatNumber(line.wasteLbs)}</div>
                            )}
                          </td>
                          <td className={`${tableCellClass} ${rowLimitClass} text-right`}><div className={`${calcClass} ${metricTone(line.wastePct, false)}`}>{formatPct(line.wastePct)}</div></td>
                          <td className={`${isSubmitMode ? editableCellClass : tableCellClass} ${rowLimitClass} text-right`}>
                            {isSubmitMode ? (
                              <input value={line.downMinutes ?? ''} onChange={(event) => updateLine(line.rowKey, 'downMinutes', event.target.value)} className={`${tableInputClass} text-right`} />
                            ) : (
                              <div className={calcClass}>{formatNumber(line.downMinutes)}</div>
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
                    <ShiftTotalCard value={formatNumber(activeTotals.lbsProduced)} style={{ gridColumn: '7', gridRow: '1' }} />
                    <ShiftTotalCard value={formatPct(activeTotals.attainmentPct)} tone={metricTone(activeTotals.attainmentPct)} style={{ gridColumn: '8', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.totalMinutes)} style={{ gridColumn: '12', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.lateStartMinutes)} style={{ gridColumn: '13', gridRow: '1' }} />
                    <ShiftTotalCard value={formatNumber(activeTotals.wasteLbs)} style={{ gridColumn: '14', gridRow: '1' }} />
                    <ShiftTotalCard value={formatPct(activeTotals.wastePct)} tone={metricTone(activeTotals.wastePct, false)} style={{ gridColumn: '15', gridRow: '1' }} />
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
              )}
            </>
          )}
        </main>

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

        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {fabOpen && (
            <div className="production-eos-fab-menu w-48 rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900">
              <button
                type="button"
                onClick={openSubmitReportTab}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-bold text-gray-800 transition hover:bg-blue-50 hover:text-blue-700 dark:text-gray-100 dark:hover:bg-blue-950/50 dark:hover:text-blue-200"
              >
                <Send className="h-3.5 w-3.5 text-emerald-600" />
                Submit Report
              </button>
              <button
                type="button"
                onClick={openEditReport}
                disabled={!selectedReportId}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-bold text-gray-800 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45 dark:text-gray-100 dark:hover:bg-blue-950/50 dark:hover:text-blue-200"
              >
                <Pencil className="h-3.5 w-3.5 text-amber-600" />
                Edit Report
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmitTabVisible(true);
                  setActivePageTab('SUBMIT_REPORT');
                  setFabOpen(false);
                  void saveReport(false);
                }}
                disabled={saving}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-bold text-gray-800 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60 dark:text-gray-100 dark:hover:bg-blue-950/50 dark:hover:text-blue-200"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" /> : <Save className="h-3.5 w-3.5 text-blue-600" />}
                Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePageTab('NOTES');
                  setFabOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-bold text-gray-800 transition hover:bg-blue-50 hover:text-blue-700 dark:text-gray-100 dark:hover:bg-blue-950/50 dark:hover:text-blue-200"
              >
                <MessageSquareText className="h-3.5 w-3.5 text-blue-600" />
                Notes
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setFabOpen((open) => !open)}
            aria-label="Open Production EOS actions"
            aria-expanded={fabOpen}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl ring-4 ring-blue-100 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 dark:ring-blue-950"
          >
            <Plus className={`h-7 w-7 transition-transform ${fabOpen ? 'rotate-45' : ''}`} />
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

          @keyframes productionEosTabPress {
            0% {
              transform: translateY(0) scale(1);
            }
            45% {
              transform: translateY(-1px) scale(1.04);
            }
            100% {
              transform: translateY(0) scale(1);
            }
          }

          @keyframes productionEosTabIndicator {
            0% {
              opacity: 0.35;
              transform: scaleX(0.18);
            }
            100% {
              opacity: 1;
              transform: scaleX(1);
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

          .production-eos-tab-trigger::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: -1px;
            height: 3px;
            border-radius: 999px 999px 0 0;
            background: linear-gradient(90deg, #2563eb, #0891b2);
            opacity: 0;
            transform: scaleX(0);
            transform-origin: center;
          }

          .production-eos-tab-trigger::before {
            content: '';
            position: absolute;
            left: -10px;
            right: -10px;
            bottom: 0;
            height: 26px;
            border-radius: 10px 10px 0 0;
            background: linear-gradient(180deg, rgba(37, 99, 235, 0.1), rgba(37, 99, 235, 0));
            opacity: 0;
            transition: opacity 180ms ease;
          }

          .production-eos-tab-trigger.is-active::before {
            opacity: 1;
          }

          .production-eos-tab-trigger.is-active::after {
            opacity: 1;
            transform: scaleX(1);
            animation: productionEosTabIndicator 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
          }

          .production-eos-tab-trigger.is-active .production-eos-tab-label {
            position: relative;
            z-index: 1;
            display: inline-block;
            animation: productionEosTabPress 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
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
            .production-eos-tab-trigger.is-active::after,
            .production-eos-tab-trigger.is-active .production-eos-tab-label,
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
    <section className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <div className="mb-3 flex min-h-[34px] items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-gray-950 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
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
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-normal text-gray-950 dark:text-white">{value || '--'}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${colors[tone]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-bold">
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
          <div key={`${item.name}-${item.dataKey}`} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="font-semibold text-gray-600 dark:text-gray-300">{item.name}:</span>
            <span className="font-black text-gray-900 dark:text-white">
              {String(item.dataKey).toLowerCase().includes('pct') ? `${Number(item.value || 0).toFixed(1)}%` : formatNumber(item.value, 1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
