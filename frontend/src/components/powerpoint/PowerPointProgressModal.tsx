'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

interface PowerPointProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rcaId: string;
  incidentNumber: string;
  onComplete?: (jobId: string, fileName: string) => void;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  message: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

const STEP_ICONS: Record<string, string> = {
  queued: '⏳',
  initializing: '🚀',
  collecting_data: '📊',
  generating_narrative: '✍️',
  processing_rca: '🔍',
  formatting_capa: '📋',
  embedding_evidence: '📎',
  finalizing: '✨',
  generating_file: '💾',
  complete: '✅',
};

const STEP_LABELS: Record<string, string> = {
  queued: 'Queued',
  initializing: 'Initializing',
  collecting_data: 'Collecting Data',
  generating_narrative: 'AI Writing Summary',
  processing_rca: 'Processing RCA',
  formatting_capa: 'Formatting CAPA',
  embedding_evidence: 'Processing Evidence',
  finalizing: 'Finalizing',
  generating_file: 'Creating File',
  complete: 'Complete!',
};

export default function PowerPointProgressModal({
  open,
  onOpenChange,
  rcaId,
  incidentNumber,
  onComplete,
}: PowerPointProgressModalProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasStarted = useRef(false);

  // Start the generation process
  const startGeneration = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    
    try {
      setError(null);
      const response = await api.post(`/powerpoint/generate/${rcaId}`);
      
      if (response.data.success && response.data.jobId) {
        setJobId(response.data.jobId);
        setStatus({
          id: response.data.jobId,
          status: 'pending',
          progress: 0,
          currentStep: 'queued',
          message: 'Starting generation...',
        });
      } else {
        setError(response.data.error || 'Failed to start generation');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to start generation');
    }
  }, [rcaId]);

  // Poll for status updates
  const pollStatus = useCallback(async () => {
    if (!jobId) return;

    try {
      const response = await api.get(`/powerpoint/status/${jobId}`);
      
      if (response.data.success) {
        const job = response.data.job as JobStatus;
        setStatus(job);

        // Stop polling if completed or failed
        if (job.status === 'completed' || job.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          if (job.status === 'completed' && onComplete && job.fileName) {
            onComplete(jobId, job.fileName);
          }

          if (job.status === 'failed') {
            setError(job.error || 'Generation failed');
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to poll status:', err);
    }
  }, [jobId, onComplete]);

  // Start generation when modal opens
  useEffect(() => {
    if (open && rcaId && !hasStarted.current) {
      startGeneration();
    }
  }, [open, rcaId, startGeneration]);

  // Start polling when we have a jobId
  useEffect(() => {
    if (jobId && open) {
      pollStatus(); // Initial poll
      pollIntervalRef.current = setInterval(pollStatus, 500);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [jobId, open, pollStatus]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Reset after animation
      setTimeout(() => {
        if (!open) {
          hasStarted.current = false;
          setJobId(null);
          setStatus(null);
          setError(null);
        }
      }, 300);
    }
  }, [open]);

  const handleClose = () => {
    if (status?.status === 'processing' || status?.status === 'pending') {
      // Optionally warn user that generation is in progress
      if (!confirm('PowerPoint generation is in progress. Are you sure you want to close?')) {
        return;
      }
    }
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    onOpenChange(false);
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!open) return null;

  const isComplete = status?.status === 'completed';
  const isFailed = status?.status === 'failed';
  const isProcessing = status?.status === 'processing' || status?.status === 'pending';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
          onClick={isProcessing ? undefined : handleClose}
        />
        
        {/* Modal */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg transform transition-all overflow-hidden"
        >
          {/* Header */}
          <div className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-700/50">
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="absolute top-3 sm:top-4 right-3 sm:right-4 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1 touch-manipulation"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-2 sm:gap-3 pr-8">
              <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-lg sm:rounded-xl">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">
                  {isComplete ? 'PowerPoint Ready!' : isFailed ? 'Generation Failed' : 'Generating PowerPoint'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400">{incidentNumber}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            {/* Progress Bar */}
            {!isFailed && (
              <div className="mb-4 sm:mb-6">
                <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                  <span className="text-xs sm:text-sm font-medium text-slate-300">
                    {status?.currentStep ? STEP_LABELS[status.currentStep] || status.currentStep : 'Starting...'}
                  </span>
                  <span className="text-xs sm:text-sm text-slate-400">{status?.progress || 0}%</span>
                </div>
                <div className="h-1.5 sm:h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      isComplete 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                        : 'bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${status?.progress || 0}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            {/* Status Message */}
            <AnimatePresence mode="wait">
              <motion.div
                key={status?.currentStep || 'initial'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-slate-800/50 border border-slate-700/30"
              >
                {isProcessing && (
                  <div className="relative">
                    <span className="text-xl sm:text-2xl">{STEP_ICONS[status?.currentStep || 'queued']}</span>
                    <motion.div
                      className="absolute -inset-1 bg-blue-500/20 rounded-full"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    />
                  </div>
                )}
                {isComplete && <span className="text-xl sm:text-2xl">🎉</span>}
                {isFailed && <span className="text-xl sm:text-2xl">❌</span>}

                <div className="flex-1 min-w-0">
                  <p className={`text-xs sm:text-sm ${isFailed ? 'text-red-300' : 'text-slate-300'}`}>
                    {status?.message || error || 'Initializing...'}
                  </p>
                  {isComplete && status?.fileSize && (
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                      File size: {formatFileSize(status.fileSize)}
                    </p>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Step Indicators */}
            {isProcessing && (
              <div className="mt-4 sm:mt-6 grid grid-cols-5 gap-1.5 sm:gap-2">
                {['collecting_data', 'generating_narrative', 'processing_rca', 'formatting_capa', 'generating_file'].map((step, idx) => {
                  const progress = status?.progress || 0;
                  const stepProgress = ((idx + 1) / 5) * 100;
                  const isActive = progress >= stepProgress - 20 && progress < stepProgress;
                  const isCompleted = progress >= stepProgress;
                  
                  return (
                    <div key={step} className="flex flex-col items-center">
                      <div 
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm transition-all ${
                          isCompleted 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                            : isActive 
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 animate-pulse' 
                              : 'bg-slate-700/50 text-slate-500 border border-slate-600/30'
                        }`}
                      >
                        {STEP_ICONS[step]}
                      </div>
                      <span className={`text-[8px] sm:text-[10px] mt-1 text-center leading-tight ${
                        isCompleted || isActive ? 'text-slate-300' : 'text-slate-500'
                      }`}>
                        {STEP_LABELS[step]?.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Error State */}
            {isFailed && (
              <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-xs sm:text-sm text-red-300">{error || status?.error || 'An unknown error occurred'}</p>
                <button
                  onClick={() => {
                    hasStarted.current = false;
                    setError(null);
                    setStatus(null);
                    startGeneration();
                  }}
                  className="mt-2 sm:mt-3 text-xs sm:text-sm text-red-400 hover:text-red-300 underline underline-offset-2 touch-manipulation"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* Footer - Action Buttons */}
          {isComplete && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-slate-700/30">
              <p className="text-[10px] sm:text-xs text-slate-500 mb-3 sm:mb-4 text-center">
                Your PowerPoint report is ready. Choose an option below.
              </p>
              
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700/50 transition-colors text-xs sm:text-sm font-medium touch-manipulation"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Processing Footer */}
          {isProcessing && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2">
              <p className="text-[10px] sm:text-xs text-slate-500 text-center">
                AI is crafting your presentation. This may take 20-60 seconds...
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
