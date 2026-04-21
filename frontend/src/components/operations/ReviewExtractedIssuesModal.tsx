'use client';

/**
 * ReviewExtractedIssuesModal
 * ---------------------------
 * Dedicated review & submit modal for the "From Document" AI flow.
 *
 * UX:
 *  - No overlay / no backdrop blur — the page behind stays visible and usable.
 *  - Draggable by the header.
 *  - Maximize snaps the modal to the <main> content area (inside sidebar + top nav).
 *  - Default size has a capped height (≈ 78vh); body scrolls internally.
 *  - Shared context header: Department / Line / Shift / Week / Day.
 *    Area is per-issue (since issues in one document can come from different
 *    areas of the same line).
 *  - Each issue card is separated by a BLACK divider.
 *  - Per-issue photos, delete, plus "Add another issue".
 *  - Save All shows a progress sub-modal with a checklist of each issue and
 *    an animated progress bar that reaches 100% before closing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  ImagePlus,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Check,
} from 'lucide-react';
import api from '@/lib/api';
import type { ExtractionResult } from './ReportIssueFromDocumentModal';

// ─── Types copied in to avoid circular imports ─────────────────────────────
interface Option { id: string; name: string; }
interface AreaOpt extends Option { departmentId?: string | null; }
interface LineOpt extends Option { areaId?: string | null; lineNumber?: string | null; }
interface EquipmentOpt extends Option { lineId?: string | null; }
interface ComponentOpt extends Option { equipmentId?: string | null; }
interface DayOpt { id: string; dayName: string; dayOrder: number; }
interface WeekOpt { weekNumber: number; label: string; isCurrent?: boolean; }

type IssueType = 'MACHINE' | 'QUALITY';
type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface IssueRow {
  _localId: string;
  type: IssueType;
  title: string;
  description: string;
  priority: IssuePriority;
  areaId: string;
  equipmentId: string;
  componentId: string;
  startTime: string;
  minutesLost: string;
  photos: File[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onReanalyze: () => void;
  onSaved: (createdCount: number) => void;
  sourceFile: File | null;
  extraction: ExtractionResult | null;

  departments: Option[];
  areas: AreaOpt[];
  lines: LineOpt[];
  shifts: Option[];
  equipment: EquipmentOpt[];
  components: ComponentOpt[];
  daysOfWeek: DayOpt[];
  weeks: WeekOpt[];
  currentWeek: number | null;
}

const genId = () => Math.random().toString(36).slice(2, 10);
const DEFAULT_W = 960;
const DEFAULT_H_VH = 0.78; // 78% of viewport

function toIssueRow(it: ExtractionResult['issues'][number], ctxAreaId?: string | null): IssueRow {
  return {
    _localId: genId(),
    type: (it.type as IssueType) || 'MACHINE',
    title: it.title || '',
    description: it.description || '',
    priority: (it.priority as IssuePriority) || 'MEDIUM',
    areaId: ctxAreaId || '',
    equipmentId: it.equipmentId || '',
    componentId: it.componentId || '',
    startTime: it.startTime || '',
    minutesLost: it.totalMinutesLost != null ? String(it.totalMinutesLost) : '',
    photos: [],
  };
}

function blankRow(areaId = ''): IssueRow {
  return {
    _localId: genId(),
    type: 'MACHINE',
    title: '',
    description: '',
    priority: 'MEDIUM',
    areaId,
    equipmentId: '',
    componentId: '',
    startTime: '',
    minutesLost: '',
    photos: [],
  };
}

type StepStatus = 'pending' | 'active' | 'done' | 'error';
interface SaveStep { id: string; label: string; status: StepStatus; }

export default function ReviewExtractedIssuesModal({
  open,
  onClose,
  onReanalyze,
  onSaved,
  sourceFile,
  extraction,
  departments,
  areas,
  lines,
  shifts,
  equipment,
  components,
  daysOfWeek,
  weeks,
  currentWeek,
}: Props) {
  // ─── Shared context ──────────────────────────────────────────────────────
  const [ctxDepartmentId, setCtxDepartmentId] = useState('');
  const [ctxLineId, setCtxLineId] = useState('');
  const [ctxShiftId, setCtxShiftId] = useState('');
  const [ctxWeek, setCtxWeek] = useState('');
  const [ctxDayId, setCtxDayId] = useState('');

  // ─── Issues ──────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ─── Save-progress sub-modal ─────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [steps, setSteps] = useState<SaveStep[]>([]);
  const [progress, setProgress] = useState(0); // 0..100 (animated)
  const targetProgressRef = useRef(0);

  // ─── Drag + maximize state ───────────────────────────────────────────────
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [maximized, setMaximized] = useState(false);
  const [mainRect, setMainRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Hydrate from extraction when modal opens
  useEffect(() => {
    if (!open || !extraction) return;
    const ctx = extraction.context || {};
    setCtxDepartmentId(ctx.departmentId || '');
    setCtxLineId(ctx.lineId || '');
    setCtxShiftId(ctx.shiftId || '');
    setCtxWeek(ctx.weekNumber != null ? String(ctx.weekNumber) : (currentWeek != null ? String(currentWeek) : ''));
    setCtxDayId(ctx.dayOfWeekId || '');
    const fallbackArea = ctx.areaId || '';
    const initial = (extraction.issues || []).map((it) => toIssueRow(it, fallbackArea));
    setRows(initial.length ? initial : [blankRow(fallbackArea)]);
    setError(null);
    setPos({ x: 0, y: 0 });
    setMaximized(false);
  }, [open, extraction, currentWeek]);

  // Track <main> bounds for maximize — dynamically follows sidebar collapse/expand
  useEffect(() => {
    if (!open) return;
    const main = document.querySelector('main');
    if (!main) return;
    const compute = () => {
      const r = main.getBoundingClientRect();
      setMainRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    compute();
    // ResizeObserver catches sidebar collapse/expand and content reflow
    const ro = new ResizeObserver(compute);
    ro.observe(main);
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    // Also watch body in case the sidebar pushes the main element
    const bodyRo = new ResizeObserver(compute);
    bodyRo.observe(document.body);
    return () => {
      ro.disconnect();
      bodyRo.disconnect();
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  // Smooth-animate `progress` toward target. `progressRef` mirrors state so
  // async code outside React can read the live value without setState tricks.
  const progressRef = useRef(0);
  useEffect(() => {
    if (!saving) return;
    let raf = 0;
    const tick = () => {
      setProgress((p) => {
        const target = targetProgressRef.current;
        let next: number;
        if (Math.abs(target - p) < 0.3) next = target;
        else next = p + (target - p) * 0.18;
        progressRef.current = next;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [saving]);

  // ─── Filtered dropdown helpers ───────────────────────────────────────────
  const availableLines = useMemo(() => lines, [lines]);
  const areasForLine = useMemo(() => {
    // Areas belonging to the selected shared Line's department.
    // If no line selected, show all areas under the selected dept.
    if (!ctxDepartmentId) return areas;
    return areas.filter((a) => a.departmentId === ctxDepartmentId);
  }, [areas, ctxDepartmentId]);
  const lineEquipment = useMemo(
    () => (ctxLineId ? equipment.filter((e) => e.lineId === ctxLineId) : equipment),
    [equipment, ctxLineId]
  );
  const componentsFor = (equipmentId: string) =>
    equipmentId ? components.filter((c) => c.equipmentId === equipmentId) : components;

  // ─── Row helpers ─────────────────────────────────────────────────────────
  const updateRow = (id: string, patch: Partial<IssueRow>) =>
    setRows((prev) => prev.map((r) => (r._localId === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r._localId !== id) : prev));
  const addRow = () => setRows((prev) => [...prev, blankRow(prev[prev.length - 1]?.areaId || '')]);
  const addPhotos = (id: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked: File[] = [];
    for (let i = 0; i < files.length && picked.length < 15; i++) picked.push(files[i]);
    setRows((prev) =>
      prev.map((r) => (r._localId === id ? { ...r, photos: [...r.photos, ...picked].slice(0, 15) } : r))
    );
  };
  const removePhoto = (id: string, idx: number) =>
    setRows((prev) =>
      prev.map((r) => (r._localId === id ? { ...r, photos: r.photos.filter((_, i) => i !== idx) } : r))
    );

  // ─── Drag ────────────────────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (maximized) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [maximized, pos.x, pos.y]);

  // ─── Save All ────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!ctxDepartmentId) return 'Department is required in the shared context.';
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.title.trim()) return `Issue #${i + 1}: Title is required.`;
      if (!r.description.trim()) return `Issue #${i + 1}: Description is required.`;
    }
    return null;
  };

  const handleSaveAll = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);

    // Build checklist: one step per issue (photo upload is folded in)
    const initialSteps: SaveStep[] = rows.map((r, i) => ({
      id: r._localId,
      label: `Issue ${i + 1}: ${r.title.trim().slice(0, 60) || 'Untitled'}${r.photos.length ? ` (+${r.photos.length} photo${r.photos.length === 1 ? '' : 's'})` : ''}`,
      status: 'pending',
    }));
    setSteps(initialSteps);
    setProgress(0);
    targetProgressRef.current = 0;
    setSaving(true);

    const markStep = (idx: number, status: StepStatus) =>
      setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, status } : s)));

    let created = 0;
    const total = rows.length;
    try {
      for (let i = 0; i < total; i++) {
        markStep(i, 'active');
        targetProgressRef.current = Math.min(99, ((i + 0.3) / total) * 100);

        const r = rows[i];
        const payload: any = {
          type: r.type,
          title: r.title.trim(),
          description: r.description.trim(),
          priority: r.priority,
          departmentId: ctxDepartmentId,
          areaId: r.areaId || null,
          lineId: ctxLineId || null,
          shiftId: ctxShiftId || null,
          equipmentId: r.equipmentId || null,
          componentId: r.componentId || null,
          weekNumber: ctxWeek ? parseInt(ctxWeek, 10) : null,
          dayOfWeekId: ctxDayId || null,
          startTime: r.startTime || null,
          totalMinutesLost: r.minutesLost ? parseInt(r.minutesLost, 10) : null,
        };
        const createRes = await api.post('/operations/issues', payload);
        const issueId = createRes.data?.data?.id || createRes.data?.id;
        if (issueId && r.photos.length > 0) {
          const fd = new FormData();
          r.photos.forEach((f) => fd.append('photos', f));
          try {
            await api.post(`/operations/issues/${issueId}/photos`, fd, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 120000,
            });
          } catch (photoErr) {
            // eslint-disable-next-line no-console
            console.warn('Photo upload failed for issue', issueId, photoErr);
          }
        }
        created++;
        markStep(i, 'done');
        targetProgressRef.current = ((i + 1) / total) * 100;
      }

      // Finish the animation to 100% before closing
      targetProgressRef.current = 100;
      await new Promise<void>((resolve) => {
        const started = Date.now();
        const iv = window.setInterval(() => {
          if (progressRef.current >= 99.5 || Date.now() - started > 2000) {
            window.clearInterval(iv);
            resolve();
          }
        }, 50);
      });
      // Snap to 100 and pause so user sees all checkmarks + 100%
      targetProgressRef.current = 100;
      setProgress(100);
      progressRef.current = 100;
      await new Promise((r) => setTimeout(r, 600));

      setSaving(false);
      onSaved(created);
    } catch (err: any) {
      // Mark the current active step as error and stop
      setSteps((prev) => prev.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s)));
      setError(err?.response?.data?.error || err?.message || 'Failed to save issues.');
      setSaving(false);
    }
  };

  if (!open) return null;

  const totalMinutes = rows.reduce((acc, r) => acc + (parseInt(r.minutesLost, 10) || 0), 0);

  // Compute modal geometry
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const defaultW = Math.min(DEFAULT_W, vw - 32);
  const defaultH = Math.round(vh * DEFAULT_H_VH);

  const shellStyle: React.CSSProperties = maximized && mainRect
    ? {
        position: 'fixed',
        top: mainRect.top,
        left: mainRect.left,
        width: mainRect.width,
        height: mainRect.height,
      }
    : {
        position: 'fixed',
        top: `calc(50% + ${pos.y}px)`,
        left: `calc(50% + ${pos.x}px)`,
        transform: 'translate(-50%, -50%)',
        width: defaultW,
        height: defaultH,
      };

  return (
    <>
      {/* Wrapper is pointer-events-none so the page behind stays clickable.
          The modal shell enables pointer-events on itself. */}
      <div
        className="fixed inset-0 z-[70] pointer-events-none"
        aria-hidden="false"
      >
        <div
          ref={shellRef}
          className={`pointer-events-auto bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/10 flex flex-col overflow-hidden transition-[top,left,width,height,border-radius] duration-200 ease-out ${maximized ? 'rounded-none' : 'rounded-2xl'}`}
          style={shellStyle}
        >
          {/* Header (draggable) */}
          <div
            className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-[#3aa8e8] to-[#2d8abf] text-white select-none cursor-move"
            onMouseDown={onDragStart}
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripHorizontal className="w-4 h-4 flex-shrink-0 opacity-80" />
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-bold truncate">Review AI-Extracted Issues</h2>
                <div className="text-[11px] opacity-90 truncate">
                  {sourceFile?.name}
                  {extraction?.confidence != null && (
                    <span className="ml-2">· {Math.round((extraction.confidence || 0) * 100)}% confidence</span>
                  )}
                  {rows.length > 0 && (
                    <span className="ml-2">· {rows.length} issue{rows.length === 1 ? '' : 's'}{totalMinutes ? ` · ${totalMinutes} min total` : ''}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={onReanalyze}
                disabled={saving}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-50"
                title="Re-run AI on the same file"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reanalyze
              </button>
              <button
                onClick={() => setMaximized((m) => !m)}
                disabled={saving}
                className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50"
                title={maximized ? 'Restore' : 'Maximize to content area'}
              >
                {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                disabled={saving}
                className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* AI notes banner */}
          {extraction?.notes && (
            <div className="px-4 pt-2">
              <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-[12px]">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div className="leading-snug">{extraction.notes}</div>
              </div>
            </div>
          )}

          {/* Shared Context (non-scrolling) */}
          <div className="px-4 pt-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">
              Shared Context (applies to every issue)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-[12px]">
              <LabeledSelect
                label="Department *"
                value={ctxDepartmentId}
                onChange={(v) => { setCtxDepartmentId(v); setCtxLineId(''); /* reset per-issue areas that no longer match */ setRows((prev) => prev.map((r) => ({ ...r, areaId: '', equipmentId: '', componentId: '' }))); }}
                options={departments}
              />
              <LabeledSelect
                label="Line"
                value={ctxLineId}
                onChange={(v) => { setCtxLineId(v); setRows((prev) => prev.map((r) => ({ ...r, equipmentId: '', componentId: '' }))); }}
                options={availableLines}
              />
              <LabeledSelect label="Shift" value={ctxShiftId} onChange={setCtxShiftId} options={shifts} />
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Week</label>
                <select
                  value={ctxWeek}
                  onChange={(e) => setCtxWeek(e.target.value)}
                  className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  aria-label="Week"
                >
                  <option value="">—</option>
                  {weeks.map((w) => (
                    <option key={w.weekNumber} value={w.weekNumber}>
                      {w.label}{w.isCurrent ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Day</label>
                <select
                  value={ctxDayId}
                  onChange={(e) => setCtxDayId(e.target.value)}
                  className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  aria-label="Day of week"
                >
                  <option value="">—</option>
                  {daysOfWeek.map((d) => (
                    <option key={d.id} value={d.id}>{d.dayName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Scrollable body: Issues list */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {rows.map((r, idx) => {
              const rowEquipment = lineEquipment;
              const rowComponents = componentsFor(r.equipmentId);
              return (
                <div
                  key={r._localId}
                  className={`${idx > 0 ? 'border-t-2 border-black pt-3 mt-3' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#3aa8e8] text-white text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <div className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">
                        Issue {idx + 1}
                      </div>
                    </div>
                    <button
                      onClick={() => removeRow(r._localId)}
                      disabled={saving || rows.length === 1}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                      title={rows.length === 1 ? 'At least one issue is required' : 'Remove this issue'}
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 text-[12px]">
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Type</label>
                      <select
                        value={r.type}
                        onChange={(e) => updateRow(r._localId, { type: e.target.value as IssueType })}
                        className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        aria-label="Type"
                      >
                        <option value="MACHINE">Machine</option>
                        <option value="QUALITY">Quality</option>
                      </select>
                    </div>

                    <div className="lg:col-span-8">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Title *</label>
                      <input
                        type="text"
                        value={r.title}
                        placeholder="Short, descriptive title"
                        onChange={(e) => updateRow(r._localId, { title: e.target.value })}
                        className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Priority</label>
                      <select
                        value={r.priority}
                        onChange={(e) => updateRow(r._localId, { priority: e.target.value as IssuePriority })}
                        className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        aria-label="Priority"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>

                    <div className="lg:col-span-12">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Description *</label>
                      <textarea
                        value={r.description}
                        rows={2}
                        placeholder="What happened, on which equipment/component, and any root-cause clues"
                        onChange={(e) => updateRow(r._localId, { description: e.target.value })}
                        className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-y"
                      />
                    </div>

                    {/* Area (per-issue) */}
                    <div className="lg:col-span-3">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Area</label>
                      <select
                        value={r.areaId}
                        onChange={(e) => updateRow(r._localId, { areaId: e.target.value })}
                        disabled={!ctxDepartmentId}
                        className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                        aria-label="Area"
                      >
                        <option value="">—</option>
                        {areasForLine.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="lg:col-span-3">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Equipment</label>
                      <select
                        value={r.equipmentId}
                        onChange={(e) => updateRow(r._localId, { equipmentId: e.target.value, componentId: '' })}
                        className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        aria-label="Equipment"
                      >
                        <option value="">—</option>
                        {rowEquipment.map((eq) => (
                          <option key={eq.id} value={eq.id}>{eq.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="lg:col-span-3">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Component</label>
                      <select
                        value={r.componentId}
                        onChange={(e) => updateRow(r._localId, { componentId: e.target.value })}
                        disabled={!r.equipmentId}
                        className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                        aria-label="Component"
                      >
                        <option value="">—</option>
                        {rowComponents.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="lg:col-span-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Start Time</label>
                        <input
                          type="time"
                          value={r.startTime}
                          onChange={(e) => updateRow(r._localId, { startTime: e.target.value })}
                          className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          aria-label="Start time"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Min Lost</label>
                        <input
                          type="number"
                          min={0}
                          value={r.minutesLost}
                          onChange={(e) => updateRow(r._localId, { minutesLost: e.target.value })}
                          placeholder="0"
                          className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div className="lg:col-span-12">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">
                        Photos <span className="font-normal italic">(optional · up to 15)</span>
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.photos.map((p, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={URL.createObjectURL(p)}
                              alt={p.name}
                              className="w-14 h-14 object-cover rounded border border-gray-300 dark:border-gray-600"
                            />
                            <button
                              onClick={() => removePhoto(r._localId, i)}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <label className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-dashed border-gray-400 dark:border-gray-500 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                          <ImagePlus className="w-3.5 h-3.5" />
                          Add
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => { addPhotos(r._localId, e.target.files); e.target.value = ''; }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={addRow}
              disabled={saving}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#3aa8e8] border border-dashed border-[#3aa8e8] rounded-md hover:bg-[#3aa8e8]/5 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add another issue
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 flex items-start gap-2 p-2 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200 text-[12px]">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-t-2 border-[#3aa8e8]/40 bg-gradient-to-r from-[#3aa8e8]/10 via-[#3aa8e8]/5 to-[#2d8abf]/10 dark:from-[#3aa8e8]/20 dark:via-[#3aa8e8]/10 dark:to-[#2d8abf]/20">
            <div className="text-[11px] font-medium text-[#2d8abf] dark:text-[#7ec8ec]">
              {rows.length} issue{rows.length === 1 ? '' : 's'} ready to save
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-3 py-1.5 text-[12px] font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-semibold text-white bg-gradient-to-r from-[#3aa8e8] to-[#2d8abf] rounded-md hover:opacity-95 disabled:opacity-50 shadow"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Save All ({rows.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save-progress sub-modal (IS a dark overlay, because this one should focus attention) */}
      {saving && (
        <SaveProgressModal steps={steps} progress={progress} total={rows.length} />
      )}
    </>
  );
}

// ─── Small local labeled-select ────────────────────────────────────────────
function LabeledSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        className="w-full px-2 py-1.5 text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Save Progress Sub-Modal ───────────────────────────────────────────────
function SaveProgressModal({
  steps,
  progress,
  total,
}: {
  steps: SaveStep[];
  progress: number;
  total: number;
}) {
  const doneCount = steps.filter((s) => s.status === 'done').length;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/10 overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-[#3aa8e8] to-[#2d8abf] text-white">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <h3 className="text-sm font-bold">Saving Issues</h3>
          </div>
          <div className="text-[11px] opacity-90 mt-0.5">
            {doneCount} of {total} saved · {Math.round(progress)}%
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3">
          <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#3aa8e8] to-[#2d8abf] transition-[width] duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Checklist */}
        <ul className="px-5 py-3 space-y-1.5 max-h-[40vh] overflow-y-auto">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-start gap-2 text-[12px]">
              <StepIcon status={s.status} />
              <div className={`flex-1 leading-snug ${s.status === 'done' ? 'text-gray-500 dark:text-gray-400 line-through' : s.status === 'error' ? 'text-rose-600 dark:text-rose-300' : 'text-gray-800 dark:text-gray-100'}`}>
                {s.label}
              </div>
              {s.status === 'active' && (
                <span className="text-[10px] uppercase font-semibold text-[#3aa8e8]">Saving…</span>
              )}
              {s.status === 'done' && (
                <span className="text-[10px] uppercase font-semibold text-emerald-600">Saved</span>
              )}
              {s.status === 'error' && (
                <span className="text-[10px] uppercase font-semibold text-rose-600">Failed</span>
              )}
              {/* index marker (hidden visually, keeps keys stable) */}
              <span className="sr-only">Step {i + 1}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
        <Check className="w-3 h-3" />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div className="w-4 h-4 rounded-full border-2 border-[#3aa8e8] border-t-transparent animate-spin flex-shrink-0" />
    );
  }
  if (status === 'error') {
    return (
      <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] flex-shrink-0">
        !
      </div>
    );
  }
  return <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />;
}
