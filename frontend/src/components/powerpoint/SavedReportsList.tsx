'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';

interface SavedReport {
  id: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  uploadedAt: string;
  mimeType: string;
}

interface SavedReportsListProps {
  rcaId: string;
  onClose?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function SavedReportsList({ rcaId, onClose }: SavedReportsListProps) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [rcaId]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/powerpoint/history/${rcaId}`);
      if (response.data.success) {
        setReports(response.data.reports || []);
      }
    } catch (err: any) {
      console.error('Failed to load reports:', err);
      setError(err.response?.data?.error || 'Failed to load saved reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (report: SavedReport) => {
    try {
      setDownloading(report.id);
      
      // Get signed URL from backend
      const response = await api.get(`/powerpoint/download-saved/${report.id}`);
      
      if (response.data.success && response.data.url) {
        // Open the signed URL in a new tab to trigger download
        window.open(response.data.url, '_blank');
      } else {
        throw new Error('Failed to get download URL');
      }
    } catch (err: any) {
      console.error('Download failed:', err);
      alert('Failed to download report. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading saved reports...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        <button 
          onClick={loadReports}
          className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-6">
        <svg className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          No saved reports yet
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Generate a PowerPoint and save it to cloud storage
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map((report) => (
        <div 
          key={report.id}
          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* PowerPoint Icon */}
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5zM8 12h3.5a2.5 2.5 0 010 5H10v2H8v-7zm2 3.5h1.5a.5.5 0 000-1H10v1z"/>
              </svg>
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {report.fileName}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatFileSize(report.fileSize)}</span>
                <span>•</span>
                <span>{formatDate(report.uploadedAt)}</span>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={() => handleDownload(report)}
            disabled={downloading === report.id}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading === report.id ? (
              <>
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download</span>
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

// Modal wrapper for SavedReportsList
interface SavedReportsModalProps {
  open: boolean;
  onClose: () => void;
  rcaId: string;
  incidentNumber?: string;
}

export function SavedReportsModal({ open, onClose, rcaId, incidentNumber }: SavedReportsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                📊 Saved PowerPoint Reports
              </h3>
              {incidentNumber && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Incident: {incidentNumber}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            <SavedReportsList rcaId={rcaId} onClose={onClose} />
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
