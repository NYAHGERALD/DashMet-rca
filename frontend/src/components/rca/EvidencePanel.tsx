'use client';

import { formatDate } from '@/lib/dateUtils';

interface Evidence {
  id: string;
  type: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  transcription?: string;
  uploadedAt: string;
}

interface EvidencePanelProps {
  incidentEvidence: Evidence[];
  rcaEvidence: Evidence[];
}

export default function EvidencePanel({ incidentEvidence, rcaEvidence }: EvidencePanelProps) {
  const allEvidence = [...incidentEvidence, ...rcaEvidence];

  const getEvidenceIcon = (type: string, mimeType: string) => {
    if (type === 'PHOTO' || mimeType.startsWith('image/')) {
      return (
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (type === 'VIDEO' || mimeType.startsWith('video/')) {
      return (
        <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    }
    if (type === 'AUDIO' || mimeType.startsWith('audio/')) {
      return (
        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = (evidence: Evidence) => {
    // In a real app, this would download from Firebase Storage
    window.open(evidence.filePath, '_blank');
  };

  if (allEvidence.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          No evidence attached
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="space-y-3">
        {allEvidence.map((evidence) => (
          <div
            key={evidence.id}
            className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
            onClick={() => handleDownload(evidence)}
          >
            <div className="flex-shrink-0">
              {getEvidenceIcon(evidence.type, evidence.mimeType)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {evidence.fileName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatFileSize(evidence.fileSize)} • {formatDate(evidence.uploadedAt)}
              </p>
              {evidence.transcription && (
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                  <span className="font-medium">Transcription:</span> {evidence.transcription}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Evidence Types:</p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center text-xs text-gray-600 dark:text-gray-300">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
            Photos
          </span>
          <span className="inline-flex items-center text-xs text-gray-600 dark:text-gray-300">
            <span className="w-2 h-2 bg-purple-500 rounded-full mr-1"></span>
            Videos
          </span>
          <span className="inline-flex items-center text-xs text-gray-600 dark:text-gray-300">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
            Audio
          </span>
          <span className="inline-flex items-center text-xs text-gray-600 dark:text-gray-300">
            <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
            Documents
          </span>
        </div>
      </div>
    </div>
  );
}
