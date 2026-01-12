'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  ArrowRightLeft,
  Check,
  Clock,
  FileText,
  User,
  AlertCircle,
  CheckCircle2,
  Circle,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface ProgressItem {
  id: string;
  category: string;
  text: string;
  status: 'complete' | 'in-progress' | 'incomplete';
  details: string;
  count?: number;
  total?: number;
}

interface ChecklistItem {
  id: string;
  text: string;
  details: string;
  status: 'complete' | 'in-progress' | 'incomplete';
  acknowledged: boolean;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface HandoffMessageProps {
  incidentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  participants: Participant[];
  currentUserId: string;
}

export default function HandoffMessage({
  incidentId,
  isOpen,
  onClose,
  onSuccess,
  participants,
  currentUserId,
}: HandoffMessageProps) {
  const [shiftFrom, setShiftFrom] = useState('');
  const [shiftTo, setShiftTo] = useState('');
  const [assignToUserId, setAssignToUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [progressSummary, setProgressSummary] = useState<{complete: number, inProgress: number, incomplete: number, total: number} | null>(null);

  // Fetch shifts and incident progress from database
  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen) return;
      
      setLoadingShifts(true);
      setLoadingProgress(true);
      
      try {
        // Fetch shifts and progress in parallel
        const [shiftsResponse, progressResponse] = await Promise.all([
          api.get('/facilities/shifts'),
          api.get(`/chat/${incidentId}/handoff-progress`),
        ]);
        
        if (shiftsResponse.data?.success && shiftsResponse.data?.data?.shifts) {
          setShifts(shiftsResponse.data.data.shifts);
        }
        
        if (progressResponse.data?.success && progressResponse.data?.data) {
          const { progressItems, summary } = progressResponse.data.data;
          // Convert progress items to checklist items
          const dynamicChecklist: ChecklistItem[] = progressItems.map((item: ProgressItem) => ({
            id: item.id,
            text: item.text,
            details: item.details,
            status: item.status,
            acknowledged: item.status === 'complete', // Pre-check completed items
          }));
          setChecklist(dynamicChecklist);
          setProgressSummary(summary);
        }
      } catch (err) {
        console.error('Failed to fetch handoff data:', err);
        setError('Failed to load incident progress');
      } finally {
        setLoadingShifts(false);
        setLoadingProgress(false);
      }
    };

    fetchData();
  }, [isOpen, incidentId]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setShiftFrom('');
      setShiftTo('');
      setAssignToUserId('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => 
      prev.map(item => 
        item.id === id ? { ...item, acknowledged: !item.acknowledged } : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!shiftFrom.trim() || !shiftTo.trim()) {
      setError('Please specify shift information');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/chat/${incidentId}/messages/handoff`, {
        shiftFrom: shiftFrom.trim(),
        shiftTo: shiftTo.trim(),
        checklist: checklist.map(({ text, details, status, acknowledged }) => ({ 
          text, 
          details,
          status,
          completed: acknowledged,
        })),
        notes: notes.trim() || undefined,
        assignToUserId: assignToUserId || undefined,
      });
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create handoff message');
    } finally {
      setSubmitting(false);
    }
  };

  const acknowledgedCount = checklist.filter(item => item.acknowledged).length;
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in-progress':
        return <RefreshCw className="w-4 h-4 text-yellow-500" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-indigo-500 to-purple-500">
          <div className="flex items-center space-x-2">
            <ArrowRightLeft className="w-5 h-5 text-white" />
            <h3 className="text-lg font-semibold text-white">
              Shift Handoff
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Shift Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                From Shift *
              </label>
              <select
                value={shiftFrom}
                onChange={(e) => setShiftFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loadingShifts}
              >
                <option value="">Select shift</option>
                {loadingShifts ? (
                  <option disabled>Loading shifts...</option>
                ) : shifts.length === 0 ? (
                  <option disabled>No shifts available</option>
                ) : (
                  shifts.map((shift) => (
                    <option key={shift.id} value={shift.name}>
                      {shift.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                To Shift *
              </label>
              <select
                value={shiftTo}
                onChange={(e) => setShiftTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loadingShifts}
              >
                <option value="">Select shift</option>
                {loadingShifts ? (
                  <option disabled>Loading shifts...</option>
                ) : shifts.length === 0 ? (
                  <option disabled>No shifts available</option>
                ) : (
                  shifts.map((shift) => (
                    <option key={shift.id} value={shift.name}>
                      {shift.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Notify User (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Notify team member (optional)
            </label>
            <select
              value={assignToUserId}
              onChange={(e) => setAssignToUserId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Don't notify anyone specific</option>
              {participants
                .filter(p => p.id !== currentUserId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
            </select>
          </div>

          {/* Handoff Checklist - Dynamic Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Incident Progress Checklist
              </label>
              {progressSummary && (
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-green-600 dark:text-green-400">{progressSummary.complete} ✓</span>
                  <span className="text-yellow-600 dark:text-yellow-400">{progressSummary.inProgress} ⟳</span>
                  <span className="text-gray-500">{progressSummary.incomplete} ○</span>
                </div>
              )}
            </div>
            
            {loadingProgress ? (
              <div className="flex items-center justify-center py-8 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-600">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mr-2" />
                <span className="text-sm text-gray-500">Loading incident progress...</span>
              </div>
            ) : checklist.length === 0 ? (
              <div className="flex items-center justify-center py-8 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-600">
                <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
                <span className="text-sm text-gray-500">No progress data available</span>
              </div>
            ) : (
              <div className="space-y-2 bg-gray-50 dark:bg-slate-900 rounded-lg p-3 border border-gray-200 dark:border-slate-600 max-h-64 overflow-y-auto">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Review each item and check off what you've communicated to the incoming shift:
                </p>
                {checklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`w-full flex items-start p-2 rounded-lg transition-colors text-left ${
                      item.acknowledged
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-200 dark:ring-indigo-800'
                        : 'bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      item.acknowledged
                        ? 'border-indigo-500 bg-indigo-500'
                        : 'border-gray-300 dark:border-slate-500'
                    }`}>
                      {item.acknowledged && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${
                          item.acknowledged 
                            ? 'text-indigo-700 dark:text-indigo-300' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {item.text}
                        </span>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${getStatusBadgeColor(item.status)}`}>
                          {item.status === 'complete' ? '✓ Done' : item.status === 'in-progress' ? '⟳ In Progress' : '○ Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {item.details}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Check items you've briefed the incoming shift about
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FileText className="w-4 h-4 inline mr-1" />
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Important information for the incoming shift..."
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 border-t border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !shiftFrom || !shiftTo}
            className="flex items-center px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-slate-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowRightLeft className="w-4 h-4 mr-2" />
            )}
            Create Handoff
          </button>
        </div>
      </div>
    </>
  );
}
