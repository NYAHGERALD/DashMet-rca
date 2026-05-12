'use client';

import React, { useEffect, useRef, useState } from 'react';
import { formatDateTime, formatTime as formatTimeUtil } from '@/lib/dateUtils';

interface SubmittedIncidentData {
  id: string;
  incidentNumber: string;
  title: string;
  type: string;
  category?: string;
  severity: string;
  status: string;
  date: string;
  time: string;
  facility?: string;
  area?: string;
  line?: string;
  shift?: string;
  description: string;
  aiSummary?: string;
  attachmentCount: number;
  visibility?: string;
  recommendedRCAMethodology?: {
    primary: string;
    reason: string;
    confidence: number;
    alternativeMethod?: string;
    alternativeReason?: string;
  } | null;
}

interface IncidentSubmissionModalProps {
  isOpen: boolean;
  incidentData: SubmittedIncidentData | null;
  onViewIncident: () => void | Promise<void>;
  onGoToDashboard: () => void | Promise<void>;
}

const IncidentSubmissionModal: React.FC<IncidentSubmissionModalProps> = ({
  isOpen,
  incidentData,
  onViewIncident,
  onGoToDashboard,
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [isPositionReady, setIsPositionReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingAction, setPendingAction] = useState<'view' | 'dashboard' | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const centerModal = () => {
      const rect = modalRef.current?.getBoundingClientRect();
      const width = rect?.width || Math.min(736, window.innerWidth - 16);
      const height = rect?.height || Math.min(760, window.innerHeight - 16);

      setPosition({
        left: Math.max(8, (window.innerWidth - width) / 2),
        top: Math.max(8, (window.innerHeight - height) / 2),
      });
      setIsPositionReady(true);
    };

    setIsPositionReady(false);
    requestAnimationFrame(centerModal);
    window.addEventListener('resize', centerModal);

    return () => {
      window.removeEventListener('resize', centerModal);
      dragStateRef.current = null;
      setIsDragging(false);
    };
  }, [isOpen]);

  if (!isOpen || !incidentData) return null;

  const clampModalPosition = (left: number, top: number) => {
    const rect = modalRef.current?.getBoundingClientRect();
    const width = rect?.width || 0;
    const height = rect?.height || 0;
    const margin = 8;

    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin)),
      top: Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - height - margin)),
    };
  };

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPositionReady || event.button !== 0) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: position.left,
      originTop: position.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const nextLeft = dragState.originLeft + event.clientX - dragState.startX;
    const nextTop = dragState.originTop + event.clientY - dragState.startY;
    setPosition(clampModalPosition(nextLeft, nextTop));
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (dragState?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setIsDragging(false);
    }
  };

  const runAction = async (action: 'view' | 'dashboard', callback: () => void | Promise<void>) => {
    if (pendingAction) return;

    setPendingAction(action);
    try {
      await callback();
    } finally {
      setPendingAction(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'WORKPLACE_SAFETY': return '🦺';
      case 'SECURITY': return '🔒';
      case 'ENVIRONMENTAL': return '🌿';
      case 'QUALITY': return '✓';
      case 'EQUIPMENT': return '⚙️';
      case 'PROCESS': return '🔄';
      case 'BEHAVIORAL': return '👥';
      default: return '📋';
    }
  };

  // Use centralized date formatting with proper timezone handling
  const formatDate = (dateStr: string) => {
    try {
      return formatDateTime(dateStr, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: undefined, minute: undefined });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    try {
      // If it's just a time string like "14:30", format it
      if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      }
      // Otherwise use the utility
      return formatTimeUtil(timeStr);
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-transparent p-2 pointer-events-none sm:p-3">
      {/* Modal Content */}
      <div
        ref={modalRef}
        style={isPositionReady ? {
          left: position.left,
          top: position.top,
          width: 'min(46rem, calc(100vw - 1rem))',
          maxHeight: 'calc(100dvh - 1rem)',
        } : {
          left: '50%',
          top: '50%',
          width: 'min(46rem, calc(100vw - 1rem))',
          maxHeight: 'calc(100dvh - 1rem)',
          transform: 'translate(-50%, -50%)',
        }}
        className={`pointer-events-auto fixed flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-2xl shadow-slate-900/20 dark:bg-slate-800 dark:shadow-black/30 ${
          isDragging ? 'select-none' : ''
        }`}
      >
        {/* Success Header */}
        <div
          className={`relative shrink-0 overflow-hidden bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 p-3 text-center sm:p-4 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          style={{ touchAction: 'none' }}
        >
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,white_25%,white_50%,transparent_50%,transparent_75%,white_75%)] bg-[length:20px_20px] animate-slide-pattern" />
          </div>

          {/* Success icon with animation */}
          <div className="relative">
            <div className="w-10 h-10 mx-auto mb-2 bg-white rounded-full flex items-center justify-center shadow-lg animate-bounce-once sm:w-12 sm:h-12">
              <svg className="w-6 h-6 text-green-500 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={3} 
                  d="M5 13l4 4L19 7"
                  className="animate-draw-check"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white sm:text-xl">Incident Submitted Successfully!</h2>
            <p className="mt-1 text-xs text-green-100 sm:text-sm">
              Your incident report has been recorded and is ready for review
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {/* Incident Summary Card */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-lg p-3 mb-3 border border-slate-200 dark:border-slate-600 sm:p-4 sm:mb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl">{getTypeIcon(incidentData.type)}</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {incidentData.incidentNumber}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {incidentData.type?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(incidentData.severity)}`}>
                {incidentData.severity}
              </span>
            </div>

            <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">
              {incidentData.title}
            </h4>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
              {incidentData.description}
            </p>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-600 sm:grid-cols-4">
              <div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Date</p>
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                  {formatDate(incidentData.date)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Time</p>
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                  {formatTime(incidentData.time)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Status</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {incidentData.status}
                </span>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Attachments</p>
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                  {incidentData.attachmentCount} file{incidentData.attachmentCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Location & Category Info */}
          <div className="grid grid-cols-1 gap-3 mb-3 sm:grid-cols-2 sm:mb-4">
            {/* Location Card */}
            <div className="bg-white dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
              <h5 className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                <span className="text-base">📍</span> Location Details
              </h5>
              <div className="space-y-1.5">
                {incidentData.facility && (
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Facility:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium text-right">{incidentData.facility}</span>
                  </div>
                )}
                {incidentData.area && (
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Area:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium text-right">{incidentData.area}</span>
                  </div>
                )}
                {incidentData.line && (
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Line:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium text-right">{incidentData.line}</span>
                  </div>
                )}
                {incidentData.shift && (
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Shift:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium text-right">{incidentData.shift}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Category & Visibility Card */}
            <div className="bg-white dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
              <h5 className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                <span className="text-base">📁</span> Classification
              </h5>
              <div className="space-y-1.5">
                {incidentData.category && (
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Category:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium text-right">{incidentData.category}</span>
                  </div>
                )}
                {incidentData.visibility && (
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Visibility:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium capitalize text-right">{incidentData.visibility?.toLowerCase()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary Card */}
          {incidentData.aiSummary && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 mb-4 dark:border-blue-800 dark:bg-blue-900/20">
              <h5 className="mb-2 text-xs font-semibold text-blue-800 dark:text-blue-300">
                Incident Summary
              </h5>
              <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed">
                {incidentData.aiSummary}
              </p>
            </div>
          )}

          {/* RCA Methodology Recommendation */}
          {incidentData.recommendedRCAMethodology && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 mb-4 dark:border-blue-800 dark:bg-blue-900/20">
              <h5 className="mb-2 text-xs font-semibold text-blue-800 dark:text-blue-300">
                Recommended RCA Method
              </h5>
              <div className="flex items-center gap-2 mb-2">
                <div>
                  <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                    {incidentData.recommendedRCAMethodology.primary === 'FIVE_WHYS' 
                      ? '5 Whys Analysis' 
                      : 'Fishbone (Ishikawa) Diagram'}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    incidentData.recommendedRCAMethodology.confidence >= 80 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : incidentData.recommendedRCAMethodology.confidence >= 50
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}>
                    {incidentData.recommendedRCAMethodology.confidence}% confidence
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {incidentData.recommendedRCAMethodology.reason}
              </p>
            </div>
          )}

        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="shrink-0 p-2.5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 sm:p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => runAction('view', onViewIncident)}
              disabled={pendingAction !== null}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70"
            >
              {pendingAction === 'view' ? 'Opening...' : 'View Incident Details'}
            </button>
            <button
              type="button"
              onClick={() => runAction('dashboard', onGoToDashboard)}
              disabled={pendingAction !== null}
              className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-primary-700 shadow-sm transition-colors hover:bg-blue-100 disabled:cursor-wait disabled:opacity-70 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/30"
            >
              {pendingAction === 'dashboard' ? 'Opening...' : 'Back to Dashboard'}
            </button>
          </div>
        </div>
      </div>

      {/* Custom styles */}
      <style jsx>{`
        @keyframes slide-pattern {
          0% { transform: translateX(0); }
          100% { transform: translateX(20px); }
        }
        @keyframes bounce-once {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes draw-check {
          0% { stroke-dasharray: 100; stroke-dashoffset: 100; }
          100% { stroke-dasharray: 100; stroke-dashoffset: 0; }
        }
        .animate-slide-pattern {
          animation: slide-pattern 1s linear infinite;
        }
        .animate-bounce-once {
          animation: bounce-once 0.6s ease-out;
        }
        .animate-draw-check {
          animation: draw-check 0.6s ease-out forwards;
          animation-delay: 0.2s;
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
        }
      `}</style>
    </div>
  );
};

export default IncidentSubmissionModal;
