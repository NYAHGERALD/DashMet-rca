'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import ImageCropModal from '@/components/ui/ImageCropModal';
import PhotoLightbox from '@/components/ui/PhotoLightbox';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Camera,
  Trash2,
  Eye,
  Edit,
  Building2,
  MapPin,
  Layers,
  Timer,
  Settings,
  Package,
  XCircle,
  Cpu,
  ArrowUp,
  ArrowDown,
  ListFilter,
  Maximize2,
  Minimize2,
  GripHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Department { id: string; name: string; }
interface Area { id: string; name: string; departmentId?: string; }
interface Line { id: string; name: string; lineNumber?: string; areaId?: string; }
interface Shift { id: string; name: string; startTime?: string; endTime?: string; lineIds?: string[]; areaIds?: string[]; departmentIds?: string[]; }
interface Equipment { id: string; name: string; assetTag?: string; lineId?: string; }
interface ComponentItem { id: string; name: string; partNumber?: string; equipmentId?: string; }

interface MachineIssue {
  id: string;
  issueNumber: string;
  type: 'MACHINE' | 'QUALITY';
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  photos: { url: string; name: string }[];
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
  Department?: { id: string; name: string };
  Area?: { id: string; name: string };
  Line?: { id: string; name: string; lineNumber?: string };
  Shift?: { id: string; name: string; startTime?: string; endTime?: string };
  Equipment?: { id: string; name: string; assetTag?: string; manufacturer?: string; model?: string; photos?: { url: string; name: string }[] };
  Component?: { id: string; name: string; partNumber?: string; manufacturer?: string; photos?: { url: string; name: string }[] };
  ReportedBy?: { id: string; firstName: string; lastName: string; email?: string };
  ResolvedBy?: { id: string; firstName: string; lastName: string };
}

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

type IssueType = 'MACHINE' | 'QUALITY';
type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const priorityConfig: Record<IssuePriority, { label: string; color: string; bg: string }> = {
  LOW: { label: 'Low', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  HIGH: { label: 'High', color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  CRITICAL: { label: 'Critical', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40' },
};

const statusConfig: Record<IssueStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  OPEN: { label: 'Open', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40', icon: AlertCircle },
  IN_PROGRESS: { label: 'In Progress', color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-100 dark:bg-yellow-900/40', icon: Clock },
  RESOLVED: { label: 'Resolved', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/40', icon: CheckCircle },
  CLOSED: { label: 'Closed', color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-700/40', icon: XCircle },
};

// ─── Component ──────────────────────────────────────────────────────────────────

export default function OperationsPage() {
  const router = useRouter();
  const { user } = useAuth();

  // ─── Data state ─────────────────────────────────────────────────────────────
  const [issues, setIssues] = useState<MachineIssue[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const loadingMessages = useMemo(() => ['Hang tight...', 'Fetching your results...', 'Loading issues...', 'Almost there...', 'Gathering data...'], []);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ─── Filters ────────────────────────────────────────────────────────────────
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterLine, setFilterLine] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ─── Dynamic Filter Panel ───────────────────────────────────────────────────
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const filterPickerRef = useRef<HTMLDivElement>(null);

  const ALL_FILTER_TYPES = [
    { key: 'search', label: 'Search' },
    { key: 'department', label: 'Department' },
    { key: 'area', label: 'Area' },
    { key: 'line', label: 'Line' },
    { key: 'shift', label: 'Shift' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
  ] as const;

  const availableFilters = ALL_FILTER_TYPES.filter(f => !activeFilters.includes(f.key));

  const addFilter = (key: string) => {
    if (!activeFilters.includes(key)) {
      setActiveFilters(prev => [...prev, key]);
    }
    setShowFilterPicker(false);
  };

  const removeFilter = (key: string) => {
    setActiveFilters(prev => prev.filter(k => k !== key));
    // Clear filter value when removed
    const clearMap: Record<string, () => void> = {
      search: () => setSearchQuery(''),
      department: () => { setFilterDepartment(''); setFilterArea(''); setFilterLine(''); },
      area: () => { setFilterArea(''); setFilterLine(''); },
      line: () => setFilterLine(''),
      shift: () => setFilterShift(''),
      type: () => setFilterType(''),
      status: () => setFilterStatus(''),
      priority: () => setFilterPriority(''),
    };
    clearMap[key]?.();
  };

  // ─── Context Menu ───────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'column' | 'row'; column?: string; issue?: MachineIssue } | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // ─── Modals ─────────────────────────────────────────────────────────────────
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<MachineIssue | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ─── Report Form ────────────────────────────────────────────────────────────
  const [formType, setFormType] = useState<IssueType>('MACHINE');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<IssuePriority>('MEDIUM');
  const [formDepartment, setFormDepartment] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formLine, setFormLine] = useState('');
  const [formShift, setFormShift] = useState('');
  const [formEquipment, setFormEquipment] = useState('');
  const [formComponent, setFormComponent] = useState('');

  // ─── Quality Issue checkboxes ───────────────────────────────────────────────
  const [qualityAddEquipment, setQualityAddEquipment] = useState(false);
  const [qualityAddComponent, setQualityAddComponent] = useState(false);

  // ─── Photo state ────────────────────────────────────────────────────────────
  const [pendingPhotos, setPendingPhotos] = useState<{ file: File; preview: string; name: string; croppedBlob?: Blob }[]>([]);
  const [cropImage, setCropImage] = useState<{ src: string; fileName: string; index: number } | null>(null);
  const [editingPhotoName, setEditingPhotoName] = useState<number | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<{ url: string; name: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [heicProcessing, setHeicProcessing] = useState<{ active: boolean; current: number; total: number; fileName: string } | null>(null);
  const [photoLimitError, setPhotoLimitError] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean; current: number; total: number } | null>(null);
  const [photoSelectMode, setPhotoSelectMode] = useState(false);
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<Set<string>>(new Set());
  const [deletingSelectedPhotos, setDeletingSelectedPhotos] = useState(false);

  // ─── Status Update ──────────────────────────────────────────────────────────
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // ─── Edit Mode ──────────────────────────────────────────────────────────────
  const [editingIssue, setEditingIssue] = useState<MachineIssue | null>(null);

  // ─── Inline Cell Editing ────────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ issueId: string; column: string } | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const inlineEditRef = useRef<HTMLDivElement>(null);

  const startCellEdit = (e: React.MouseEvent, issueId: string, column: string, currentValue?: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 2, left: rect.left });
    setEditingCell({ issueId, column });
    if (column === 'title' && currentValue !== undefined) {
      setEditingTitleValue(currentValue);
    }
  };

  const saveCellEdit = async (issueId: string, field: string, value: string | null) => {
    setEditingCell(null);

    // Build cascading updates: when a parent changes, auto-select first child values
    const issue = issues.find(i => i.id === issueId);
    const updates: Record<string, string | null> = { [field]: value };

    if (field === 'departmentId') {
      // Department changed → cascade Area → Line → Shift + Equipment → Component
      const filteredAreas = value ? areas.filter(a => a.departmentId === value) : [];
      const firstArea = filteredAreas[0] || null;
      updates.areaId = firstArea?.id || null;

      const filteredLines = firstArea ? lines.filter(l => l.areaId === firstArea.id) : [];
      const firstLine = filteredLines[0] || null;
      updates.lineId = firstLine?.id || null;

      // Cascade shift based on new line
      const filteredShifts = firstLine ? shifts.filter(s => s.lineIds?.includes(firstLine.id)) : [];
      updates.shiftId = filteredShifts[0]?.id || null;

      const filteredEquip = firstLine ? equipment.filter(eq => eq.lineId === firstLine.id) : [];
      const firstEquip = filteredEquip[0] || null;
      updates.equipmentId = firstEquip?.id || null;

      const filteredComps = firstEquip ? components.filter(c => c.equipmentId === firstEquip.id) : [];
      updates.componentId = filteredComps[0]?.id || null;
    } else if (field === 'areaId') {
      // Area changed → cascade Line → Shift + Equipment → Component
      const filteredLines = value ? lines.filter(l => l.areaId === value) : [];
      const firstLine = filteredLines[0] || null;
      updates.lineId = firstLine?.id || null;

      const filteredShifts = firstLine ? shifts.filter(s => s.lineIds?.includes(firstLine.id)) : [];
      updates.shiftId = filteredShifts[0]?.id || null;

      const filteredEquip = firstLine ? equipment.filter(eq => eq.lineId === firstLine.id) : [];
      const firstEquip = filteredEquip[0] || null;
      updates.equipmentId = firstEquip?.id || null;

      const filteredComps = firstEquip ? components.filter(c => c.equipmentId === firstEquip.id) : [];
      updates.componentId = filteredComps[0]?.id || null;
    } else if (field === 'lineId') {
      // Line changed → cascade Shift + Equipment → Component
      const filteredShifts = value ? shifts.filter(s => s.lineIds?.includes(value)) : [];
      updates.shiftId = filteredShifts[0]?.id || null;

      const filteredEquip = value ? equipment.filter(eq => eq.lineId === value) : [];
      const firstEquip = filteredEquip[0] || null;
      updates.equipmentId = firstEquip?.id || null;

      const filteredComps = firstEquip ? components.filter(c => c.equipmentId === firstEquip.id) : [];
      updates.componentId = filteredComps[0]?.id || null;
    } else if (field === 'equipmentId') {
      // Equipment changed → cascade Component
      const filteredComps = value ? components.filter(c => c.equipmentId === value) : [];
      updates.componentId = filteredComps[0]?.id || null;
    }

    // Optimistic update — reflect all cascaded changes in UI immediately
    setIssues(prev => prev.map(i => {
      if (i.id !== issueId) return i;
      return { ...i, ...updates };
    }));
    if (selectedIssue?.id === issueId) {
      setSelectedIssue(prev => prev ? { ...prev, ...updates } : prev);
    }
    try {
      const res = await api.patch(`/operations/issues/${issueId}`, updates);
      if (res.data.success) {
        // Reconcile with server response (includes relation data)
        setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...res.data.data } : i));
        if (selectedIssue?.id === issueId) {
          setSelectedIssue(prev => prev ? { ...prev, ...res.data.data } : prev);
        }
      }
    } catch {
      // Revert on failure — reload issues
      setError('Failed to update');
      setTimeout(() => setError(''), 3000);
      loadIssues();
    }
  };

  // Close inline edit on outside click
  useEffect(() => {
    if (!editingCell) return;
    const handler = (e: MouseEvent) => {
      if (inlineEditRef.current && !inlineEditRef.current.contains(e.target as Node)) {
        // For title, save on blur
        if (editingCell.column === 'title' && editingTitleValue.trim()) {
          const issue = issues.find(i => i.id === editingCell.issueId);
          if (issue && editingTitleValue.trim() !== issue.title) {
            saveCellEdit(editingCell.issueId, 'title', editingTitleValue.trim());
          } else {
            setEditingCell(null);
          }
        } else {
          setEditingCell(null);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingCell, editingTitleValue, issues]);

  // ─── Draggable / Resizable Modals ──────────────────────────────────────────
  const [reportModalPos, setReportModalPos] = useState({ x: 0, y: 0 });
  const [reportModalSize, setReportModalSize] = useState({ w: 672, h: 0 }); // 0 = auto
  const [reportMaximized, setReportMaximized] = useState(false);
  const [detailModalPos, setDetailModalPos] = useState({ x: 0, y: 0 });
  const [detailModalSize, setDetailModalSize] = useState({ w: 768, h: 0 });
  const [detailMaximized, setDetailMaximized] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; modal: 'report' | 'detail' } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; modal: 'report' | 'detail' } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent, modal: 'report' | 'detail') => {
    e.preventDefault();
    const el = modal === 'report' ? reportModalRef.current : detailModalRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = rect.left + rect.width / 2 - window.innerWidth / 2;
    const origY = rect.top + rect.height / 2 - window.innerHeight / 2;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const setPos = modal === 'report' ? setReportModalPos : setDetailModalPos;
      setPos({ x: origX + dx, y: origY + dy });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent, modal: 'report' | 'detail', el: HTMLDivElement | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: rect.width, origH: rect.height, modal };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startX;
      const dy = ev.clientY - resizeRef.current.startY;
      const setSize = resizeRef.current.modal === 'report' ? setReportModalSize : setDetailModalSize;
      setSize({ w: Math.max(500, resizeRef.current.origW + dx), h: Math.max(400, resizeRef.current.origH + dy) });
    };
    const onUp = () => { resizeRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const reportModalRef = useRef<HTMLDivElement>(null);
  const detailModalRef = useRef<HTMLDivElement>(null);

  const resetReportModal = useCallback(() => { setReportModalPos({ x: 0, y: 0 }); setReportModalSize({ w: 672, h: 0 }); setReportMaximized(false); }, []);
  const resetDetailModal = useCallback(() => { setDetailModalPos({ x: 0, y: 0 }); setDetailModalSize({ w: 768, h: 0 }); setDetailMaximized(false); setPhotoSelectMode(false); setSelectedPhotoUrls(new Set()); }, []);

  // ─── Filtered dropdown data (cascade) ─────────────────────────────────────
  const filteredAreas = filterDepartment ? areas.filter(a => a.departmentId === filterDepartment) : areas;
  const filteredLines = filterArea ? lines.filter(l => l.areaId === filterArea) : lines;

  const formFilteredAreas = formDepartment ? areas.filter(a => a.departmentId === formDepartment) : areas;
  const formFilteredLines = formArea ? lines.filter(l => l.areaId === formArea) : lines;
  const formFilteredEquipment = formLine ? equipment.filter(e => e.lineId === formLine) : equipment;
  const formFilteredComponents = formEquipment ? components.filter(c => c.equipmentId === formEquipment) : [];

  // ─── Hierarchy: fields disabled until parent selected ─────────────────────
  const isAreaDisabled = !formDepartment;
  const isLineDisabled = !formArea;
  const isShiftDisabled = !formDepartment;
  const isEquipmentDisabled = formType === 'QUALITY' ? !qualityAddEquipment : !formLine;
  const isComponentDisabled = formType === 'QUALITY' ? !qualityAddComponent : !formEquipment;

  // ─── Active filter count ──────────────────────────────────────────────────
  const activeFilterCount = [filterDepartment, filterArea, filterLine, filterShift, filterType, filterStatus, filterPriority, searchQuery].filter(Boolean).length;

  // ─── Context menu handlers ────────────────────────────────────────────────
  const handleColumnContextMenu = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'column', column });
  }, []);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, issue: MachineIssue) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'row', issue });
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // ─── Sorting ──────────────────────────────────────────────────────────────
  const columnKeyMap: Record<string, (issue: MachineIssue) => string> = {
    'Issue #': (i) => i.issueNumber,
    'Title': (i) => i.title,
    'Type': (i) => i.type,
    'Status': (i) => i.status,
    'Priority': (i) => i.priority,
    'Department': (i) => i.Department?.name || '',
    'Area': (i) => i.Area?.name || '',
    'Line': (i) => i.Line?.name || '',
    'Shift': (i) => i.Shift?.name || '',
    'Equipment': (i) => i.Equipment?.name || '',
    'Component': (i) => i.Component?.name || '',
    'Reported By': (i) => i.ReportedBy ? `${i.ReportedBy.firstName} ${i.ReportedBy.lastName}` : '',
    'Date': (i) => i.createdAt,
  };

  const sortedIssues = (() => {
    if (!sortColumn || !columnKeyMap[sortColumn]) return issues;
    const getter = columnKeyMap[sortColumn];
    return [...issues].sort((a, b) => {
      const aVal = getter(a).toLowerCase();
      const bVal = getter(b).toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  })();

  const handleSort = (column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
    setContextMenu(null);
  };

  const handleFilterByColumn = (column: string) => {
    // Map column name to filter key and add it to the panel
    const columnToFilterKey: Record<string, string> = {
      'Type': 'type',
      'Status': 'status',
      'Priority': 'priority',
      'Department': 'department',
      'Area': 'area',
      'Line': 'line',
      'Shift': 'shift',
    };
    const filterKey = columnToFilterKey[column];
    if (filterKey) {
      addFilter(filterKey);
      setShowFilters(true);
    }
    setContextMenu(null);
  };

  // ─── Load dropdown data ──────────────────────────────────────────────────
  const loadDropdownData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get('/facilities/departments'),
      api.get('/facilities/areas'),
      api.get('/facilities/lines'),
      api.get('/facilities/shifts'),
      api.get('/equipment'),
      api.get('/equipment/components/all'),
    ]);
    const [deptRes, areaRes, lineRes, shiftRes, equipRes, compRes] = results;

    if (deptRes.status === 'fulfilled') {
      const depts = deptRes.value.data?.data?.departments || deptRes.value.data?.departments || [];
      setDepartments(depts);
    }
    if (areaRes.status === 'fulfilled') {
      const a = areaRes.value.data?.data?.areas || areaRes.value.data?.areas || [];
      setAreas(a);
    }
    if (lineRes.status === 'fulfilled') {
      const l = lineRes.value.data?.data?.lines || lineRes.value.data?.lines || [];
      setLines(l);
    }
    if (shiftRes.status === 'fulfilled') {
      const s = shiftRes.value.data?.data?.shifts || shiftRes.value.data?.shifts || [];
      setShifts(s.map((shift: any) => {
        const lineIds = shift.ShiftLine?.map((sl: any) => sl.lineId || sl.Line?.id).filter(Boolean) || [];
        const areaIds = [...new Set(shift.ShiftLine?.map((sl: any) => sl.Line?.Area?.id).filter(Boolean) || [])];
        const departmentIds = [...new Set(shift.ShiftLine?.map((sl: any) => sl.Line?.Area?.Department?.id).filter(Boolean) || [])];
        return { ...shift, lineIds, areaIds, departmentIds };
      }));
    }
    if (equipRes.status === 'fulfilled') {
      const eq = equipRes.value.data?.data?.equipment || equipRes.value.data?.equipment || [];
      setEquipment(eq);
    }
    if (compRes.status === 'fulfilled') {
      const c = compRes.value.data?.data?.components || compRes.value.data?.components || [];
      setComponents(c);
    }
  }, []);

  // ─── Load components when equipment changes (form only) ────────────────────
  useEffect(() => {
    if (formEquipment) {
      api.get(`/equipment/${formEquipment}/components`)
        .then(res => setComponents(res.data?.data?.components || []))
        .catch(() => {});
    } else {
      setFormComponent('');
    }
  }, [formEquipment]);

  // ─── Load issues ─────────────────────────────────────────────────────────
  const loadIssues = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterDepartment) params.departmentId = filterDepartment;
      if (filterArea) params.areaId = filterArea;
      if (filterLine) params.lineId = filterLine;
      if (filterShift) params.shiftId = filterShift;
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      if (searchQuery) params.search = searchQuery;

      const [issuesRes, statsRes] = await Promise.all([
        api.get('/operations/issues', { params }),
        api.get('/operations/stats'),
      ]);

      setIssues(issuesRes.data?.data || []);
      setStats(statsRes.data?.data || { total: 0, open: 0, inProgress: 0, resolved: 0 });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [filterDepartment, filterArea, filterLine, filterShift, filterType, filterStatus, filterPriority, searchQuery]);

  useEffect(() => { loadDropdownData(); }, [loadDropdownData]);
  useEffect(() => { loadIssues(); }, [loadIssues]);

  // ─── Fetch full issue detail (includes equipment/component photos) ────────
  const openIssueDetail = useCallback(async (issue: MachineIssue) => {
    setSelectedIssue(issue);
    setShowDetailModal(true);
    setShowResolutionInput(false);
    setResolutionText(issue.resolution || '');
    setDetailPendingPhotos([]);
    try {
      const res = await api.get(`/operations/issues/${issue.id}`);
      if (res.data?.data) setSelectedIssue(res.data.data);
    } catch {}
  }, []);

  // ─── Rotate loading messages ──────────────────────────────────────────────
  useEffect(() => {
    if (!loading) { setLoadingMsgIdx(0); return; }
    const t = setInterval(() => setLoadingMsgIdx(i => (i + 1) % loadingMessages.length), 2000);
    return () => clearInterval(t);
  }, [loading, loadingMessages]);

  // ─── Close filter picker on outside click ─────────────────────────────────
  useEffect(() => {
    if (!showFilterPicker) return;
    const handler = (e: MouseEvent) => {
      if (filterPickerRef.current && !filterPickerRef.current.contains(e.target as Node)) {
        setShowFilterPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterPicker]);

  // ─── Clear success/error after 4s ─────────────────────────────────────────
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(''), 6000); return () => clearTimeout(t); }
  }, [error]);

  // ─── Clear filters ────────────────────────────────────────────────────────
  const clearFilters = () => {
    setFilterDepartment(''); setFilterArea(''); setFilterLine(''); setFilterShift('');
    setFilterType(''); setFilterStatus(''); setFilterPriority(''); setSearchQuery('');
  };

  // ─── Report Issue ─────────────────────────────────────────────────────────
  const openReportModal = (issueToEdit?: MachineIssue) => {
    if (issueToEdit) {
      setEditingIssue(issueToEdit);
      setFormType(issueToEdit.type);
      setFormTitle(issueToEdit.title);
      setFormDescription(issueToEdit.description);
      setFormPriority(issueToEdit.priority);
      setFormDepartment(issueToEdit.Department?.id || '');
      setFormArea(issueToEdit.Area?.id || '');
      setFormLine(issueToEdit.Line?.id || '');
      setFormShift(issueToEdit.Shift?.id || '');
      setFormEquipment(issueToEdit.Equipment?.id || '');
      setFormComponent(issueToEdit.Component?.id || '');
      // For Quality issues being edited, enable checkboxes if equipment/component were set
      if (issueToEdit.type === 'QUALITY') {
        setQualityAddEquipment(!!issueToEdit.Equipment?.id);
        setQualityAddComponent(!!issueToEdit.Component?.id);
      } else {
        setQualityAddEquipment(false);
        setQualityAddComponent(false);
      }
    } else {
      setEditingIssue(null);
      setFormType('MACHINE');
      setFormTitle('');
      setFormDescription('');
      setFormPriority('MEDIUM');
      setFormDepartment('');
      setFormArea('');
      setFormLine('');
      setFormShift('');
      setFormEquipment('');
      setFormComponent('');
      setQualityAddEquipment(false);
      setQualityAddComponent(false);
    }
    setPendingPhotos([]);
    setShowReportModal(true);
  };

  const handleSubmitIssue = async () => {
    if (!formTitle.trim() || !formDescription.trim() || !formDepartment) {
      setError('Title, Description, and Department are required');
      return;
    }

    setSubmitting(true);
    try {
      let issueId: string;

      if (editingIssue) {
        // Update existing
        const res = await api.patch(`/operations/issues/${editingIssue.id}`, {
          type: formType,
          title: formTitle.trim(),
          description: formDescription.trim(),
          priority: formPriority,
          departmentId: formDepartment,
          areaId: formArea || null,
          lineId: formLine || null,
          shiftId: formShift || null,
          equipmentId: formEquipment || null,
          componentId: formComponent || null,
        });
        issueId = editingIssue.id;
        setSuccess('Issue updated successfully');
      } else {
        // Create new
        const res = await api.post('/operations/issues', {
          type: formType,
          title: formTitle.trim(),
          description: formDescription.trim(),
          priority: formPriority,
          departmentId: formDepartment,
          areaId: formArea || null,
          lineId: formLine || null,
          shiftId: formShift || null,
          equipmentId: formEquipment || null,
          componentId: formComponent || null,
        });
        issueId = res.data?.data?.id;
        setSuccess('Issue reported successfully');
      }

      // Upload photos if any
      if (pendingPhotos.length > 0 && issueId) {
        setUploadProgress({ active: true, current: 0, total: pendingPhotos.length });
        const formData = new FormData();
        pendingPhotos.forEach((photo, i) => {
          const fileToUpload = photo.croppedBlob
            ? new File([photo.croppedBlob], photo.name, { type: 'image/jpeg' })
            : photo.file;
          formData.append('photos', fileToUpload);
          formData.append(`name_${i}`, photo.name);
        });
        setUploadProgress({ active: true, current: Math.ceil(pendingPhotos.length * 0.3), total: pendingPhotos.length });
        await api.post(`/operations/issues/${issueId}/photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUploadProgress({ active: true, current: pendingPhotos.length, total: pendingPhotos.length });
      }

      setShowReportModal(false);
      loadIssues();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit issue');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  // ─── Photo handling ───────────────────────────────────────────────────────
  const convertHeicToJpeg = async (file: File): Promise<File> => {
    const libheif = (await import('libheif-js/wasm-bundle')).default || (await import('libheif-js/wasm-bundle'));
    const buffer = await file.arrayBuffer();
    const decoder = new libheif.HeifDecoder();
    const data = decoder.decode(new Uint8Array(buffer));
    if (!data || data.length === 0) throw new Error('No images found in HEIC file');
    const image = data[0];
    const width = image.get_width();
    const height = image.get_height();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);

    await new Promise<void>((resolve, reject) => {
      image.display(imageData, (displayData: any) => {
        if (!displayData) { reject(new Error('HEIC decode failed')); return; }
        resolve();
      });
    });

    ctx.putImageData(imageData, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', 0.92);
    });
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (files.length > 15) { setPhotoLimitError(true); return; }
    const heicFiles = files.filter(f => /\.(heic|heif)$/i.test(f.name) || f.type === 'image/heic' || f.type === 'image/heif');
    const normalFiles = files.filter(f => !(/\.(heic|heif)$/i.test(f.name) || f.type === 'image/heic' || f.type === 'image/heif'));

    // Add normal files immediately
    if (normalFiles.length > 0) {
      const normals = normalFiles.map(f => ({ file: f, preview: URL.createObjectURL(f), name: f.name.replace(/\.[^/.]+$/, '') }));
      setPendingPhotos(prev => [...prev, ...normals]);
    }

    // Process HEIC files with progress
    if (heicFiles.length > 0) {
      setHeicProcessing({ active: true, current: 0, total: heicFiles.length, fileName: heicFiles[0].name });
      const results: typeof pendingPhotos = [];
      for (let i = 0; i < heicFiles.length; i++) {
        const f = heicFiles[i];
        setHeicProcessing({ active: true, current: i + 1, total: heicFiles.length, fileName: f.name });
        try {
          const converted = await convertHeicToJpeg(f);
          results.push({ file: converted, preview: URL.createObjectURL(converted), name: f.name.replace(/\.[^/.]+$/, '') });
        } catch (err: any) {
          console.error('HEIC conversion failed:', err);
        }
      }
      setPendingPhotos(prev => [...prev, ...results]);
      setHeicProcessing(null);
    }
  };

  const removePhoto = (index: number) => {
    setPendingPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleCropComplete = (blob: Blob) => {
    if (cropImage === null) return;
    setPendingPhotos(prev => prev.map((p, i) => i === cropImage.index ? { ...p, croppedBlob: blob, preview: URL.createObjectURL(blob) } : p));
    setCropImage(null);
  };

  const handleUseOriginal = () => {
    if (cropImage === null) return;
    setPendingPhotos(prev => prev.map((p, i) => i === cropImage.index ? { ...p, croppedBlob: undefined } : p));
    setCropImage(null);
  };

  // ─── Status update ────────────────────────────────────────────────────────
  const updateIssueStatus = async (issueId: string, newStatus: IssueStatus) => {
    setUpdatingStatus(issueId);
    try {
      await api.patch(`/operations/issues/${issueId}`, { status: newStatus });
      setSuccess(`Status updated to ${statusConfig[newStatus].label}`);
      loadIssues();
      if (selectedIssue?.id === issueId) {
        setSelectedIssue(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // ─── Delete photo from existing issue ─────────────────────────────────────
  const deleteExistingPhoto = async (issueId: string, photoUrl: string) => {
    try {
      await api.delete(`/operations/issues/${issueId}/photos`, { data: { photoUrl } });
      setSuccess('Photo deleted');
      loadIssues();
      if (selectedIssue?.id === issueId) {
        setSelectedIssue(prev => prev ? { ...prev, photos: prev.photos.filter(p => p.url !== photoUrl) } : null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete photo');
    }
  };

  const bulkDeletePhotos = async () => {
    if (!selectedIssue || selectedPhotoUrls.size === 0) return;
    if (!confirm(`Delete ${selectedPhotoUrls.size} selected photo${selectedPhotoUrls.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setDeletingSelectedPhotos(true);
    try {
      const res = await api.delete(`/operations/issues/${selectedIssue.id}/photos`, {
        data: { photoUrls: Array.from(selectedPhotoUrls) },
      });
      setSuccess(`${selectedPhotoUrls.size} photo${selectedPhotoUrls.size !== 1 ? 's' : ''} deleted`);
      setSelectedPhotoUrls(new Set());
      setPhotoSelectMode(false);
      loadIssues();
      if (res.data?.data?.photos) {
        setSelectedIssue(prev => prev ? { ...prev, photos: res.data.data.photos } : null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete photos');
    } finally {
      setDeletingSelectedPhotos(false);
    }
  };

  // ─── Rename existing photo ────────────────────────────────────────────────
  const renameExistingPhoto = async (issueId: string, photoUrl: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const res = await api.patch(`/operations/issues/${issueId}/photos/rename`, { photoUrl, newName: newName.trim() });
      setSelectedIssue(prev => prev ? { ...prev, photos: res.data.data.photos } : null);
      setRenamingExistingPhoto(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to rename photo');
    }
  };

  // ─── Upload photos to existing issue ──────────────────────────────────────
  const [uploadingToIssue, setUploadingToIssue] = useState(false);
  const [detailPendingPhotos, setDetailPendingPhotos] = useState<{ file: File; preview: string; name: string; croppedBlob?: Blob }[]>([]);
  const [detailCropImage, setDetailCropImage] = useState<{ src: string; fileName: string; index: number } | null>(null);
  const [detailEditingName, setDetailEditingName] = useState<number | null>(null);
  const [renamingExistingPhoto, setRenamingExistingPhoto] = useState<number | null>(null);
  const [existingPhotoName, setExistingPhotoName] = useState('');
  const detailPhotoInputRef = useRef<HTMLInputElement>(null);
  const detailReadyRef = useRef<HTMLDivElement>(null);

  const handleDetailPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (detailPhotoInputRef.current) detailPhotoInputRef.current.value = '';
    if (files.length > 15) { setPhotoLimitError(true); return; }
    const heicFiles = files.filter(f => /\.(heic|heif)$/i.test(f.name) || f.type === 'image/heic' || f.type === 'image/heif');
    const normalFiles = files.filter(f => !(/\.(heic|heif)$/i.test(f.name) || f.type === 'image/heic' || f.type === 'image/heif'));

    // Add normal files immediately
    if (normalFiles.length > 0) {
      const normals = normalFiles.map(f => ({ file: f, preview: URL.createObjectURL(f), name: f.name.replace(/\.[^/.]+$/, '') }));
      setDetailPendingPhotos(prev => [...prev, ...normals]);
    }

    // Process HEIC files with progress
    if (heicFiles.length > 0) {
      setHeicProcessing({ active: true, current: 0, total: heicFiles.length, fileName: heicFiles[0].name });
      const results: typeof detailPendingPhotos = [];
      for (let i = 0; i < heicFiles.length; i++) {
        const f = heicFiles[i];
        setHeicProcessing({ active: true, current: i + 1, total: heicFiles.length, fileName: f.name });
        try {
          const converted = await convertHeicToJpeg(f);
          results.push({ file: converted, preview: URL.createObjectURL(converted), name: f.name.replace(/\.[^/.]+$/, '') });
        } catch (err: any) {
          console.error('HEIC conversion failed:', err);
        }
      }
      setDetailPendingPhotos(prev => [...prev, ...results]);
      setHeicProcessing(null);
    }

    setTimeout(() => detailReadyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
  };

  const uploadDetailPhotos = async () => {
    if (!selectedIssue || detailPendingPhotos.length === 0) return;
    setUploadingToIssue(true);
    setUploadProgress({ active: true, current: 0, total: detailPendingPhotos.length });
    try {
      const formData = new FormData();
      detailPendingPhotos.forEach((photo, i) => {
        const fileToUpload = photo.croppedBlob
          ? new File([photo.croppedBlob], photo.name, { type: 'image/jpeg' })
          : photo.file;
        formData.append('photos', fileToUpload);
        formData.append(`name_${i}`, photo.name);
      });
      setUploadProgress({ active: true, current: Math.ceil(detailPendingPhotos.length * 0.3), total: detailPendingPhotos.length });
      const res = await api.post(`/operations/issues/${selectedIssue.id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadProgress({ active: true, current: detailPendingPhotos.length, total: detailPendingPhotos.length });
      setDetailPendingPhotos([]);
      setSuccess('Photos uploaded');
      loadIssues();
      if (res.data?.data?.photos) {
        setSelectedIssue(prev => prev ? { ...prev, photos: res.data.data.photos } : null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to upload photos');
    } finally {
      setUploadingToIssue(false);
      setUploadProgress(null);
    }
  };

  // ─── Delete issue ─────────────────────────────────────────────────────────
  const deleteIssue = async (issueId: string) => {
    if (!confirm('Are you sure you want to delete this issue? This action cannot be undone.')) return;
    try {
      await api.delete(`/operations/issues/${issueId}`);
      setSuccess('Issue deleted');
      setShowDetailModal(false);
      setSelectedIssue(null);
      loadIssues();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete issue');
    }
  };

  // ─── Resolution ───────────────────────────────────────────────────────────
  const [showResolutionInput, setShowResolutionInput] = useState(false);
  const [resolutionText, setResolutionText] = useState('');

  const submitResolution = async () => {
    if (!selectedIssue || !resolutionText.trim()) return;
    try {
      await api.patch(`/operations/issues/${selectedIssue.id}`, { resolution: resolutionText.trim(), status: 'RESOLVED' });
      setSuccess('Issue resolved');
      setShowResolutionInput(false);
      setResolutionText('');
      loadIssues();
      setSelectedIssue(prev => prev ? { ...prev, status: 'RESOLVED', resolution: resolutionText.trim() } : null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to resolve issue');
    }
  };

  // ─── Next status helper ────────────────────────────────────────────────────
  const getNextStatuses = (current: IssueStatus): IssueStatus[] => {
    switch (current) {
      case 'OPEN': return ['IN_PROGRESS'];
      case 'IN_PROGRESS': return ['RESOLVED'];
      case 'RESOLVED': return ['CLOSED', 'OPEN']; // Can reopen or close
      case 'CLOSED': return ['OPEN']; // Can reopen
      default: return [];
    }
  };

  return (
    <ProtectedRoute>
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 w-full overflow-hidden">
        {/* ─── Header ────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-[#3aa8e8]" />
                    Operations
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Machine & Quality Issue Tracking</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadIssues()}
                  className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => openReportModal()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#3aa8e8] hover:bg-[#2d8abf] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Report Issue
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Toast Messages ────────────────────────────────────────── */}
        {success && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-right">
            <CheckCircle className="w-4 h-4" /> {success}
          </div>
        )}
        {error && (
          <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-right">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 w-full px-2 sm:px-3 lg:px-4 py-4">
          {/* ─── Search Bar ──────────────────────────────────────── */}
          <div className="flex-shrink-0 flex items-center justify-center mb-3">
            <div className="flex items-center w-full max-w-2xl bg-white dark:bg-gray-800 rounded-full shadow-sm border-2 border-gray-900 dark:border-gray-300 focus-within:ring-2 focus-within:ring-[#3aa8e8] focus-within:border-[#3aa8e8] transition-all">
              <span className="pl-4 pr-2 text-sm font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap select-none">Search</span>
              <div className="w-px h-5 bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Issues, equipment, descriptions..."
                className="flex-1 px-3 py-2 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none rounded-r-full"
                title="Search issues"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {!searchQuery && (
                <div className="pr-3 text-gray-400">
                  <Search className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>

          {/* ─── Main Layout: Filter Panel + Table ────────────────── */}
          <div className={`flex flex-1 min-h-0 ${showFilters ? 'gap-3' : 'gap-0'}`}>
            {/* ─── Slide-out Filter Panel ─────────────────────────── */}
            <div
              className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                showFilters ? 'w-[260px] opacity-100' : 'w-0 opacity-0'
              }`}
            >
              <div className="w-[260px] h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                {/* Filter Panel Header */}
                <div className="px-4 py-2.5 bg-[#3aa8e8] dark:bg-[#2d8abf] border-b border-[#3aa8e8]/20 flex items-center justify-between flex-shrink-0 rounded-t-xl">
                  <span className="text-sm font-semibold text-white uppercase tracking-wider">Filters</span>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-1 text-white/70 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
                    title="Close filters"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Active Filters - Scrollable */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {activeFilters.map(key => {
                    const filterDef = ALL_FILTER_TYPES.find(f => f.key === key);
                    if (!filterDef) return null;
                    return (
                      <div key={key} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {filterDef.label}
                          </label>
                          <button
                            onClick={() => removeFilter(key)}
                            className="p-0.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title={`Remove ${filterDef.label} filter`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {key === 'search' && (
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search issues..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        {key === 'department' && (
                          <select
                            value={filterDepartment}
                            onChange={(e) => { setFilterDepartment(e.target.value); setFilterArea(''); setFilterLine(''); }}
                            className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            title="Filter by Department"
                          >
                            <option value="">All Departments</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        )}

                        {key === 'area' && (
                          <select
                            value={filterArea}
                            onChange={(e) => { setFilterArea(e.target.value); setFilterLine(''); }}
                            className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            title="Filter by Area"
                          >
                            <option value="">All Areas</option>
                            {filteredAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        )}

                        {key === 'line' && (
                          <select
                            value={filterLine}
                            onChange={(e) => setFilterLine(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            title="Filter by Line"
                          >
                            <option value="">All Lines</option>
                            {filteredLines.map(l => <option key={l.id} value={l.id}>{l.name}{l.lineNumber ? ` (${l.lineNumber})` : ''}</option>)}
                          </select>
                        )}

                        {key === 'shift' && (
                          <select
                            value={filterShift}
                            onChange={(e) => setFilterShift(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            title="Filter by Shift"
                          >
                            <option value="">All Shifts</option>
                            {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        )}

                        {key === 'type' && (
                          <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            title="Filter by Type"
                          >
                            <option value="">All Types</option>
                            <option value="MACHINE">Machine</option>
                            <option value="QUALITY">Quality</option>
                          </select>
                        )}

                        {key === 'status' && (
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            title="Filter by Status"
                          >
                            <option value="">All Statuses</option>
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="CLOSED">Closed</option>
                          </select>
                        )}

                        {key === 'priority' && (
                          <select
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            title="Filter by Priority"
                          >
                            <option value="">All Priorities</option>
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="CRITICAL">Critical</option>
                          </select>
                        )}
                      </div>
                    );
                  })}

                  {activeFilters.length === 0 && (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                      <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No filters added</p>
                      <p className="text-xs mt-0.5">Click <span className="font-semibold">+ Add Filter</span> below</p>
                    </div>
                  )}
                </div>

                {/* Add Filter Button + Picker */}
                <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2 relative">
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Clear All ({activeFilterCount})
                    </button>
                  )}
                  {availableFilters.length > 0 && (
                    <div ref={filterPickerRef} className="relative">
                      <button
                        onClick={() => setShowFilterPicker(!showFilterPicker)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Filter
                      </button>

                      {showFilterPicker && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 py-1 z-20">
                          {availableFilters.map(f => (
                            <button
                              key={f.key}
                              onClick={() => addFilter(f.key)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-2"
                            >
                              <Plus className="w-3.5 h-3.5 text-gray-400" />
                              {f.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Table Section ──────────────────────────────────── */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-w-0">
              {/* Table Header Bar */}
              <div className="px-4 py-2.5 bg-[#3aa8e8] dark:bg-[#2d8abf] border-b border-[#3aa8e8]/20 flex items-center justify-between flex-shrink-0 rounded-t-xl">
                <span className="text-sm font-semibold text-white uppercase tracking-wider">
                  Issues ({sortedIssues.length})
                </span>
                <div className="flex items-center gap-2">
                  {activeFilterCount > 0 && (
                    <span className="text-[10px] text-white/80 bg-white/20 px-2 py-0.5 rounded-full font-medium">
                      {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                    </span>
                  )}
                  {sortColumn && (
                    <span className="text-[10px] text-white/80 bg-white/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {sortColumn}
                      <button
                        onClick={() => { setSortColumn(null); setSortDirection('asc'); }}
                        className="ml-0.5 hover:text-white"
                        title="Clear sort"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={() => { setShowFilters(!showFilters); setShowFilterPicker(false); }}
                    className={`relative p-1.5 rounded-lg transition-colors ${
                      showFilters
                        ? 'bg-white/25 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/15'
                    }`}
                    title="Toggle filters"
                  >
                    <ListFilter className="w-4 h-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-[#3aa8e8] text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Scrollable Table */}
              {loading ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="flex flex-col items-center gap-4">
                    {/* Double-ring spinner with icon */}
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
                      <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#3aa8e8] animate-spin" />
                      <div className="absolute inset-2 rounded-full border-[3px] border-transparent border-b-[#3aa8e8]/50 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-[#3aa8e8] animate-pulse" />
                      </div>
                    </div>
                    {/* Rotating text */}
                    <div className="text-center">
                      <p key={loadingMsgIdx} className="text-sm font-medium text-gray-700 dark:text-gray-300 animate-fade-in-up">
                        {loadingMessages[loadingMsgIdx]}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This won&apos;t take long</p>
                    </div>
                  </div>
                </div>
              ) : sortedIssues.length === 0 ? (
                <div className="text-center flex-1 flex flex-col items-center justify-center">
                  <Wrench className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 mb-1">No issues found</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Click "Report Issue" to get started'}
                  </p>
                </div>
              ) : (
                <div className={`overflow-y-auto flex-1 ${showFilters ? 'overflow-x-auto' : 'overflow-x-hidden'}`}>
                  <table className={`w-full text-sm text-left ${showFilters ? 'min-w-[1400px]' : ''}`}>
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-900 dark:border-gray-300 sticky top-0 z-10">
                      <tr className="divide-x divide-gray-200 dark:divide-gray-600">
                        {['Issue #', 'Title', 'Type', 'Status', 'Priority', 'Department', 'Area', 'Line', 'Shift', 'Equipment', 'Component', 'Reported By', 'Date', 'Photos'].map(col => (
                          <th
                            key={col}
                            onContextMenu={(e) => handleColumnContextMenu(e, col)}
                            className={`px-4 py-3 text-[11px] font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider cursor-context-menu select-none ${
                              sortColumn === col ? 'text-blue-600 dark:text-blue-400' : ''
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              {col}
                              {sortColumn === col && (
                                sortDirection === 'asc'
                                  ? <ArrowUp className="w-3 h-3 text-blue-500" />
                                  : <ArrowDown className="w-3 h-3 text-blue-500" />
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-900 dark:divide-gray-300">
                      {sortedIssues.map(issue => {
                        const sc = statusConfig[issue.status];
                        const pc = priorityConfig[issue.priority];
                        const StatusIcon = sc.icon;
                        return (
                          <tr
                            key={issue.id}
                            onClick={() => { if (!editingCell) openIssueDetail(issue); }}
                            onContextMenu={(e) => handleRowContextMenu(e, issue)}
                            className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors divide-x divide-gray-200 dark:divide-gray-600"
                          >
                            {/* Issue # — not editable */}
                            <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">{issue.issueNumber}</td>

                            {/* Title — inline text edit */}
                            <td className="px-4 py-3 max-w-[200px] relative" onClick={(e) => startCellEdit(e, issue.id, 'title', issue.title)}>
                              {editingCell?.issueId === issue.id && editingCell.column === 'title' ? (
                                <div ref={inlineEditRef}>
                                  <input
                                    autoFocus
                                    placeholder="Enter title"
                                    className="w-full text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-[#3aa8e8] rounded px-2 py-1 outline-none break-words"
                                    value={editingTitleValue}
                                    onChange={(e) => setEditingTitleValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && editingTitleValue.trim()) {
                                        if (editingTitleValue.trim() !== issue.title) {
                                          saveCellEdit(issue.id, 'title', editingTitleValue.trim());
                                        } else { setEditingCell(null); }
                                      }
                                      if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                  />
                                </div>
                              ) : (
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate hover:text-[#3aa8e8] transition-colors">{issue.title}</p>
                              )}
                            </td>

                            {/* Type — read only */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${issue.type === 'MACHINE' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'}`}>
                                {issue.type === 'MACHINE' ? '⚙️ Machine' : '✅ Quality'}
                              </span>
                            </td>

                            {/* Status — dropdown */}
                            <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => startCellEdit(e, issue.id, 'status')}>
                              {editingCell?.issueId === issue.id && editingCell.column === 'status' && dropdownPos ? (
                                <div ref={inlineEditRef} className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl min-w-[150px] py-1" style={{ top: dropdownPos.top, left: dropdownPos.left }}>
                                  {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as IssueStatus[]).map(s => {
                                    const cfg = statusConfig[s];
                                    const Icon = cfg.icon;
                                    return (
                                      <button key={s} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${issue.status === s ? 'bg-blue-50 dark:bg-blue-900/30 font-semibold' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); if (s !== issue.status) saveCellEdit(issue.id, 'status', s); else setEditingCell(null); }}>
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
                                          <Icon className="w-2.5 h-2.5" /> {cfg.label}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer hover:ring-2 hover:ring-[#3aa8e8]/50 transition-all ${sc.bg} ${sc.color}`}>
                                <StatusIcon className="w-2.5 h-2.5" /> {sc.label}
                              </span>
                            </td>

                            {/* Priority — dropdown */}
                            <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => startCellEdit(e, issue.id, 'priority')}>
                              {editingCell?.issueId === issue.id && editingCell.column === 'priority' && dropdownPos ? (
                                <div ref={inlineEditRef} className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl min-w-[130px] py-1" style={{ top: dropdownPos.top, left: dropdownPos.left }}>
                                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as IssuePriority[]).map(p => {
                                    const cfg = priorityConfig[p];
                                    return (
                                      <button key={p} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${issue.priority === p ? 'bg-blue-50 dark:bg-blue-900/30 font-semibold' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); if (p !== issue.priority) saveCellEdit(issue.id, 'priority', p); else setEditingCell(null); }}>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer hover:ring-2 hover:ring-[#3aa8e8]/50 transition-all ${pc.bg} ${pc.color}`}>{pc.label}</span>
                            </td>

                            {/* Department — dropdown */}
                            <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap" onClick={(e) => startCellEdit(e, issue.id, 'department')}>
                              {editingCell?.issueId === issue.id && editingCell.column === 'department' && dropdownPos ? (
                                <div ref={inlineEditRef} style={{ position: 'fixed', zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: '160px', maxHeight: '300px', overflowY: 'auto', padding: '4px 0', top: dropdownPos.top, left: dropdownPos.left }}>
                                  {departments.map(d => (
                                    <button key={d.id} style={{ display: 'block', color: '#000', backgroundColor: issue.Department?.id === d.id ? '#eff6ff' : '#f0f0f0', margin: '2px 4px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', fontWeight: issue.Department?.id === d.id ? 600 : 400, cursor: 'pointer' }}
                                      onClick={(e) => { e.stopPropagation(); if (d.id !== issue.Department?.id) saveCellEdit(issue.id, 'departmentId', d.id); else setEditingCell(null); }}>
                                      {d.name}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              <span className="hover:text-[#3aa8e8] transition-colors cursor-pointer">{issue.Department?.name || '—'}</span>
                            </td>

                            {/* Area — dropdown */}
                            <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap" onClick={(e) => startCellEdit(e, issue.id, 'area')}>
                              {editingCell?.issueId === issue.id && editingCell.column === 'area' && dropdownPos ? (
                                <div ref={inlineEditRef} style={{ position: 'fixed', zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: '160px', maxHeight: '300px', overflowY: 'auto', padding: '4px 0', top: dropdownPos.top, left: dropdownPos.left }}>
                                  <button style={{ display: 'block', color: '#9ca3af', margin: '2px 4px', padding: '6px 12px', border: 'none', background: 'transparent', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', cursor: 'pointer' }}
                                    onClick={(e) => { e.stopPropagation(); saveCellEdit(issue.id, 'areaId', null); }}>— None —</button>
                                  {areas.filter(a => !issue.Department?.id || a.departmentId === issue.Department.id).map(a => (
                                    <button key={a.id} style={{ display: 'block', color: '#000', backgroundColor: issue.Area?.id === a.id ? '#eff6ff' : '#f0f0f0', margin: '2px 4px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', fontWeight: issue.Area?.id === a.id ? 600 : 400, cursor: 'pointer' }}
                                      onClick={(e) => { e.stopPropagation(); if (a.id !== issue.Area?.id) saveCellEdit(issue.id, 'areaId', a.id); else setEditingCell(null); }}>
                                      {a.name}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              <span className="hover:text-[#3aa8e8] transition-colors cursor-pointer">{issue.Area?.name || '—'}</span>
                            </td>

                            {/* Line — dropdown */}
                            <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap" onClick={(e) => startCellEdit(e, issue.id, 'line')}>
                              {editingCell?.issueId === issue.id && editingCell.column === 'line' && dropdownPos ? (
                                <div ref={inlineEditRef} style={{ position: 'fixed', zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: '160px', maxHeight: '300px', overflowY: 'auto', padding: '4px 0', top: dropdownPos.top, left: dropdownPos.left }}>
                                  <button style={{ display: 'block', color: '#9ca3af', margin: '2px 4px', padding: '6px 12px', border: 'none', background: 'transparent', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', cursor: 'pointer' }}
                                    onClick={(e) => { e.stopPropagation(); saveCellEdit(issue.id, 'lineId', null); }}>— None —</button>
                                  {lines.filter(l => !issue.Area?.id || l.areaId === issue.Area.id).map(l => (
                                    <button key={l.id} style={{ display: 'block', color: '#000', backgroundColor: issue.Line?.id === l.id ? '#eff6ff' : '#f0f0f0', margin: '2px 4px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', fontWeight: issue.Line?.id === l.id ? 600 : 400, cursor: 'pointer' }}
                                      onClick={(e) => { e.stopPropagation(); if (l.id !== issue.Line?.id) saveCellEdit(issue.id, 'lineId', l.id); else setEditingCell(null); }}>
                                      {l.name}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              <span className="hover:text-[#3aa8e8] transition-colors cursor-pointer">{issue.Line?.name || '—'}</span>
                            </td>

                            {/* Shift — dropdown */}
                            <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap" onClick={(e) => startCellEdit(e, issue.id, 'shift')}>
                              {editingCell?.issueId === issue.id && editingCell.column === 'shift' && dropdownPos ? (
                                <div ref={inlineEditRef} style={{ position: 'fixed', zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: '160px', maxHeight: '300px', overflowY: 'auto', padding: '4px 0', top: dropdownPos.top, left: dropdownPos.left }}>
                                  <button style={{ display: 'block', color: '#9ca3af', margin: '2px 4px', padding: '6px 12px', border: 'none', background: 'transparent', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', cursor: 'pointer' }}
                                    onClick={(e) => { e.stopPropagation(); saveCellEdit(issue.id, 'shiftId', null); }}>— None —</button>
                                  {shifts.filter(s => {
                                    if (issue.Line?.id) return s.lineIds?.includes(issue.Line.id);
                                    if (issue.Area?.id) return s.areaIds?.includes(issue.Area.id);
                                    if (issue.Department?.id) return s.departmentIds?.includes(issue.Department.id);
                                    return true;
                                  }).map(s => (
                                    <button key={s.id} style={{ display: 'block', color: '#000', backgroundColor: issue.Shift?.id === s.id ? '#eff6ff' : '#f0f0f0', margin: '2px 4px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', fontWeight: issue.Shift?.id === s.id ? 600 : 400, cursor: 'pointer' }}
                                      onClick={(e) => { e.stopPropagation(); if (s.id !== issue.Shift?.id) saveCellEdit(issue.id, 'shiftId', s.id); else setEditingCell(null); }}>
                                      {s.name}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              <span className="hover:text-[#3aa8e8] transition-colors cursor-pointer">{issue.Shift?.name || '—'}</span>
                            </td>

                            {/* Equipment — dropdown */}
                            <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap" onClick={(e) => startCellEdit(e, issue.id, 'equipment')}>
                              {editingCell?.issueId === issue.id && editingCell.column === 'equipment' && dropdownPos ? (
                                <div ref={inlineEditRef} style={{ position: 'fixed', zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: '160px', maxHeight: '300px', overflowY: 'auto', padding: '4px 0', top: dropdownPos.top, left: dropdownPos.left }}>
                                  <button style={{ display: 'block', color: '#9ca3af', margin: '2px 4px', padding: '6px 12px', border: 'none', background: 'transparent', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', cursor: 'pointer' }}
                                    onClick={(e) => { e.stopPropagation(); saveCellEdit(issue.id, 'equipmentId', null); }}>— None —</button>
                                  {equipment.filter(eq => !issue.Line?.id || eq.lineId === issue.Line.id).map(eq => (
                                    <button key={eq.id} style={{ display: 'block', color: '#000', backgroundColor: issue.Equipment?.id === eq.id ? '#eff6ff' : '#f0f0f0', margin: '2px 4px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', fontWeight: issue.Equipment?.id === eq.id ? 600 : 400, cursor: 'pointer' }}
                                      onClick={(e) => { e.stopPropagation(); if (eq.id !== issue.Equipment?.id) saveCellEdit(issue.id, 'equipmentId', eq.id); else setEditingCell(null); }}>
                                      {eq.name}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              <span className="hover:text-[#3aa8e8] transition-colors cursor-pointer">{issue.Equipment?.name || '—'}</span>
                            </td>

                            {/* Component — dropdown */}
                            <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap" onClick={(e) => startCellEdit(e, issue.id, 'component')}>
                              {editingCell?.issueId === issue.id && editingCell.column === 'component' && dropdownPos ? (
                                <div ref={inlineEditRef} style={{ position: 'fixed', zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: '160px', maxHeight: '300px', overflowY: 'auto', padding: '4px 0', top: dropdownPos.top, left: dropdownPos.left }}>
                                  <button style={{ display: 'block', color: '#9ca3af', margin: '2px 4px', padding: '6px 12px', border: 'none', background: 'transparent', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', cursor: 'pointer' }}
                                    onClick={(e) => { e.stopPropagation(); saveCellEdit(issue.id, 'componentId', null); }}>— None —</button>
                                  {components.filter(c => !issue.Equipment?.id || c.equipmentId === issue.Equipment.id).map(c => (
                                    <button key={c.id} style={{ display: 'block', color: '#000', backgroundColor: issue.Component?.id === c.id ? '#eff6ff' : '#f0f0f0', margin: '2px 4px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', width: 'calc(100% - 8px)', textAlign: 'left', fontWeight: issue.Component?.id === c.id ? 600 : 400, cursor: 'pointer' }}
                                      onClick={(e) => { e.stopPropagation(); if (c.id !== issue.Component?.id) saveCellEdit(issue.id, 'componentId', c.id); else setEditingCell(null); }}>
                                      {c.name}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              <span className="hover:text-[#3aa8e8] transition-colors cursor-pointer">{issue.Component?.name || '—'}</span>
                            </td>

                            {/* Reported By — read only */}
                            <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {issue.ReportedBy ? `${issue.ReportedBy.firstName} ${issue.ReportedBy.lastName}` : '—'}
                            </td>
                            {/* Date — read only */}
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{format(new Date(issue.createdAt), 'MMM d, yyyy')}</td>
                            {/* Photos — read only */}
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {issue.photos?.length > 0 ? (
                                <span className="flex items-center gap-1"><Camera className="w-3 h-3" />{issue.photos.length}</span>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Context Menu ──────────────────────────────────────── */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999] min-w-[180px] py-1.5"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 200),
              top: Math.min(contextMenu.y, window.innerHeight - 200),
            }}
          >
            {contextMenu.type === 'column' && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                  {contextMenu.column}
                </div>
                <button
                  onClick={() => handleSort(contextMenu.column!, 'asc')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <ArrowUp className="w-4 h-4 text-gray-400" />
                  Sort Ascending
                </button>
                <button
                  onClick={() => handleSort(contextMenu.column!, 'desc')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <ArrowDown className="w-4 h-4 text-gray-400" />
                  Sort Descending
                </button>
                {['Department', 'Area', 'Line', 'Shift', 'Type', 'Status', 'Priority'].includes(contextMenu.column!) && (
                  <>
                    <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                    <button
                      onClick={() => handleFilterByColumn(contextMenu.column!)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <Filter className="w-4 h-4 text-gray-400" />
                      Filter by {contextMenu.column}
                    </button>
                  </>
                )}
              </>
            )}
            {contextMenu.type === 'row' && contextMenu.issue && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 truncate max-w-[180px]">
                  {contextMenu.issue.issueNumber} — {contextMenu.issue.title}
                </div>
                <button
                  onClick={() => { setSelectedIssue(contextMenu.issue!); setShowDetailModal(true); setShowResolutionInput(false); setResolutionText(contextMenu.issue!.resolution || ''); setDetailPendingPhotos([]); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Eye className="w-4 h-4 text-blue-500" />
                  View
                </button>
                <button
                  onClick={() => { setShowDetailModal(false); openReportModal(contextMenu.issue!); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Edit className="w-4 h-4 text-blue-500" />
                  Edit
                </button>
                {(user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN') && (
                  <>
                    <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                    <button
                      onClick={() => { deleteIssue(contextMenu.issue!.id); setContextMenu(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            REPORT ISSUE MODAL
            ═══════════════════════════════════════════════════════════════════════ */}
        {showReportModal && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/30 ${reportMaximized ? 'p-0' : 'p-4'}`} onClick={() => { if (!dragRef.current && !resizeRef.current) { /* allow backdrop click only if not dragging */ } }}>
            <div
              ref={reportModalRef}
              className={`relative bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden transition-[width,height,border-radius] duration-200 ${reportMaximized ? 'w-full h-full' : 'rounded-2xl'}`}
              style={reportMaximized ? {} : {
                width: reportModalSize.w,
                ...(reportModalSize.h ? { height: reportModalSize.h } : { maxHeight: '90vh' }),
                transform: `translate(${reportModalPos.x}px, ${reportModalPos.y}px)`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header — Draggable */}
              <div
                className="flex items-center justify-between px-5 py-3 bg-[#3aa8e8] dark:bg-[#2d8abf] rounded-t-2xl cursor-move select-none"
                onMouseDown={(e) => { if (!reportMaximized) handleDragStart(e, 'report'); }}
              >
                <div className="flex items-center gap-2">
                  <GripHorizontal className="w-4 h-4 text-white/50" />
                  <h2 className="text-lg font-bold text-white">
                    {editingIssue ? 'Edit Issue' : 'Report Issue'}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { if (reportMaximized) { setReportMaximized(false); } else { setReportMaximized(true); setReportModalPos({ x: 0, y: 0 }); } }}
                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
                    title={reportMaximized ? 'Restore' : 'Maximize'}
                  >
                    {reportMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setShowReportModal(false); resetReportModal(); }} className="p-1.5 text-white/70 hover:text-white hover:bg-white/15 rounded-lg transition-colors" title="Close">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {/* Issue Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Issue Type *</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'MACHINE' | 'QUALITY')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3aa8e8] focus:border-transparent"
                  >
                    <option value="MACHINE">⚙️ Machine Issue</option>
                    <option value="QUALITY">✅ Quality Issue</option>
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Brief description of the issue"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3aa8e8] focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Detailed description of the issue..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3aa8e8] focus:border-transparent resize-none"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as IssuePriority)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#3aa8e8] focus:border-transparent"
                  >
                    {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as IssuePriority[]).map(p => (
                      <option key={p} value={p}>{priorityConfig[p].label}</option>
                    ))}
                  </select>
                </div>

                {/* Location Dropdowns */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Department *</label>
                    <select
                      value={formDepartment}
                      onChange={(e) => { setFormDepartment(e.target.value); setFormArea(''); setFormLine(''); setFormEquipment(''); setFormComponent(''); }}
                      className="w-full px-2.5 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      title="Select Department"
                    >
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isAreaDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>Area</label>
                    <select
                      value={formArea}
                      onChange={(e) => { setFormArea(e.target.value); setFormLine(''); setFormEquipment(''); setFormComponent(''); }}
                      disabled={isAreaDisabled}
                      className={`w-full px-2.5 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isAreaDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Select Area"
                    >
                      <option value="">{isAreaDisabled ? 'Select Department first' : 'Select Area'}</option>
                      {formFilteredAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isLineDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>Line</label>
                    <select
                      value={formLine}
                      onChange={(e) => { setFormLine(e.target.value); setFormEquipment(''); setFormComponent(''); }}
                      disabled={isLineDisabled}
                      className={`w-full px-2.5 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isLineDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Select Line"
                    >
                      <option value="">{isLineDisabled ? 'Select Area first' : 'Select Line'}</option>
                      {formFilteredLines.map(l => <option key={l.id} value={l.id}>{l.name}{l.lineNumber ? ` (${l.lineNumber})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isShiftDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>Shift</label>
                    <select
                      value={formShift}
                      onChange={(e) => setFormShift(e.target.value)}
                      disabled={isShiftDisabled}
                      className={`w-full px-2.5 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isShiftDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Select Shift"
                    >
                      <option value="">{isShiftDisabled ? 'Select Department first' : 'Select Shift'}</option>
                      {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Quality Issue checkboxes for Equipment/Component */}
                {formType === 'QUALITY' && (
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qualityAddEquipment}
                        onChange={(e) => { setQualityAddEquipment(e.target.checked); if (!e.target.checked) { setFormEquipment(''); setFormComponent(''); setQualityAddComponent(false); } }}
                        className="rounded border-gray-300 text-[#3aa8e8] focus:ring-[#3aa8e8]"
                        title="Add Equipment/Machine"
                      />
                      Add Equipment / Machine
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qualityAddComponent}
                        onChange={(e) => { setQualityAddComponent(e.target.checked); if (!e.target.checked) setFormComponent(''); }}
                        className="rounded border-gray-300 text-[#3aa8e8] focus:ring-[#3aa8e8]"
                        title="Add Component"
                      />
                      Add Component
                    </label>
                  </div>
                )}

                {/* Equipment */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isEquipmentDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>Equipment / Machine</label>
                  <select
                    value={formEquipment}
                    onChange={(e) => { setFormEquipment(e.target.value); setFormComponent(''); }}
                    disabled={isEquipmentDisabled}
                    className={`w-full px-2.5 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isEquipmentDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Select Equipment"
                  >
                    <option value="">{isEquipmentDisabled ? (formType === 'QUALITY' ? 'Check "Add Equipment" above' : 'Select Line first') : 'Select Equipment (optional)'}</option>
                    {formFilteredEquipment.map(e => <option key={e.id} value={e.id}>{e.name}{e.assetTag ? ` [${e.assetTag}]` : ''}</option>)}
                  </select>
                </div>

                {/* Component */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isComponentDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>Component</label>
                  <select
                    value={formComponent}
                    onChange={(e) => setFormComponent(e.target.value)}
                    disabled={isComponentDisabled}
                    className={`w-full px-2.5 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isComponentDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Select Component"
                  >
                    <option value="">{isComponentDisabled ? (formType === 'QUALITY' ? 'Check "Add Component" above' : 'Select Equipment first') : 'Select Component (optional)'}</option>
                    {formFilteredComponents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Photos */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Photos</label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    multiple
                    accept="image/*,.heic,.heif"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    title="Select photos"
                  />
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-[#3aa8e8] transition-colors w-full justify-center"
                  >
                    <Camera className="w-4 h-4" /> Add Photos
                  </button>

                  {pendingPhotos.length > 0 && (
                    <div className="mt-2 grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2">
                      {pendingPhotos.map((photo, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={photo.preview}
                            alt={photo.name}
                            className="w-full rounded-lg cursor-pointer object-cover aspect-square hover:opacity-90 transition-opacity"
                            onClick={() => setLightboxPhotos([{ url: photo.preview, name: photo.name }]) || setLightboxIndex(0)}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            title="Remove photo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCropImage({ src: photo.croppedBlob ? photo.preview : URL.createObjectURL(photo.file), fileName: photo.name, index: idx }); }}
                            className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-white hover:bg-gray-100 text-gray-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-gray-200"
                            title="Crop"
                          >
                            <span className="text-[10px]">✂️</span>
                          </button>
                          {/* Editable name */}
                          {editingPhotoName === idx ? (
                            <input
                              autoFocus
                              value={photo.name}
                              onChange={(e) => setPendingPhotos(prev => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))}
                              onBlur={() => setEditingPhotoName(null)}
                              onKeyDown={(e) => e.key === 'Enter' && setEditingPhotoName(null)}
                              className="mt-0.5 w-full text-[10px] px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              title="Photo name"
                            />
                          ) : (
                            <p
                              onClick={(e) => { e.stopPropagation(); setEditingPhotoName(idx); }}
                              className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400 truncate cursor-pointer hover:text-[#3aa8e8]"
                              title="Click to rename"
                            >
                              {photo.name}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => { setShowReportModal(false); resetReportModal(); }}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitIssue}
                  disabled={submitting || !formTitle.trim() || !formDescription.trim() || !formDepartment}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-[#3aa8e8] hover:bg-[#2d8abf] disabled:bg-[#7cc4ee] text-white font-medium transition-colors"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {editingIssue ? 'Update Issue' : 'Submit Issue'}
                </button>
              </div>
              {/* Resize Handle */}
              {!reportMaximized && (
                <div
                  onMouseDown={(e) => handleResizeStart(e, 'report', reportModalRef.current)}
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
                  title="Resize"
                >
                  <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-[#3aa8e8] transition-colors" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14ZM14 6H12V4H14V6ZM10 10H8V8H10V10ZM6 14H4V12H6V14Z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            ISSUE DETAIL MODAL
            ═══════════════════════════════════════════════════════════════════════ */}
        {showDetailModal && selectedIssue && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/30 ${detailMaximized ? 'p-0' : 'p-4'}`}>
            <div
              ref={detailModalRef}
              className={`relative bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden transition-[width,height,border-radius] duration-200 ${detailMaximized ? 'w-full h-full' : 'rounded-2xl'}`}
              style={detailMaximized ? {} : {
                width: detailModalSize.w,
                ...(detailModalSize.h ? { height: detailModalSize.h } : { maxHeight: '90vh' }),
                transform: `translate(${detailModalPos.x}px, ${detailModalPos.y}px)`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header — Draggable */}
              <div
                className="flex items-center justify-between px-5 py-3 bg-[#3aa8e8] dark:bg-[#2d8abf] rounded-t-2xl cursor-move select-none"
                onMouseDown={(e) => { if (!detailMaximized) handleDragStart(e, 'detail'); }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <GripHorizontal className="w-4 h-4 text-white/50 flex-shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2 truncate">
                      <span className="text-xs font-mono text-white/70">{selectedIssue.issueNumber}</span>
                      {selectedIssue.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => { const sc = statusConfig[selectedIssue.status]; const StatusIcon = sc.icon; return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${sc.bg} ${sc.color}`}>
                          <StatusIcon className="w-3 h-3" /> {sc.label}
                        </span>
                      ); })()}
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${priorityConfig[selectedIssue.priority].bg} ${priorityConfig[selectedIssue.priority].color}`}>
                        {priorityConfig[selectedIssue.priority].label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${selectedIssue.type === 'MACHINE' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'}`}>
                        {selectedIssue.type === 'MACHINE' ? '⚙️ Machine' : '✅ Quality'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { if (detailMaximized) { setDetailMaximized(false); } else { setDetailMaximized(true); setDetailModalPos({ x: 0, y: 0 }); } }}
                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
                    title={detailMaximized ? 'Restore' : 'Maximize'}
                  >
                    {detailMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setShowDetailModal(false); setSelectedIssue(null); resetDetailModal(); }} className="p-1.5 text-white/70 hover:text-white hover:bg-white/15 rounded-lg transition-colors" title="Close">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {/* Description */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Description</h4>
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedIssue.description}</p>
                </div>

                {/* ── Location Information ── */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Location</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedIssue.Department && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Department</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-gray-400" />{selectedIssue.Department.name}</p>
                      </div>
                    )}
                    {selectedIssue.Area && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Area</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" />{selectedIssue.Area.name}</p>
                      </div>
                    )}
                    {selectedIssue.Line && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Line</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-gray-400" />{selectedIssue.Line.name}</p>
                      </div>
                    )}
                    {selectedIssue.Shift && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Shift</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1"><Timer className="w-3.5 h-3.5 text-gray-400" />{selectedIssue.Shift.name}</p>
                      </div>
                    )}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Reported</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{format(new Date(selectedIssue.createdAt), 'MMM d, yyyy h:mm a')}</p>
                      {selectedIssue.ReportedBy && <p className="text-[10px] text-gray-400">by {selectedIssue.ReportedBy.firstName} {selectedIssue.ReportedBy.lastName}</p>}
                    </div>
                  </div>
                </div>

                {/* ── Equipment & Component ── */}
                {(selectedIssue.Equipment || selectedIssue.Component) && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Equipment & Component</h4>
                    <div className="space-y-3">
                      {selectedIssue.Equipment && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <Settings className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedIssue.Equipment.name}</p>
                              {selectedIssue.Equipment.assetTag && <p className="text-[10px] text-gray-400">Asset Tag: {selectedIssue.Equipment.assetTag}</p>}
                              {selectedIssue.Equipment.manufacturer && <p className="text-[10px] text-gray-400">Manufacturer: {selectedIssue.Equipment.manufacturer}</p>}
                            </div>
                          </div>
                          {(() => {
                            const eqPhotos = Array.isArray(selectedIssue.Equipment?.photos) ? selectedIssue.Equipment.photos : [];
                            return eqPhotos.length > 0 ? (
                              <div className="mt-2">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Equipment Photos</p>
                                  {eqPhotos.length > 1 && (
                                    <button
                                      onClick={() => { setLightboxPhotos(eqPhotos); setLightboxIndex(0); }}
                                      className="flex items-center gap-1 text-[10px] text-[#3aa8e8] hover:text-[#2d8abf] font-medium transition-colors"
                                    >
                                      <Eye className="w-3 h-3" /> View All ({eqPhotos.length})
                                    </button>
                                  )}
                                </div>
                                <div className="flex gap-2 overflow-x-auto pt-2 pr-2 pb-2">
                                  {eqPhotos.map((photo: { url: string; name: string }, idx: number) => (
                                    <div key={idx} className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-all duration-200">
                                      <img
                                        src={photo.url}
                                        alt={photo.name}
                                        className="w-24 h-24 object-cover"
                                        onClick={() => { setLightboxPhotos(eqPhotos); setLightboxIndex(idx); }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}
                      {selectedIssue.Component && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <Cpu className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedIssue.Component.name}</p>
                              {selectedIssue.Component.partNumber && <p className="text-[10px] text-gray-400">Part #: {selectedIssue.Component.partNumber}</p>}
                              {selectedIssue.Component.manufacturer && <p className="text-[10px] text-gray-400">Manufacturer: {selectedIssue.Component.manufacturer}</p>}
                            </div>
                          </div>
                          {(() => {
                            const compPhotos = Array.isArray(selectedIssue.Component?.photos) ? selectedIssue.Component.photos : [];
                            return compPhotos.length > 0 ? (
                              <div className="mt-2">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Component Photos</p>
                                  {compPhotos.length > 1 && (
                                    <button
                                      onClick={() => { setLightboxPhotos(compPhotos); setLightboxIndex(0); }}
                                      className="flex items-center gap-1 text-[10px] text-[#3aa8e8] hover:text-[#2d8abf] font-medium transition-colors"
                                    >
                                      <Eye className="w-3 h-3" /> View All ({compPhotos.length})
                                    </button>
                                  )}
                                </div>
                                <div className="flex gap-2 overflow-x-auto pt-2 pr-2 pb-2">
                                  {compPhotos.map((photo: { url: string; name: string }, idx: number) => (
                                    <div key={idx} className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-all duration-200">
                                      <img
                                        src={photo.url}
                                        alt={photo.name}
                                        className="w-24 h-24 object-cover"
                                        onClick={() => { setLightboxPhotos(compPhotos); setLightboxIndex(idx); }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Resolution ── */}
                {selectedIssue.resolution && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase mb-1">Resolution</h4>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedIssue.resolution}</p>
                    {selectedIssue.ResolvedBy && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        Resolved by {selectedIssue.ResolvedBy.firstName} {selectedIssue.ResolvedBy.lastName}
                        {selectedIssue.resolvedAt && ` on ${format(new Date(selectedIssue.resolvedAt), 'MMM d, yyyy')}`}
                      </p>
                    )}
                  </div>
                )}

                {/* Resolve with resolution text */}
                {(selectedIssue.status === 'OPEN' || selectedIssue.status === 'IN_PROGRESS') && showResolutionInput && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Resolution Notes</label>
                    <textarea
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="Describe how the issue was resolved..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setShowResolutionInput(false)} className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">Cancel</button>
                      <button onClick={submitResolution} disabled={!resolutionText.trim()} className="px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium">Mark Resolved</button>
                    </div>
                  </div>
                )}

                {/* ── Issue Photos ── */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    📸 Issue Photos {selectedIssue.photos?.length > 0 ? `(${selectedIssue.photos.length})` : ''}
                  </h4>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">Photos of the actual issue reported</p>
                  {selectedIssue.photos?.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 mb-2 ml-auto justify-end">
                        {photoSelectMode && selectedPhotoUrls.size > 0 && (
                          <button
                            onClick={bulkDeletePhotos}
                            disabled={deletingSelectedPhotos}
                            className="flex items-center gap-1 text-[10px] px-2 py-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium rounded-md transition-colors shadow-sm"
                          >
                            {deletingSelectedPhotos ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Delete Photos ({selectedPhotoUrls.size})
                          </button>
                        )}
                        {photoSelectMode && (
                          <button
                            onClick={() => {
                              if (selectedPhotoUrls.size === selectedIssue.photos.length) {
                                setSelectedPhotoUrls(new Set());
                              } else {
                                setSelectedPhotoUrls(new Set(selectedIssue.photos.map(p => p.url)));
                              }
                            }}
                            className="flex items-center gap-1 text-[10px] text-[#3aa8e8] hover:text-[#2d8abf] font-medium transition-colors"
                          >
                            <CheckCircle className="w-3 h-3" />
                            {selectedPhotoUrls.size === selectedIssue.photos.length ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                        {selectedIssue.photos.length > 10 && (
                          <button
                            onClick={() => {
                              if (photoSelectMode) { setPhotoSelectMode(false); setSelectedPhotoUrls(new Set()); }
                              else { setPhotoSelectMode(true); }
                            }}
                            className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${photoSelectMode ? 'text-gray-500 hover:text-gray-700' : 'text-[#3aa8e8] hover:text-[#2d8abf]'}`}
                          >
                            {photoSelectMode ? (
                              <><X className="w-3 h-3" /> Cancel</>
                            ) : (
                              <><CheckCircle className="w-3 h-3" /> Select</>
                            )}
                          </button>
                        )}
                        {selectedIssue.photos.length > 1 && (
                          <button
                            onClick={() => { setLightboxPhotos(selectedIssue.photos); setLightboxIndex(0); }}
                            className="flex items-center gap-1 text-[10px] text-[#3aa8e8] hover:text-[#2d8abf] font-medium transition-colors"
                          >
                            <Eye className="w-3 h-3" /> View All ({selectedIssue.photos.length})
                          </button>
                        )}
                      </div>
                    <div className="flex gap-3 overflow-x-auto pt-2 pr-2 pb-2">
                      {selectedIssue.photos.map((photo, idx) => (
                        <div key={idx} className="relative group flex-shrink-0">
                          {photoSelectMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPhotoUrls(prev => {
                                  const next = new Set(prev);
                                  if (next.has(photo.url)) next.delete(photo.url);
                                  else next.add(photo.url);
                                  return next;
                                });
                              }}
                              className={`absolute -top-1 -left-1 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shadow-sm ${
                                selectedPhotoUrls.has(photo.url)
                                  ? 'bg-[#3aa8e8] border-[#3aa8e8] text-white'
                                  : 'bg-white border-gray-300 hover:border-[#3aa8e8]'
                              }`}
                            >
                              {selectedPhotoUrls.has(photo.url) && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          )}
                          <div className={`rounded-lg overflow-hidden hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-all duration-200 ${
                            selectedPhotoUrls.has(photo.url) ? 'ring-2 ring-[#3aa8e8] ring-offset-1' : ''
                          }`}>
                            <img
                              src={photo.url}
                              alt={photo.name}
                              className="w-24 h-24 object-cover cursor-pointer"
                              onClick={() => {
                                if (photoSelectMode) {
                                  setSelectedPhotoUrls(prev => {
                                    const next = new Set(prev);
                                    if (next.has(photo.url)) next.delete(photo.url);
                                    else next.add(photo.url);
                                    return next;
                                  });
                                } else {
                                  setLightboxPhotos(selectedIssue.photos);
                                  setLightboxIndex(idx);
                                }
                              }}
                            />
                          </div>
                          {!photoSelectMode && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteExistingPhoto(selectedIssue.id, photo.url); }}
                              className="absolute -top-2 -right-2 z-10 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                              title="Remove photo"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          {renamingExistingPhoto === idx ? (
                            <input
                              autoFocus
                              value={existingPhotoName}
                              onChange={(e) => setExistingPhotoName(e.target.value)}
                              onBlur={() => { renameExistingPhoto(selectedIssue.id, photo.url, existingPhotoName); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') renameExistingPhoto(selectedIssue.id, photo.url, existingPhotoName); if (e.key === 'Escape') setRenamingExistingPhoto(null); }}
                              className="mt-0.5 w-24 text-[10px] px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              title="Photo name"
                            />
                          ) : (
                            <p
                              onClick={(e) => { e.stopPropagation(); setRenamingExistingPhoto(idx); setExistingPhotoName(photo.name); }}
                              className="mt-0.5 w-24 text-[10px] text-gray-500 dark:text-gray-400 truncate cursor-pointer hover:text-[#3aa8e8]"
                              title="Click to rename"
                            >
                              {photo.name}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">No issue photos uploaded yet</p>
                  )}

                  {/* Add more issue photos */}
                  <div className="mt-2">
                    <input
                      ref={detailPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*,.heic,.heif"
                      onChange={handleDetailPhotoSelect}
                      className="hidden"
                      title="Select photos"
                    />
                    <button
                      onClick={() => detailPhotoInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-[#3aa8e8] transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" /> Add Issue Photos
                    </button>

                    {detailPendingPhotos.length > 0 && (
                      <div ref={detailReadyRef} className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase mb-2">
                          Ready to Upload ({detailPendingPhotos.length})
                        </p>
                        <div className="flex gap-3 overflow-x-auto pt-2 pr-2 pb-2">
                          {detailPendingPhotos.map((photo, idx) => (
                            <div key={idx} className="relative group flex-shrink-0">
                              <div className="rounded-lg overflow-hidden hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-all duration-200">
                                <img
                                  src={photo.preview}
                                  alt={photo.name}
                                  className="w-24 h-24 object-cover cursor-pointer"
                                  onClick={() => setLightboxPhotos([{ url: photo.preview, name: photo.name }]) || setLightboxIndex(0)}
                                />
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDetailPendingPhotos(prev => prev.filter((_, i) => i !== idx)); }}
                                className="absolute -top-2 -right-2 z-10 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                title="Remove"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDetailCropImage({ src: photo.croppedBlob ? photo.preview : URL.createObjectURL(photo.file), fileName: photo.name, index: idx }); }}
                                className="absolute -bottom-1.5 -right-1.5 z-10 w-5 h-5 bg-white hover:bg-gray-100 text-gray-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-gray-200"
                                title="Crop"
                              >
                                <span className="text-[10px]">✂️</span>
                              </button>
                              {detailEditingName === idx ? (
                                <input
                                  autoFocus
                                  value={photo.name}
                                  onChange={(e) => setDetailPendingPhotos(prev => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))}
                                  onBlur={() => setDetailEditingName(null)}
                                  onKeyDown={(e) => e.key === 'Enter' && setDetailEditingName(null)}
                                  className="mt-0.5 w-24 text-[10px] px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  title="Photo name"
                                />
                              ) : (
                                <p
                                  onClick={() => setDetailEditingName(idx)}
                                  className="mt-0.5 w-24 text-[10px] text-gray-500 dark:text-gray-400 truncate cursor-pointer hover:text-[#3aa8e8]"
                                  title="Click to rename"
                                >
                                  {photo.name}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={uploadDetailPhotos}
                          disabled={uploadingToIssue}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-[#3aa8e8] hover:bg-[#2d8abf] disabled:bg-[#7cc4ee] text-white text-xs rounded-lg font-medium"
                        >
                          {uploadingToIssue ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                          Upload {detailPendingPhotos.length} Photo{detailPendingPhotos.length !== 1 ? 's' : ''}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer with actions */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  {/* Status transitions */}
                  {getNextStatuses(selectedIssue.status).map(nextStatus => {
                    if (nextStatus === 'RESOLVED' && (selectedIssue.status === 'OPEN' || selectedIssue.status === 'IN_PROGRESS')) {
                      return (
                        <button
                          key={nextStatus}
                          onClick={() => setShowResolutionInput(true)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium"
                        >
                          <CheckCircle className="w-3 h-3" /> Resolve
                        </button>
                      );
                    }
                    const nsc = statusConfig[nextStatus];
                    const NscIcon = nsc.icon;
                    return (
                      <button
                        key={nextStatus}
                        onClick={() => updateIssueStatus(selectedIssue.id, nextStatus)}
                        disabled={updatingStatus === selectedIssue.id}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${nsc.bg} ${nsc.color} hover:opacity-80`}
                      >
                        {updatingStatus === selectedIssue.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <NscIcon className="w-3 h-3" />}
                        {nsc.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowDetailModal(false); resetDetailModal(); openReportModal(selectedIssue); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                  {(user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN') && !photoSelectMode && (
                    <button
                      onClick={() => deleteIssue(selectedIssue.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" /> Delete Issue
                    </button>
                  )}
                </div>
              </div>
              {/* Resize Handle */}
              {!detailMaximized && (
                <div
                  onMouseDown={(e) => handleResizeStart(e, 'detail', detailModalRef.current)}
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
                  title="Resize"
                >
                  <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-[#3aa8e8] transition-colors" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14ZM14 6H12V4H14V6ZM10 10H8V8H10V10ZM6 14H4V12H6V14Z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            IMAGE CROP MODAL
            ═══════════════════════════════════════════════════════════════════════ */}
        {cropImage && (
          <ImageCropModal
            imageSrc={cropImage.src}
            fileName={cropImage.fileName}
            onCropComplete={handleCropComplete}
            onUseOriginal={handleUseOriginal}
            onCancel={() => setCropImage(null)}
          />
        )}

        {detailCropImage && (
          <ImageCropModal
            imageSrc={detailCropImage.src}
            fileName={detailCropImage.fileName}
            onCropComplete={(blob) => {
              setDetailPendingPhotos(prev => prev.map((p, i) => i === detailCropImage.index ? { ...p, croppedBlob: blob, preview: URL.createObjectURL(blob) } : p));
              setDetailCropImage(null);
            }}
            onUseOriginal={() => {
              setDetailPendingPhotos(prev => prev.map((p, i) => i === detailCropImage.index ? { ...p, croppedBlob: undefined } : p));
              setDetailCropImage(null);
            }}
            onCancel={() => setDetailCropImage(null)}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            PHOTO LIGHTBOX
            ═══════════════════════════════════════════════════════════════════════ */}
        {lightboxPhotos.length > 0 && (
          <PhotoLightbox
            photos={lightboxPhotos}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxPhotos([])}
            onNavigate={setLightboxIndex}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            HEIC PROCESSING OVERLAY
            ═══════════════════════════════════════════════════════════════════════ */}
        {heicProcessing && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
              {/* Animated camera/photo icon */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-[#3aa8e8]/20 animate-ping" />
                <div className="absolute inset-1 rounded-full bg-[#3aa8e8]/30 animate-pulse" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#3aa8e8] to-[#2d8abf] flex items-center justify-center shadow-lg shadow-[#3aa8e8]/30">
                  <Camera className="w-9 h-9 text-white animate-bounce" style={{ animationDuration: '1.5s' }} />
                </div>
              </div>

              {/* Progress text */}
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Converting HEIC Photos
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {heicProcessing.total === 1
                  ? 'Hang tight — converting your photo to JPEG...'
                  : `Processing photo ${heicProcessing.current} of ${heicProcessing.total}...`}
              </p>

              {/* File name */}
              <p className="text-xs text-[#3aa8e8] font-medium truncate mb-4 px-4">
                {heicProcessing.fileName}
              </p>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#3aa8e8] to-[#2d8abf] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(5, (heicProcessing.current / heicProcessing.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                {heicProcessing.current < heicProcessing.total
                  ? 'Please don\u2019t close this window'
                  : 'Almost done...'}
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            PHOTO LIMIT ERROR MODAL
            ═══════════════════════════════════════════════════════════════════════ */}
        {photoLimitError && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Too Many Photos
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                You can only upload up to <span className="font-bold text-gray-900 dark:text-white">15 photos</span> at a time. Please select fewer photos and try again.
              </p>
              <button
                onClick={() => setPhotoLimitError(false)}
                className="px-6 py-2 bg-[#3aa8e8] hover:bg-[#2d8abf] text-white text-sm font-medium rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            UPLOAD PROGRESS OVERLAY
            ═══════════════════════════════════════════════════════════════════════ */}
        {uploadProgress && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
              {/* Animated upload icon */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-[#3aa8e8]/20" />
                <svg className="absolute inset-0 w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40" cy="40" r="36"
                    fill="none" stroke="#3aa8e8" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${2 * Math.PI * 36 * (1 - Math.max(0.05, uploadProgress.current / uploadProgress.total))}`}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-[#3aa8e8]">
                    {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                  </span>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Uploading Photos
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {uploadProgress.current < uploadProgress.total
                  ? `Uploading ${uploadProgress.total} photo${uploadProgress.total !== 1 ? 's' : ''} to cloud storage...`
                  : 'Finishing up...'}
              </p>

              <div className="flex items-center justify-center gap-1.5 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#3aa8e8] animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#3aa8e8] animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#3aa8e8] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500">
                Please don{'\u2019'}t close this window
              </p>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
