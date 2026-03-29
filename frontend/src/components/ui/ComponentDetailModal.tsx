'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface PhotoItem {
  url: string;
  name: string;
}

interface ComponentData {
  id: string;
  name: string;
  description?: string;
  partNumber?: string;
  manufacturer?: string;
  photos?: PhotoItem[];
  isCritical: boolean;
  status: string;
}

interface MachineData {
  id: string;
  name: string;
  description?: string;
  assetTag?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status: string;
  photos?: PhotoItem[];
  Line?: {
    name: string;
    lineNumber?: string;
    Area?: {
      name: string;
      Department?: {
        name: string;
        Facility?: { name: string };
      };
    };
  };
}

interface ComponentDetailModalProps {
  component: ComponentData;
  machine: MachineData;
  onClose: () => void;
  onPhotoClick: (photos: PhotoItem[], index: number) => void;
}

const DEFAULT_WIDTH = 700;
const DEFAULT_HEIGHT = 560;
const MIN_WIDTH = 480;
const MIN_HEIGHT = 400;

export default function ComponentDetailModal({
  component,
  machine,
  onClose,
  onPhotoClick,
}: ComponentDetailModalProps) {
  // ─── Position & size state ──────────────────────────────────────────────
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
  const [maximized, setMaximized] = useState(false);
  const [prevState, setPrevState] = useState({ x: 0, y: 0, w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
  const [mounted, setMounted] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const resizeRef = useRef({ resizing: false, startX: 0, startY: 0, origW: 0, origH: 0 });

  // Center on mount
  useEffect(() => {
    const x = Math.max(0, (window.innerWidth - DEFAULT_WIDTH) / 2);
    const y = Math.max(0, (window.innerHeight - DEFAULT_HEIGHT) / 2);
    setPos({ x, y });
    setPrevState({ x, y, w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // ─── Drag logic ────────────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (maximized) return;
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.origX + dx, y: Math.max(0, dragRef.current.origY + dy) });
    };
    const onUp = () => {
      dragRef.current.dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [maximized, pos]);

  // ─── Touch drag logic ──────────────────────────────────────────────────
  const onTouchDragStart = useCallback((e: React.TouchEvent) => {
    if (maximized) return;
    const touch = e.touches[0];
    dragRef.current = { dragging: true, startX: touch.clientX, startY: touch.clientY, origX: pos.x, origY: pos.y };

    const onMove = (ev: TouchEvent) => {
      if (!dragRef.current.dragging) return;
      const t = ev.touches[0];
      const dx = t.clientX - dragRef.current.startX;
      const dy = t.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.origX + dx, y: Math.max(0, dragRef.current.origY + dy) });
    };
    const onUp = () => {
      dragRef.current.dragging = false;
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }, [maximized, pos]);

  // ─── Resize logic ──────────────────────────────────────────────────────
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    if (maximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { resizing: true, startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current.resizing) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      setSize({
        w: Math.max(MIN_WIDTH, resizeRef.current.origW + dw),
        h: Math.max(MIN_HEIGHT, resizeRef.current.origH + dh),
      });
    };
    const onUp = () => {
      resizeRef.current.resizing = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [maximized, size]);

  // ─── Maximize / restore ────────────────────────────────────────────────
  const toggleMaximize = () => {
    if (maximized) {
      setPos({ x: prevState.x, y: prevState.y });
      setSize({ w: prevState.w, h: prevState.h });
      setMaximized(false);
    } else {
      setPrevState({ x: pos.x, y: pos.y, w: size.w, h: size.h });
      setPos({ x: 0, y: 0 });
      setSize({ w: window.innerWidth, h: window.innerHeight });
      setMaximized(true);
    }
  };

  const compPhotos = component.photos || [];
  const machinePhotos = machine.photos || [];
  const statusLabel = component.status === 'ACTIVE' ? 'Active' : component.status === 'MAINTENANCE' ? 'Maintenance' : component.status === 'INACTIVE' ? 'Inactive' : component.status === 'RETIRED' ? 'Retired' : component.status;
  const statusColor = component.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : component.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

  const area = machine.Line?.Area;
  const dept = area?.Department;
  const fac = dept?.Facility;

  return (
    <div
      ref={modalRef}
      className={`fixed z-[60] flex flex-col bg-white dark:bg-slate-800 shadow-2xl border border-gray-200 dark:border-slate-700 ${maximized ? '' : 'rounded-xl'}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        transition: mounted
          ? maximized || (!dragRef.current.dragging && !resizeRef.current.resizing)
            ? 'left 0.25s cubic-bezier(.4,0,.2,1), top 0.25s cubic-bezier(.4,0,.2,1), width 0.25s cubic-bezier(.4,0,.2,1), height 0.25s cubic-bezier(.4,0,.2,1)'
            : 'none'
          : 'none',
        willChange: 'left, top, width, height',
      }}
    >
      {/* ─── Title bar (drag handle) ──────────────────────────────────── */}
      <div
        className={`flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-900 dark:to-slate-950 text-white select-none cursor-move flex-shrink-0 ${maximized ? '' : 'rounded-t-xl'}`}
        onMouseDown={onDragStart}
        onTouchStart={onTouchDragStart}
        onDoubleClick={toggleMaximize}
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold truncate">{component.name}</h3>
          <p className="text-xs text-gray-300 truncate">{machine.name}</p>
        </div>
        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
          {/* Minimize / restore */}
          <button
            onClick={toggleMaximize}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title={maximized ? 'Restore' : 'Maximize'}
          >
            {maximized ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V5a1 1 0 011-1h9a1 1 0 011 1v9a1 1 0 01-1 1h-4M15 15v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-9a1 1 0 011-1h4" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
            )}
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-500/80 rounded transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* ─── Scrollable content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Component Info */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Component Details</h4>
          <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-gray-900 dark:text-white">{component.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
              {component.isCritical && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">CRITICAL</span>
              )}
            </div>
            {component.partNumber && (
              <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Part #:</span> {component.partNumber}</p>
            )}
            {component.manufacturer && (
              <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Manufacturer:</span> {component.manufacturer}</p>
            )}
            {component.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Description:</span> {component.description}</p>
            )}
          </div>
        </section>

        {/* Component Photos */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Component Photos</h4>
          {compPhotos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {compPhotos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 overflow-hidden cursor-pointer group hover:ring-2 hover:ring-blue-400 transition-all"
                  onClick={() => onPhotoClick(compPhotos, idx)}
                >
                  <img src={photo.url} alt={photo.name} className="w-full h-full object-contain" />
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.name}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 rounded-lg border border-dashed border-gray-300 dark:border-slate-600 bg-gray-50/50 dark:bg-slate-900/50">
              <p className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">
                There are no photos associated to this component
              </p>
            </div>
          )}
        </section>

        {/* Machine Info */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Machine Details</h4>
          <div className="bg-blue-50/60 dark:bg-blue-950/20 rounded-lg p-4 space-y-2 border border-blue-100 dark:border-blue-900/30">
            <p className="text-base font-semibold text-gray-900 dark:text-white">{machine.name}</p>
            {machine.assetTag && (
              <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Asset Tag:</span> {machine.assetTag}</p>
            )}
            {machine.manufacturer && (
              <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Manufacturer:</span> {machine.manufacturer}{machine.model ? ` — ${machine.model}` : ''}</p>
            )}
            {machine.serialNumber && (
              <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Serial #:</span> {machine.serialNumber}</p>
            )}
            {machine.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Description:</span> {machine.description}</p>
            )}
            {fac && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">Location:</span>{' '}
                {fac.name} → {dept?.name} → {area?.name} → {machine.Line?.lineNumber || machine.Line?.name}
              </p>
            )}
          </div>
        </section>

        {/* Machine Photos */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Machine Photos</h4>
          {machinePhotos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {machinePhotos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 overflow-hidden cursor-pointer group hover:ring-2 hover:ring-blue-400 transition-all"
                  onClick={() => onPhotoClick(machinePhotos, idx)}
                >
                  <img src={photo.url} alt={photo.name} className="w-full h-full object-contain" />
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.name}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 rounded-lg border border-dashed border-gray-300 dark:border-slate-600 bg-gray-50/50 dark:bg-slate-900/50">
              <p className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">
                There are no photos associated to this machine
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ─── Resize handle (bottom-right) ─────────────────────────────── */}
      {!maximized && (
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-10"
          onMouseDown={onResizeStart}
        >
          <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 absolute bottom-0.5 right-0.5" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="8" cy="12" r="1.5" />
            <circle cx="12" cy="8" r="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
}
