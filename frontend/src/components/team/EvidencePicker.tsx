'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Image,
  FileVideo,
  FileAudio,
  File,
  X,
  Search,
  Send,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface Evidence {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  transcription?: string;
  uploadedAt: string;
}

interface EvidencePickerProps {
  incidentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (evidence: Evidence, comment: string) => void;
}

const getEvidenceIcon = (type: string) => {
  switch (type) {
    case 'PHOTO':
      return <Image className="w-5 h-5 text-blue-500" />;
    case 'VIDEO':
      return <FileVideo className="w-5 h-5 text-purple-500" />;
    case 'DOCUMENT':
      return <FileText className="w-5 h-5 text-amber-500" />;
    case 'AUDIO':
      return <FileAudio className="w-5 h-5 text-green-500" />;
    default:
      return <File className="w-5 h-5 text-gray-500" />;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function EvidencePicker({
  incidentId,
  isOpen,
  onClose,
  onSelect,
}: EvidencePickerProps) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [comment, setComment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && incidentId) {
      fetchEvidence();
      setError(null);
    }
  }, [isOpen, incidentId]);

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/chat/${incidentId}/evidence`);
      setEvidence(response.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch evidence:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedEvidence) return;
    
    setSending(true);
    setError(null);
    try {
      await onSelect(selectedEvidence, comment);
      setSelectedEvidence(null);
      setComment('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to share evidence');
    } finally {
      setSending(false);
    }
  };

  const filteredEvidence = evidence.filter(e => 
    e.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Share Evidence
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Evidence List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : filteredEvidence.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No matching evidence found' : 'No evidence uploaded yet'}
            </div>
          ) : (
            filteredEvidence.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedEvidence(item)}
                className={`w-full flex items-center p-3 rounded-lg border transition-all ${
                  selectedEvidence?.id === item.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-600 flex items-center justify-center">
                  {getEvidenceIcon(item.type)}
                </div>
                <div className="flex-1 ml-3 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.fileName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.type} • {formatFileSize(item.fileSize)} • {formatDistanceToNow(new Date(item.uploadedAt), { addSuffix: true })}
                  </p>
                </div>
                {selectedEvidence?.id === item.id && (
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Selected Evidence Preview & Comment */}
        {selectedEvidence && (
          <div className="border-t border-gray-200 dark:border-slate-700 p-4 space-y-3 bg-gray-50 dark:bg-slate-900">
            <div className="flex items-center space-x-2">
              {getEvidenceIcon(selectedEvidence.type)}
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedEvidence.fileName}
              </span>
            </div>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)..."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!selectedEvidence || sending}
            className="flex items-center px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Share
          </button>
        </div>
      </div>
    </>
  );
}
