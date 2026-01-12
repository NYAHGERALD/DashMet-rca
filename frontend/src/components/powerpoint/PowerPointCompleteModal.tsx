'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

interface PowerPointCompleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  fileName: string;
  incidentNumber: string;
  rcaId: string;
}

export default function PowerPointCompleteModal({
  open,
  onOpenChange,
  jobId,
  fileName,
  incidentNumber,
  rcaId,
}: PowerPointCompleteModalProps) {
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firebaseUrl, setFirebaseUrl] = useState<string | null>(null);

  const handleDownload = async () => {
    try {
      setError(null);
      setDownloading(true);
      
      // Fetch the file
      const response = await api.get(`/powerpoint/download/${jobId}`, {
        responseType: 'blob',
      });

      // Create download link
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download failed:', err);
      setError('Failed to download file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveToFirebase = async () => {
    try {
      setError(null);
      setSaving(true);
      
      const response = await api.post(`/powerpoint/save/${jobId}`);
      
      if (response.data.success) {
        setSaved(true);
        setFirebaseUrl(response.data.firebaseUrl);
      } else {
        setError(response.data.error || 'Failed to save to cloud');
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      setError(err.response?.data?.error || 'Failed to save to cloud');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after modal closes
    setTimeout(() => {
      setSaved(false);
      setError(null);
      setFirebaseUrl(null);
    }, 300);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        />
        
        {/* Modal */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md transform transition-all overflow-hidden"
        >
          {/* Success Animation */}
          <div className="relative h-24 sm:h-32 bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-teal-500/20 flex items-center justify-center overflow-hidden">
            {/* Animated circles background */}
            <motion.div 
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div 
                className="w-20 h-20 sm:w-24 sm:h-24 bg-green-500/10 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ repeat: Infinity, duration: 3 }}
              />
              <motion.div 
                className="absolute w-14 h-14 sm:w-16 sm:h-16 bg-green-500/15 rounded-full"
                animate={{ scale: [1.2, 1, 1.2] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
              />
            </motion.div>
            
            {/* Success icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="relative z-10 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30"
            >
              <motion.svg 
                className="w-6 h-6 sm:w-8 sm:h-8 text-white" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <motion.path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={3} 
                  d="M5 13l4 4L19 7"
                />
              </motion.svg>
            </motion.div>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div className="text-center mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-1.5 sm:mb-2">
                PowerPoint Ready!
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm">
                Your RCA report has been generated successfully
              </p>
            </div>

            {/* File Info Card */}
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-slate-800/50 border border-slate-700/30 mb-4 sm:mb-6">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-lg shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-white truncate">{fileName}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">{incidentNumber} • PowerPoint Presentation</p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-2.5 sm:p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-3 sm:mb-4">
                <p className="text-xs sm:text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Saved Success Message */}
            {saved && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2.5 sm:p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-3 sm:mb-4"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xs sm:text-sm text-green-300">Saved to cloud storage successfully!</p>
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 sm:space-y-3">
              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 touch-manipulation"
              >
                {downloading ? (
                  <>
                    <motion.div 
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    />
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download PowerPoint</span>
                  </>
                )}
              </button>

              {/* Save to Firebase Button */}
              <button
                onClick={handleSaveToFirebase}
                disabled={saving || saved}
                className={`w-full px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed touch-manipulation ${
                  saved 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600'
                } disabled:opacity-60`}
              >
                {saving ? (
                  <>
                    <motion.div 
                      className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    />
                    <span>Saving to Cloud...</span>
                  </>
                ) : saved ? (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Saved to Cloud</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>Save to Cloud Storage</span>
                  </>
                )}
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="w-full mt-3 sm:mt-4 px-4 py-2 text-slate-400 hover:text-slate-300 text-xs sm:text-sm font-medium transition-colors touch-manipulation"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
