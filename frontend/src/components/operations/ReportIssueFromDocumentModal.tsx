'use client';

/**
 * ReportIssueFromDocumentModal
 * -----------------------------
 * Drag-and-drop / file-picker modal that uploads a single document
 * (JPEG, PNG, PDF, DOCX, XLSX) to the AI extraction endpoint and
 * passes the resulting prefill payload to the parent, which then opens
 * the existing Report Issue review form.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, UploadCloud, FileText, Image as ImageIcon, FileSpreadsheet, Loader2, Sparkles, AlertCircle, Check, GripHorizontal } from 'lucide-react';
import api from '@/lib/api';

const ACCEPTED = ['.jpeg', '.jpg', '.png', '.pdf', '.docx', '.xlsx'];
const ACCEPT_ATTR = 'image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ExtractedSharedContext {
  departmentId?: string | null;
  areaId?: string | null;
  lineId?: string | null;
  shiftId?: string | null;
  weekNumber?: number | null;
  dayOfWeekId?: string | null;
  resolved?: {
    departmentName?: string | null;
    areaName?: string | null;
    lineName?: string | null;
    shiftName?: string | null;
    dayName?: string | null;
  };
}

export interface ExtractedIssueItem {
  type?: 'MACHINE' | 'QUALITY' | null;
  title?: string | null;
  description?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  equipmentId?: string | null;
  componentId?: string | null;
  startTime?: string | null;
  totalMinutesLost?: number | null;
  resolved?: {
    equipmentName?: string | null;
    componentName?: string | null;
  };
}

export interface ExtractionResult {
  context: ExtractedSharedContext;
  issues: ExtractedIssueItem[];
  notes?: string | null;
  confidence?: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onExtracted: (result: ExtractionResult, sourceFile: File) => void;
  /** If provided, the modal auto-starts extracting this file when it opens (used for "Reanalyze"). */
  initialFile?: File | null;
}

type Stage = 'idle' | 'uploading' | 'processing' | 'mapping' | 'done' | 'error';

export default function ReportIssueFromDocumentModal({ open, onClose, onExtracted, initialFile }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0); // animated 0..100
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoRanRef = useRef(false);
  const targetProgressRef = useRef(0);
  const progressRafRef = useRef<number | null>(null);

  // Draggable modal position
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const width = 640;
    const height = 440;
    setPos({
      x: Math.max(16, Math.floor((window.innerWidth - width) / 2)),
      y: Math.max(16, Math.floor((window.innerHeight - height) / 2)),
    });
  }, [open]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 120, dragRef.current.origX + dx)),
        y: Math.max(8, Math.min(window.innerHeight - 60, dragRef.current.origY + dy)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos.x, pos.y]);

  const reset = () => {
    setStage('idle');
    setFile(null);
    setErrorMsg(null);
    setProgress(0);
    targetProgressRef.current = 0;
    if (progressRafRef.current) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
  };

  const handleClose = () => {
    if (stage === 'uploading' || stage === 'processing' || stage === 'mapping') return;
    reset();
    onClose();
  };

  const validate = (f: File): string | null => {
    const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      return `Unsupported file type. Accepted: ${ACCEPTED.join(', ')}`;
    }
    if (f.size > 25 * 1024 * 1024) return 'File is too large (max 25 MB).';
    return null;
  };

  // Smoothly ease `progress` toward `targetProgressRef.current`
  const startProgressLoop = useCallback(() => {
    if (progressRafRef.current) return;
    const tick = () => {
      setProgress((p) => {
        const target = targetProgressRef.current;
        const next = p + (target - p) * 0.12;
        if (Math.abs(target - p) < 0.15) return target;
        return next;
      });
      progressRafRef.current = requestAnimationFrame(tick);
    };
    progressRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopProgressLoop = useCallback(() => {
    if (progressRafRef.current) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
  }, []);

  const waitForProgress = (cutoff: number) =>
    new Promise<void>((resolve) => {
      const check = () => {
        setProgress((p) => {
          if (p >= cutoff - 0.25) { resolve(); return p; }
          requestAnimationFrame(check);
          return p;
        });
      };
      requestAnimationFrame(check);
    });

  const processFile = useCallback(async (f: File) => {
    const v = validate(f);
    if (v) {
      setErrorMsg(v);
      setStage('error');
      return;
    }
    setErrorMsg(null);
    setFile(f);
    setProgress(0);
    targetProgressRef.current = 0;
    setStage('uploading');
    startProgressLoop();

    // Drift the target forward so the bar keeps moving during the long AI call
    const drift = setInterval(() => {
      targetProgressRef.current = Math.min(80, targetProgressRef.current + 1.2);
    }, 300);

    try {
      const fd = new FormData();
      fd.append('file', f);

      const res = await api.post('/operations/issues/extract-from-document', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
        onUploadProgress: (evt) => {
          if (evt.total) {
            const uploadPct = Math.min(30, Math.round((evt.loaded / evt.total) * 30));
            if (uploadPct > targetProgressRef.current) targetProgressRef.current = uploadPct;
            if (evt.loaded >= evt.total) setStage('processing');
          }
        },
      });

      clearInterval(drift);

      if (res.data?.success && res.data?.data) {
        // Mapping band (80-95%) then snap to 100% after a tiny hold
        setStage('mapping');
        targetProgressRef.current = 95;
        await waitForProgress(92);
        targetProgressRef.current = 100;
        setStage('done');
        await waitForProgress(99.5);
        await new Promise((r) => setTimeout(r, 450));
        stopProgressLoop();
        onExtracted(res.data.data as ExtractionResult, f);
        reset();
        return;
      } else {
        stopProgressLoop();
        setErrorMsg(res.data?.error || 'AI could not extract data from this document.');
        setStage('error');
      }
    } catch (err: any) {
      clearInterval(drift);
      stopProgressLoop();
      setErrorMsg(err?.response?.data?.error || err?.message || 'Upload failed.');
      setStage('error');
    }
  }, [onExtracted, startProgressLoop, stopProgressLoop]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void processFile(f);
  };

  // Auto-process when an `initialFile` is supplied (Reanalyze flow)
  if (open && initialFile && !autoRanRef.current && stage === 'idle') {
    autoRanRef.current = true;
    void processFile(initialFile);
  }
  if (!open && autoRanRef.current) {
    autoRanRef.current = false;
  }

  if (!open) return null;

  const busy = stage === 'uploading' || stage === 'processing' || stage === 'mapping' || stage === 'done';

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <div
        className="absolute w-[min(640px,calc(100vw-32px))] rounded-2xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden ring-1 ring-black/10 pointer-events-auto animate-fade-in"
        style={{ top: pos.y, left: pos.x }}
      >
        {/* Header (drag handle) */}
        <div
          className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#3aa8e8] to-[#2d8abf] text-white cursor-move select-none"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 opacity-70" />
            <Sparkles className="w-5 h-5" />
            <h2 className="text-base font-bold">Report Issue from Document</h2>
          </div>
          <button
            onClick={handleClose}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={busy}
            className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {stage === 'idle' || stage === 'error' ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Upload a document describing the issue. Our AI will read it, map the content to the right fields, and let you review before saving.
              </p>

              {/* Drop zone */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`w-full flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-xl border-2 border-dashed transition-colors ${
                  dragOver
                    ? 'border-[#3aa8e8] bg-[#3aa8e8]/5'
                    : 'border-gray-300 dark:border-gray-600 hover:border-[#3aa8e8] hover:bg-[#3aa8e8]/5'
                }`}
              >
                <UploadCloud className="w-10 h-10 text-[#3aa8e8]" />
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Drag & drop a file here
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  or click to browse
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                title="Choose a document to upload"
                aria-label="Choose a document to upload"
                accept={ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void processFile(f);
                  e.target.value = '';
                }}
              />

              {/* Accepted formats */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
                  <ImageIcon className="w-3 h-3" /> .jpeg / .png
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
                  <FileText className="w-3 h-3" /> .pdf / .docx
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
                  <FileSpreadsheet className="w-3 h-3" /> .xlsx
                </span>
              </div>

              {stage === 'error' && errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">{errorMsg}</div>
                </div>
              )}
            </>
          ) : (
            <ProcessingView stage={stage} fileName={file?.name || ''} progress={progress} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
          <button
            onClick={handleClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}

function ProcessingView({ stage, fileName, progress }: { stage: Stage; fileName: string; progress: number }) {
  const steps = [
    { key: 'uploading', label: 'Uploading document', threshold: 0 },
    { key: 'processing', label: 'Analyzing content with AI', threshold: 30 },
    { key: 'mapping', label: 'Mapping fields to your schema', threshold: 80 },
    { key: 'done', label: 'Ready to review', threshold: 100 },
  ];
  const stageRank: Record<Stage, number> = {
    idle: -1,
    error: -1,
    uploading: 0,
    processing: 1,
    mapping: 2,
    done: 3,
  };
  const currentRank = stageRank[stage] ?? -1;
  const pct = Math.max(0, Math.min(100, progress));

  return (
    <div className="py-5 flex flex-col items-center text-center space-y-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[#3aa8e8]/20 blur-xl animate-pulse" />
        <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#3aa8e8] to-[#2d8abf] flex items-center justify-center shadow-lg">
          {pct >= 100 ? (
            <Check className="w-7 h-7 text-white" />
          ) : (
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          )}
        </div>
      </div>
      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate max-w-full px-6">
        {fileName}
      </div>

      {/* Progress bar + percentage */}
      <div className="w-full max-w-sm px-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
          <span>
            {stage === 'uploading' && 'Uploading…'}
            {stage === 'processing' && 'Analyzing…'}
            {stage === 'mapping' && 'Mapping fields…'}
            {stage === 'done' && 'Complete'}
          </span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#3aa8e8] to-[#2d8abf] transition-[width] duration-150 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <ul className="space-y-1.5 text-[13px] text-left w-full max-w-sm px-2">
        {steps.map((s, i) => {
          const done = i < currentRank || pct >= 100;
          const active = i === currentRank && pct < 100;
          return (
            <li key={s.key} className="flex items-center gap-2">
              {done ? (
                <span className="inline-flex w-4 h-4 rounded-full bg-emerald-500 text-white items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3" />
                </span>
              ) : active ? (
                <span className="inline-flex w-4 h-4 rounded-full border-2 border-[#3aa8e8] border-t-transparent animate-spin flex-shrink-0" />
              ) : (
                <span className="inline-flex w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
              )}
              <span className={done || active ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400'}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
