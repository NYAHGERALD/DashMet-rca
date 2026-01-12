'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  ListTree,
  Target,
  X,
  Search,
  Send,
  Loader2,
  ChevronRight,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface FiveWhyStep {
  level: number;
  question: string;
  answer: string;
}

interface FishboneCauseFiveWhys {
  steps: Array<{ stepNumber: number; question: string; answer: string }>;
  rootCause: string;
  isValidRootCause: boolean;
  confidence: number;
}

interface FishboneCause {
  id: string;
  text: string;
  rootCause?: string;
  isValidRootCause?: boolean;
  confidence?: number;
  fiveWhysAnalysis?: FishboneCauseFiveWhys;
}

interface FishboneCategory {
  id: string;
  name: string;
  causes: FishboneCause[];
}

interface RCAAnalysis {
  id: string;
  method: 'FIVE_WHYS' | 'FISHBONE' | 'BOTH';
  status: string;
  rootCauseStatement?: string;
  fiveWhysData?: {
    steps: FiveWhyStep[];
  };
  fishboneData?: {
    problem?: string;
    categories?: FishboneCategory[];
    rootCauseText?: string;
  };
  createdAt: string;
  analyst: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface RCALinkPickerProps {
  incidentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (rcaAnalysisId: string, rcaItemType: string, rcaItemId: string | null, comment: string) => void;
}

type SelectionType = 'root_cause' | '5why_step' | 'fishbone_cause' | 'fishbone_problem' | 'fishbone_cause_5why' | 'fishbone_cause_root';

export default function RCALinkPicker({
  incidentId,
  isOpen,
  onClose,
  onSelect,
}: RCALinkPickerProps) {
  const [rcaAnalyses, setRcaAnalyses] = useState<RCAAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRCA, setSelectedRCA] = useState<RCAAnalysis | null>(null);
  const [selectionType, setSelectionType] = useState<SelectionType | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedRCA, setExpandedRCA] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && incidentId) {
      fetchRCAData();
      setError(null);
    }
  }, [isOpen, incidentId]);

  const fetchRCAData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/chat/${incidentId}/rca`);
      setRcaAnalyses(response.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch RCA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRCA = (rca: RCAAnalysis) => {
    // Toggle expand/collapse
    if (expandedRCA === rca.id) {
      setExpandedRCA(null);
      setSelectedRCA(null);
      setSelectionType(null);
      setSelectedItemId(null);
    } else {
      setSelectedRCA(rca);
      setExpandedRCA(rca.id);
      setSelectionType(null);
      setSelectedItemId(null);
    }
  };

  const handleSelectType = (type: SelectionType, itemId?: string) => {
    setSelectionType(type);
    setSelectedItemId(itemId || null);
  };

  const handleSend = async () => {
    if (!selectedRCA || !selectionType) return;
    
    setSending(true);
    setError(null);
    try {
      await onSelect(selectedRCA.id, selectionType, selectedItemId, comment);
      setSelectedRCA(null);
      setSelectionType(null);
      setSelectedItemId(null);
      setComment('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to share RCA finding');
    } finally {
      setSending(false);
    }
  };

  const getSelectedContent = () => {
    if (!selectedRCA || !selectionType) return null;

    if (selectionType === 'root_cause') {
      return selectedRCA.rootCauseStatement;
    }
    
    if (selectionType === '5why_step' && selectedItemId && selectedRCA.fiveWhysData) {
      const stepIndex = parseInt(selectedItemId.replace('step_', ''));
      const step = selectedRCA.fiveWhysData.steps[stepIndex];
      return step ? `Why ${stepIndex + 1}: ${step.answer}` : null;
    }
    
    if (selectionType === 'fishbone_cause' && selectedItemId && selectedRCA.fishboneData?.categories) {
      // Find the cause across all categories
      for (const category of selectedRCA.fishboneData.categories) {
        const cause = category.causes.find(c => c.id === selectedItemId);
        if (cause) {
          return `${category.name}: ${cause.text}`;
        }
      }
    }
    
    if (selectionType === 'fishbone_problem' && selectedRCA.fishboneData?.problem) {
      return selectedRCA.fishboneData.problem;
    }
    
    // Handle fishbone cause 5-why step
    if (selectionType === 'fishbone_cause_5why' && selectedItemId && selectedRCA.fishboneData?.categories) {
      // Parse the selectedItemId format: causeId_step_stepIndex
      const parts = selectedItemId.split('_step_');
      const causeId = parts[0];
      const stepIndex = parseInt(parts[1]);
      
      for (const category of selectedRCA.fishboneData.categories) {
        const cause = category.causes.find(c => c.id === causeId);
        if (cause?.fiveWhysAnalysis?.steps?.[stepIndex]) {
          const step = cause.fiveWhysAnalysis.steps[stepIndex];
          return `${category.name} → ${cause.text}\nWhy ${step.stepNumber}: ${step.answer}`;
        }
      }
    }
    
    // Handle fishbone cause root cause
    if (selectionType === 'fishbone_cause_root' && selectedItemId && selectedRCA.fishboneData?.categories) {
      for (const category of selectedRCA.fishboneData.categories) {
        const cause = category.causes.find(c => c.id === selectedItemId);
        if (cause?.fiveWhysAnalysis?.rootCause) {
          return `${category.name} → ${cause.text}\nRoot Cause: ${cause.fiveWhysAnalysis.rootCause}`;
        }
      }
    }

    return null;
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
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Share RCA Finding
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* RCA List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : rcaAnalyses.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No RCA analyses found for this incident
            </div>
          ) : (
            rcaAnalyses.map((rca) => (
              <div key={rca.id} className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                {/* RCA Header */}
                <button
                  onClick={() => handleSelectRCA(rca)}
                  className={`w-full flex items-center p-3 transition-colors ${
                    expandedRCA === rca.id
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-600 flex items-center justify-center">
                    {rca.method === 'FIVE_WHYS' ? (
                      <ListTree className="w-5 h-5 text-blue-500" />
                    ) : rca.method === 'FISHBONE' ? (
                      <GitBranch className="w-5 h-5 text-purple-500" />
                    ) : (
                      <Target className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1 ml-3 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {rca.method === 'FIVE_WHYS' ? '5 Whys Analysis' : 
                       rca.method === 'FISHBONE' ? 'Fishbone Analysis' : 
                       'Combined Analysis'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      By {rca.analyst.firstName} {rca.analyst.lastName} • {formatDistanceToNow(new Date(rca.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                    expandedRCA === rca.id ? 'rotate-90' : ''
                  }`} />
                </button>

                {/* Expanded Content */}
                {expandedRCA === rca.id && (
                  <div className="border-t border-gray-200 dark:border-slate-600 p-3 bg-gray-50 dark:bg-slate-900 space-y-2 animate-in slide-in-from-top-2 duration-200">
                    {/* Root Cause Statement */}
                    {rca.rootCauseStatement && (
                      <button
                        onClick={() => handleSelectType('root_cause')}
                        className={`w-full text-left p-2 rounded-lg border transition-colors ${
                          selectionType === 'root_cause' && !selectedItemId
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <Target className="w-4 h-4 text-green-500 mr-2" />
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">Root Cause</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {rca.rootCauseStatement}
                        </p>
                      </button>
                    )}

                    {/* 5 Whys Steps */}
                    {rca.fiveWhysData?.steps && rca.fiveWhysData.steps.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2">5 Whys</p>
                        {rca.fiveWhysData.steps.map((step, index) => (
                          <button
                            key={index}
                            onClick={() => handleSelectType('5why_step', `step_${index}`)}
                            className={`w-full text-left p-2 rounded-lg border transition-colors ${
                              selectionType === '5why_step' && selectedItemId === `step_${index}`
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                : 'border-gray-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700'
                            }`}
                          >
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Why {index + 1}</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1">
                              {step.answer}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Fishbone Problem Statement */}
                    {rca.fishboneData?.problem && (
                      <button
                        onClick={() => handleSelectType('fishbone_problem')}
                        className={`w-full text-left p-2 rounded-lg border transition-colors ${
                          selectionType === 'fishbone_problem'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <GitBranch className="w-4 h-4 text-purple-500 mr-2" />
                          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Problem Statement</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {rca.fishboneData.problem}
                        </p>
                      </button>
                    )}

                    {/* Fishbone Categories & Causes */}
                    {rca.fishboneData?.categories && rca.fishboneData.categories.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2">Fishbone Categories</p>
                        {rca.fishboneData.categories.map((category) => (
                          <div key={category.id} className="space-y-1.5 border-l-2 border-purple-300 dark:border-purple-700 pl-2 ml-1">
                            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">{category.name}</p>
                            {category.causes && category.causes.length > 0 ? (
                              category.causes.map((cause) => (
                                <div key={cause.id} className="space-y-1">
                                  {/* Cause Button */}
                                  <button
                                    onClick={() => handleSelectType('fishbone_cause', cause.id)}
                                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                                      selectionType === 'fishbone_cause' && selectedItemId === cause.id
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                        : 'border-gray-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700'
                                    }`}
                                  >
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      {cause.text}
                                    </p>
                                    {cause.isValidRootCause && (
                                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                                        <Target className="w-3 h-3" />
                                        Root Cause ({Math.round((cause.confidence || 0) * 100)}%)
                                      </span>
                                    )}
                                  </button>
                                  
                                  {/* 5-Whys Analysis for this cause */}
                                  {cause.fiveWhysAnalysis && cause.fiveWhysAnalysis.steps && cause.fiveWhysAnalysis.steps.length > 0 && (
                                    <div className="ml-3 pl-2 border-l border-amber-300 dark:border-amber-700 space-y-1">
                                      <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <HelpCircle className="w-3 h-3" />
                                        5-Whys Analysis
                                      </p>
                                      {cause.fiveWhysAnalysis.steps.map((step, stepIdx) => (
                                        <button
                                          key={stepIdx}
                                          onClick={() => handleSelectType('fishbone_cause_5why', `${cause.id}_step_${stepIdx}`)}
                                          className={`w-full text-left p-1.5 rounded border transition-colors text-xs ${
                                            selectionType === 'fishbone_cause_5why' && selectedItemId === `${cause.id}_step_${stepIdx}`
                                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                              : 'border-gray-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700'
                                          }`}
                                        >
                                          <span className="font-medium text-amber-600 dark:text-amber-400">Why {step.stepNumber}:</span>{' '}
                                          <span className="text-gray-600 dark:text-gray-300">{step.answer}</span>
                                        </button>
                                      ))}
                                      {cause.fiveWhysAnalysis.rootCause && (
                                        <button
                                          onClick={() => handleSelectType('fishbone_cause_root', cause.id)}
                                          className={`w-full text-left p-1.5 rounded border transition-colors text-xs ${
                                            selectionType === 'fishbone_cause_root' && selectedItemId === cause.id
                                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                              : 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20 hover:bg-green-50 dark:hover:bg-green-900/30'
                                          }`}
                                        >
                                          <span className="font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                                            <Target className="w-3 h-3" />
                                            Root Cause ({Math.round(cause.fiveWhysAnalysis.confidence * 100)}%):
                                          </span>{' '}
                                          <span className="text-gray-600 dark:text-gray-300">{cause.fiveWhysAnalysis.rootCause}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No causes added</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Selected Preview & Comment */}
        {selectedRCA && selectionType && (
          <div className="border-t border-gray-200 dark:border-slate-700 p-4 space-y-3 bg-gray-50 dark:bg-slate-900">
            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {selectionType === 'root_cause' ? 'Root Cause' : 
                 selectionType === '5why_step' ? '5-Why Finding' : 
                 selectionType === 'fishbone_problem' ? 'Problem Statement' :
                 selectionType === 'fishbone_cause_5why' ? 'Fishbone Cause 5-Why' :
                 selectionType === 'fishbone_cause_root' ? 'Fishbone Cause Root Cause' : 'Fishbone Cause'}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {getSelectedContent()}
              </p>
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
            disabled={!selectedRCA || !selectionType || sending}
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
