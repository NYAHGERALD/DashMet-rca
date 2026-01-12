'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface FiveWhysStep {
  stepNumber: number;
  question: string;
  answer: string;
  evidence?: string[];
  aiSuggestion?: string;
  isSymptomLevel?: boolean;
  aiGenerated?: boolean;
}

interface FiveWhysData {
  steps: FiveWhysStep[];
  rootCause?: string;
  actionPlans?: {
    immediate: ActionPlanItem[];
    shortTerm: ActionPlanItem[];
    longTerm: ActionPlanItem[];
  };
  preventiveControls?: PreventiveControlItem[];
  aiAnalysis?: {
    depth: 'shallow' | 'adequate' | 'deep';
    suggestions: string[];
    strengthScore: number;
  };
}

interface ActionPlanItem {
  id: string;
  action: string;
  owner?: string;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
}

interface ActionPlans {
  immediate: ActionPlanItem[];
  shortTerm: ActionPlanItem[];
  longTerm: ActionPlanItem[];
}

// Preventive Controls Interface (matching Fishbone implementation)
interface PreventiveControlItem {
  id: string;
  control: string;
  type: 'process' | 'training' | 'equipment' | 'documentation' | 'monitoring';
  description: string;
  owner: string;
  targetDate: string;
  status: 'pending' | 'in-progress' | 'implemented';
  frequency?: string;
}

interface AIAnalysisResult {
  steps: FiveWhysStep[];
  rootCause: string;
  confidence: number;
  rationale: string;
  recommendations: string[];
  actionPlans?: ActionPlans;
  error?: boolean;
}

interface AIValidationResult {
  isAligned: boolean;
  confidence: number;
  feedback: string;
  suggestedRevision?: string;
  canProceed: boolean;
}

interface FiveWhysBuilderProps {
  rcaId: string;
  data: FiveWhysData;
  isValidated: boolean;
  onSave: (data: FiveWhysData) => Promise<void>;
  onValidate: (rootCauseStatement: string) => Promise<void>;
}

type AIWorkflowStep = 'idle' | 'awaiting_first_why' | 'validating' | 'validation_feedback' | 'generating_remaining' | 'complete';

// Default control types as fallback
const DEFAULT_CONTROL_TYPES = [
  { value: 'process', label: 'Process Change' },
  { value: 'training', label: 'Training' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'monitoring', label: 'Monitoring' },
];

export default function FiveWhysBuilder({
  rcaId,
  data,
  isValidated,
  onSave,
  onValidate,
}: FiveWhysBuilderProps) {
  const { showToast } = useToast();
  const [steps, setSteps] = useState<FiveWhysStep[]>(data.steps || []);
  const [rootCause, setRootCause] = useState(data.rootCause || '');
  const [saving, setSaving] = useState(false);
  const [loadingAI, setLoadingAI] = useState<number | null>(null);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validationStatement, setValidationStatement] = useState(rootCause);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // AI Workflow State
  const [aiWorkflowStep, setAiWorkflowStep] = useState<AIWorkflowStep>('idle');
  const [firstWhyQuestion, setFirstWhyQuestion] = useState('Why did this problem occur?');
  const [firstWhyAnswer, setFirstWhyAnswer] = useState('');
  const [aiValidation, setAiValidation] = useState<AIValidationResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [showAIWorkflowPanel, setShowAIWorkflowPanel] = useState(false);
  const [loadingFirstQuestion, setLoadingFirstQuestion] = useState(false);
  
  // Action Plans State
  const [actionPlans, setActionPlans] = useState<ActionPlans>(
    data.actionPlans || {
      immediate: [],
      shortTerm: [],
      longTerm: [],
    }
  );
  const [showActionPlans, setShowActionPlans] = useState(
    !!(data.actionPlans && (
      data.actionPlans.immediate?.length > 0 ||
      data.actionPlans.shortTerm?.length > 0 ||
      data.actionPlans.longTerm?.length > 0
    ))
  );

  // Preventive Controls State
  const [preventiveControls, setPreventiveControls] = useState<PreventiveControlItem[]>(
    data.preventiveControls || []
  );
  const [loadingPreventiveControls, setLoadingPreventiveControls] = useState(false);
  
  // Dropdown Options State
  const [controlTypeOptions, setControlTypeOptions] = useState<Array<{ value: string; label: string }>>(DEFAULT_CONTROL_TYPES);

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState<'analysis' | 'actions' | 'controls'>('analysis');

  // Fetch control type options from the API
  useEffect(() => {
    const fetchControlTypes = async () => {
      try {
        const response = await api.get('/dropdown-options', {
          params: { optionType: 'PREVENTIVE_CONTROL_TYPE' }
        });
        if (response.data.success && response.data.data && response.data.data.length > 0) {
          setControlTypeOptions(
            response.data.data.map((opt: any) => ({
              value: opt.value.toLowerCase(),
              label: opt.label,
            }))
          );
        }
      } catch (error) {
        console.log('Using default control types');
        // Keep default control types if API fails
      }
    };
    fetchControlTypes();
  }, []);

  const addStep = () => {
    const newStep: FiveWhysStep = {
      stepNumber: steps.length + 1,
      question: steps.length === 0 
        ? 'Why did this problem occur?' 
        : `Why did ${steps[steps.length - 1]?.answer?.toLowerCase().replace(/\.$/, '') || 'this'} happen?`,
      answer: '',
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (index: number, field: keyof FiveWhysStep, value: string) => {
    const updated = [...steps];
    (updated[index] as any)[field] = value;
    setSteps(updated);
  };

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index);
    // Renumber remaining steps
    updated.forEach((step, i) => {
      step.stepNumber = i + 1;
    });
    setSteps(updated);
  };

  // Start AI-guided workflow
  const startAIWorkflow = async () => {
    setShowAIWorkflowPanel(true);
    setLoadingFirstQuestion(true);
    setFirstWhyAnswer('');
    setAiValidation(null);
    setAiAnalysis(null);
    
    try {
      // Fetch contextual first question from AI
      const response = await api.post(`/rca/${rcaId}/ai/generate-first-question`);
      const { question } = response.data.data;
      setFirstWhyQuestion(question || 'Why did this problem occur?');
    } catch (err) {
      console.error('Failed to generate first question:', err);
      setFirstWhyQuestion('Why did this problem occur?');
    } finally {
      setLoadingFirstQuestion(false);
      setAiWorkflowStep('awaiting_first_why');
    }
  };

  // Validate first Why answer against incident data
  const validateFirstWhy = async () => {
    if (!firstWhyAnswer.trim()) return;
    
    setAiWorkflowStep('validating');
    
    try {
      const response = await api.post(`/rca/${rcaId}/ai/validate-first-why`, {
        firstWhyQuestion: firstWhyQuestion,
        firstWhyAnswer: firstWhyAnswer.trim(),
      });
      
      const validation = response.data.data;
      setAiValidation(validation);
      setAiWorkflowStep('validation_feedback');
    } catch (err) {
      console.error('Failed to validate first Why:', err);
      // If validation API fails, proceed anyway with a warning
      setAiValidation({
        isAligned: true,
        confidence: 0.5,
        feedback: 'Unable to validate against incident data. You may proceed, but please review your answer.',
        canProceed: true,
      });
      setAiWorkflowStep('validation_feedback');
    }
  };

  // Proceed with generating remaining Whys
  const proceedWithAnalysis = async () => {
    setAiWorkflowStep('generating_remaining');
    
    try {
      const response = await api.post(`/rca/${rcaId}/ai/complete-five-whys`, {
        firstWhyQuestion: firstWhyQuestion,
        firstWhyAnswer: firstWhyAnswer.trim(),
      });
      
      const result = response.data.data;
      setAiAnalysis(result);
      setAiWorkflowStep('complete');
    } catch (err) {
      console.error('Failed to generate remaining Whys:', err);
      setAiAnalysis({
        steps: [],
        rootCause: '',
        confidence: 0,
        rationale: 'Failed to generate analysis. Please try again or complete manually.',
        recommendations: [],
        actionPlans: { immediate: [], shortTerm: [], longTerm: [] },
        error: true,
      });
      setAiWorkflowStep('complete');
    }
  };

  // Apply the AI analysis to the form
  const applyAIAnalysis = () => {
    if (aiAnalysis && !aiAnalysis.error) {
      // Mark AI-generated steps
      const stepsWithMarker = aiAnalysis.steps.map((step, idx) => ({
        ...step,
        aiGenerated: idx > 0, // First step is user-provided
      }));
      setSteps(stepsWithMarker);
      setRootCause(aiAnalysis.rootCause);
      
      // Apply action plans if available
      if (aiAnalysis.actionPlans) {
        setActionPlans(aiAnalysis.actionPlans);
        setShowActionPlans(true);
      }
    }
    closeAIWorkflow();
  };

  // Reset and close AI workflow
  const closeAIWorkflow = () => {
    setShowAIWorkflowPanel(false);
    setAiWorkflowStep('idle');
    setFirstWhyAnswer('');
    setAiValidation(null);
    setAiAnalysis(null);
  };

  const getAISuggestion = async (index: number) => {
    if (!steps[index]?.answer) return;

    setLoadingAI(index);
    try {
      const response = await api.post(`/rca/${rcaId}/ai/five-whys-suggestion`, {
        currentStep: steps[index].stepNumber,
        currentAnswer: steps[index].answer,
        previousSteps: steps.slice(0, index),
      });

      const suggestion = response.data.data;
      const updated = [...steps];
      updated[index] = {
        ...updated[index],
        aiSuggestion: suggestion.suggestedQuestion,
        isSymptomLevel: suggestion.isSymptomLevel,
      };

      // Auto-add next step with suggestion if available
      if (index < 6 && !steps[index + 1] && suggestion.suggestedAnswer) {
        const newStep: FiveWhysStep = {
          stepNumber: index + 2,
          question: suggestion.suggestedQuestion,
          answer: suggestion.suggestedAnswer,
          aiGenerated: true,
        };
        setSteps([...updated, newStep]);
      } else {
        setSteps(updated);
      }
    } catch (err) {
      console.error('Failed to get AI suggestion:', err);
    } finally {
      setLoadingAI(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      await onSave({ steps, rootCause, actionPlans, preventiveControls });
      showToast('Progress saved successfully', 'success');
    } catch (err: any) {
      console.error('Failed to save:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to save. Please try again.');
      showToast('Failed to save progress', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!validationStatement.trim()) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      // Save the current data (including action plans and preventive controls) before validating
      await onSave({ steps, rootCause, actionPlans, preventiveControls });
      // Then validate
      await onValidate(validationStatement);
      setShowValidateModal(false);
    } catch (err: any) {
      console.error('Failed to validate:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to validate. Please try again.');
      setShowValidateModal(false);
    } finally {
      setSaving(false);
    }
  };

  // Action Plan Handlers
  const updateActionItem = (
    category: 'immediate' | 'shortTerm' | 'longTerm',
    id: string,
    field: keyof ActionPlanItem,
    value: string
  ) => {
    setActionPlans((prev) => ({
      ...prev,
      [category]: prev[category].map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  // Validate if end date is before start date
  const getDateError = (item: ActionPlanItem): string | null => {
    if (item.startDate && item.endDate) {
      const start = new Date(item.startDate);
      const end = new Date(item.endDate);
      if (end < start) {
        return 'End date cannot be before start date';
      }
    }
    return null;
  };

  const addActionItem = (category: 'immediate' | 'shortTerm' | 'longTerm') => {
    const prefix = category === 'immediate' ? 'imm' : category === 'shortTerm' ? 'st' : 'lt';
    const newId = `${prefix}-${Date.now()}`;
    const newItem: ActionPlanItem = {
      id: newId,
      action: '',
      startDate: '',
      endDate: '',
      priority: category === 'immediate' ? 'high' : 'medium',
      status: 'pending',
    };
    setActionPlans((prev) => ({
      ...prev,
      [category]: [...prev[category], newItem],
    }));
  };

  const removeActionItem = (category: 'immediate' | 'shortTerm' | 'longTerm', id: string) => {
    setActionPlans((prev) => ({
      ...prev,
      [category]: prev[category].filter((item) => item.id !== id),
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Preventive Controls Helper Functions
  const addPreventiveControl = () => {
    const newId = `pc-${Date.now()}`;
    const newControl: PreventiveControlItem = {
      id: newId,
      control: '',
      type: 'process',
      description: '',
      owner: '',
      targetDate: '',
      status: 'pending',
      frequency: '',
    };
    setPreventiveControls((prev) => [...prev, newControl]);
  };

  const updatePreventiveControl = (id: string, field: keyof PreventiveControlItem, value: string) => {
    setPreventiveControls((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removePreventiveControl = (id: string) => {
    setPreventiveControls((prev) => prev.filter((item) => item.id !== id));
  };

  // Generate AI Preventive Controls
  const generateAIPreventiveControls = async () => {
    if (!rootCause.trim()) {
      showToast('Please complete your 5 Whys analysis and identify a root cause first.', 'warning');
      return;
    }

    const filledSteps = steps.filter((s) => s.answer?.trim());
    if (filledSteps.length < 3) {
      showToast('Please complete at least 3 levels of your 5 Whys analysis before generating preventive controls.', 'warning');
      return;
    }

    setLoadingPreventiveControls(true);
    try {
      const response = await api.post(`/rca/${rcaId}/ai/generate-preventive-controls`, {
        rootCause: rootCause,
        fiveWhysSteps: filledSteps.map(s => ({
          stepNumber: s.stepNumber,
          question: s.question,
          answer: s.answer,
        })),
        existingControls: preventiveControls,
      });

      if (response.data.success && response.data.data.preventiveControls) {
        const newControls = response.data.data.preventiveControls;
        setPreventiveControls(prev => [...prev, ...newControls]);
        showToast(`Generated ${newControls.length} preventive controls based on your analysis!`, 'success');
      } else {
        showToast('Unable to generate preventive controls. Please try again.', 'error');
      }
    } catch (error: any) {
      console.error('Failed to generate preventive controls:', error);
      showToast(error.response?.data?.error || 'Failed to generate preventive controls. Please try again.', 'error');
    } finally {
      setLoadingPreventiveControls(false);
    }
  };

  const getControlTypeIcon = (type: PreventiveControlItem['type']) => {
    switch (type) {
      case 'process': return '⚙️';
      case 'training': return '📚';
      case 'equipment': return '🔧';
      case 'documentation': return '📋';
      case 'monitoring': return '📊';
      default: return '🛡️';
    }
  };

  const getControlTypeColor = (type: PreventiveControlItem['type']) => {
    switch (type) {
      case 'process': return 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-300';
      case 'training': return 'bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-300';
      case 'equipment': return 'bg-orange-100 text-orange-700 dark:bg-orange-800 dark:text-orange-300';
      case 'documentation': return 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300';
      case 'monitoring': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getDepthIndicator = () => {
    // Use AI analysis steps if showing AI results, otherwise use main steps
    const stepsToCheck = (aiWorkflowStep === 'complete' && aiAnalysis?.steps) 
      ? aiAnalysis.steps 
      : steps;
    const filledSteps = stepsToCheck.filter((s) => s.answer?.trim()).length;
    if (filledSteps < 3) return { color: 'red', text: 'Shallow - Keep digging deeper' };
    if (filledSteps < 4) return { color: 'yellow', text: 'Getting there - Consider one more level' };
    return { color: 'green', text: 'Good depth - Review your root cause' };
  };

  const depth = getDepthIndicator();

  return (
    <div className="p-6">
      {/* Error Display */}
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700 dark:text-red-200">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          5 Whys Analysis
        </h2>
        <div className="flex items-center space-x-3">
          {!isValidated && (
            <button
              onClick={startAIWorkflow}
              disabled={showAIWorkflowPanel}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center space-x-2 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>🤖 AI-Assisted Analysis</span>
            </button>
          )}
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            depth.color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
            depth.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }`}>
            {depth.text}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-1" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors flex items-center space-x-2 ${
              activeTab === 'analysis'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-500 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>5 Whys Analysis</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              {steps.filter(s => s.answer?.trim()).length}/{steps.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors flex items-center space-x-2 ${
              activeTab === 'actions'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-500 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Corrective Actions</span>
            {(actionPlans.immediate.length + actionPlans.shortTerm.length + actionPlans.longTerm.length) > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
                {actionPlans.immediate.length + actionPlans.shortTerm.length + actionPlans.longTerm.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors flex items-center space-x-2 ${
              activeTab === 'controls'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-500 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Preventive Controls</span>
            {preventiveControls.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                {preventiveControls.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Analysis Tab Content */}
      {activeTab === 'analysis' && (
        <>
          {/* AI Workflow Panel */}
          {showAIWorkflowPanel && (
        <div className="mb-6 p-5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🤖</span>
              <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                AI-Assisted 5 Whys Analysis
              </h3>
            </div>
            <button
              onClick={closeAIWorkflow}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Loading First Question */}
          {loadingFirstQuestion && (
            <div className="flex flex-col items-center justify-center py-8">
              <svg className="animate-spin h-12 w-12 text-purple-600 mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-purple-900 dark:text-purple-100 font-medium">Analyzing incident data...</p>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">Generating a contextual first question</p>
            </div>
          )}

          {/* Step 1: Awaiting First Why */}
          {aiWorkflowStep === 'awaiting_first_why' && !loadingFirstQuestion && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="flex items-start space-x-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold shrink-0">
                    1
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      {firstWhyQuestion}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                      Please provide your answer to this question. The AI will validate your response against the incident data and then complete the remaining analysis.
                    </p>
                    <textarea
                      value={firstWhyAnswer}
                      onChange={(e) => setFirstWhyAnswer(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="Because..."
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeAIWorkflow}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={validateFirstWhy}
                  disabled={!firstWhyAnswer.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
                >
                  <span>Continue</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Validating */}
          {aiWorkflowStep === 'validating' && (
            <div className="flex flex-col items-center justify-center py-8">
              <svg className="animate-spin h-12 w-12 text-purple-600 mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-purple-900 dark:text-purple-100 font-medium">Validating your response against incident data...</p>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">This ensures the analysis starts on the right track</p>
            </div>
          )}

          {/* Step 3: Validation Feedback */}
          {aiWorkflowStep === 'validation_feedback' && aiValidation && (
            <div className="space-y-4">
              {/* Show validation result */}
              <div className={`p-4 rounded-lg border ${
                aiValidation.isAligned 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
              }`}>
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">
                    {aiValidation.isAligned ? '✅' : '⚠️'}
                  </span>
                  <div className="flex-1">
                    <h4 className={`font-medium mb-2 ${
                      aiValidation.isAligned 
                        ? 'text-green-900 dark:text-green-100'
                        : 'text-amber-900 dark:text-amber-100'
                    }`}>
                      {aiValidation.isAligned ? 'Your answer aligns with the incident data' : 'Potential misalignment detected'}
                    </h4>
                    <p className={`text-sm ${
                      aiValidation.isAligned 
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-amber-700 dark:text-amber-300'
                    }`}>
                      {aiValidation.feedback}
                    </p>
                    
                    {aiValidation.confidence > 0 && (
                      <div className="mt-2 flex items-center space-x-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Confidence:</span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 max-w-32">
                          <div 
                            className={`h-2 rounded-full ${aiValidation.isAligned ? 'bg-green-500' : 'bg-amber-500'}`}
                            style={{ width: `${aiValidation.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {Math.round(aiValidation.confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Show suggested revision if not aligned */}
              {!aiValidation.isAligned && aiValidation.suggestedRevision && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                  <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                    💡 Suggested Revision
                  </h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                    {aiValidation.suggestedRevision}
                  </p>
                  <button
                    onClick={() => setFirstWhyAnswer(aiValidation.suggestedRevision!)}
                    className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 underline"
                  >
                    Use this suggestion
                  </button>
                </div>
              )}

              {/* Current answer for editing */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Answer to &quot;Why #1&quot;
                </label>
                <textarea
                  value={firstWhyAnswer}
                  onChange={(e) => setFirstWhyAnswer(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setAiWorkflowStep('awaiting_first_why')}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  ← Revise Answer
                </button>
                <button
                  onClick={validateFirstWhy}
                  className="px-4 py-2 border border-purple-600 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                >
                  Re-validate
                </button>
                {aiValidation.canProceed && (
                  <button
                    onClick={proceedWithAnalysis}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                  >
                    <span>{aiValidation.isAligned ? 'Generate Remaining Whys' : 'Proceed Anyway'}</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Generating Remaining */}
          {aiWorkflowStep === 'generating_remaining' && (
            <div className="flex flex-col items-center justify-center py-8">
              <svg className="animate-spin h-12 w-12 text-purple-600 mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-purple-900 dark:text-purple-100 font-medium">Generating complete 5 Whys analysis...</p>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">Building on your first answer to find the root cause</p>
            </div>
          )}

          {/* Step 5: Complete - Show Results */}
          {aiWorkflowStep === 'complete' && aiAnalysis && (
            <div className="space-y-4">
              {aiAnalysis.error ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                  <p className="text-red-700 dark:text-red-300">{aiAnalysis.rationale}</p>
                </div>
              ) : (
                <>
                  {/* Confidence Badge */}
                  <div className="flex items-center justify-center">
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                      {Math.round(aiAnalysis.confidence * 100)}% Confidence
                    </span>
                  </div>

                  {/* Preview All Steps */}
                  <div className="space-y-3">
                    {aiAnalysis.steps.map((step, idx) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-lg border ${
                          idx === 0 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                            : 'bg-white/60 dark:bg-gray-800/60 border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <span className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shrink-0 ${
                            idx === 0 ? 'bg-blue-600' : 'bg-purple-600'
                          }`}>
                            {step.stepNumber}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-gray-900 dark:text-white text-sm">
                                {step.question}
                              </span>
                              {idx === 0 && (
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-xs rounded">
                                  Your answer
                                </span>
                              )}
                              {idx > 0 && (
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-xs rounded">
                                  AI generated
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-sm">{step.answer}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Root Cause */}
                  <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border-2 border-green-300 dark:border-green-600">
                    <span className="text-xs font-medium text-green-700 dark:text-green-300 uppercase">Root Cause Identified</span>
                    <p className="text-green-900 dark:text-green-100 font-medium mt-1">{aiAnalysis.rootCause}</p>
                  </div>

                  {/* Rationale */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase">AI Rationale</span>
                    <p className="text-blue-900 dark:text-blue-100 text-sm mt-1">{aiAnalysis.rationale}</p>
                  </div>

                  {/* Recommendations */}
                  {aiAnalysis.recommendations.length > 0 && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase">Recommended Actions</span>
                      <ul className="mt-2 space-y-1">
                        {aiAnalysis.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-amber-900 dark:text-amber-100 text-sm flex items-start">
                            <span className="mr-2">→</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Plans Preview */}
                  {aiAnalysis.actionPlans && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase mb-3 block">
                        📋 AI-Generated Action Plans (Editable after applying)
                      </span>
                      
                      {aiAnalysis.actionPlans.immediate.length > 0 && (
                        <div className="mb-3">
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400">Immediate (0-24h):</span>
                          <ul className="mt-1 space-y-1">
                            {aiAnalysis.actionPlans.immediate.map((item, idx) => (
                              <li key={idx} className="text-indigo-900 dark:text-indigo-100 text-sm flex items-start">
                                <span className="mr-2 text-red-500">⚡</span>
                                {item.action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {aiAnalysis.actionPlans.shortTerm.length > 0 && (
                        <div className="mb-3">
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Short-Term (1-30 days):</span>
                          <ul className="mt-1 space-y-1">
                            {aiAnalysis.actionPlans.shortTerm.map((item, idx) => (
                              <li key={idx} className="text-indigo-900 dark:text-indigo-100 text-sm flex items-start">
                                <span className="mr-2 text-amber-500">📌</span>
                                {item.action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {aiAnalysis.actionPlans.longTerm.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Long-Term (30+ days):</span>
                          <ul className="mt-1 space-y-1">
                            {aiAnalysis.actionPlans.longTerm.map((item, idx) => (
                              <li key={idx} className="text-indigo-900 dark:text-indigo-100 text-sm flex items-start">
                                <span className="mr-2 text-blue-500">🎯</span>
                                {item.action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={closeAIWorkflow}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {!aiAnalysis.error && (
                  <button
                    onClick={applyAIAnalysis}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Apply to Form (Editable)</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                💡 All steps will be fully editable after applying
              </p>
            </div>
          )}
        </div>
      )}

      {/* Editable Steps */}
      <div className="space-y-6">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`p-4 border rounded-lg ${
              step.isSymptomLevel
                ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600'
                : step.aiGenerated
                ? 'border-purple-200 bg-purple-50/50 dark:bg-purple-900/10 dark:border-purple-700'
                : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold ${
                  step.aiGenerated ? 'bg-purple-600' : 'bg-blue-600'
                }`}>
                  {step.stepNumber}
                </span>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Why #{step.stepNumber}
                </span>
                {step.aiGenerated && (
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-xs rounded">
                    AI generated - editable
                  </span>
                )}
                {step.isSymptomLevel && (
                  <span className="text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠ May be symptom-level
                  </span>
                )}
              </div>
              {!isValidated && steps.length > 1 && (
                <button
                  onClick={() => removeStep(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Question
                </label>
                <input
                  type="text"
                  value={step.question}
                  onChange={(e) => updateStep(index, 'question', e.target.value)}
                  disabled={isValidated}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="Why did this happen?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Answer
                </label>
                <textarea
                  value={step.answer}
                  onChange={(e) => updateStep(index, 'answer', e.target.value)}
                  disabled={isValidated}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="Because..."
                />
              </div>

              {/* AI Suggestion Button */}
              {!isValidated && step.answer && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => getAISuggestion(index)}
                    disabled={loadingAI === index}
                    className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center space-x-1"
                  >
                    {loadingAI === index ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Getting AI suggestion...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span>🤖 Get AI suggestion for next</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {step.aiSuggestion && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-sm">
                  <span className="text-purple-600 dark:text-purple-400 font-medium">AI Suggestion: </span>
                  <span className="text-gray-700 dark:text-gray-300">{step.aiSuggestion}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add Step Button */}
        {!isValidated && steps.length < 7 && (
          <button
            onClick={addStep}
            className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
          >
            + Add Why #{steps.length + 1}
          </button>
        )}
      </div>

      {/* Root Cause Section */}
      {steps.length >= 3 && (
        <div className="mt-8 p-4 border-2 border-green-300 dark:border-green-600 rounded-lg bg-green-50 dark:bg-green-900/20">
          <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2">
            Root Cause Statement
          </label>
          <textarea
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            disabled={isValidated}
            rows={3}
            className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            placeholder="Based on the 5 Whys analysis, the root cause is..."
          />
        </div>
      )}
        </>
      )}

      {/* Corrective Actions Tab Content */}
      {activeTab === 'actions' && (
        <>
          <div className="mt-4 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <span>📋</span>
                <span>Corrective Actions</span>
                {isValidated && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded-full">
                    Validated
                  </span>
                )}
              </h3>
            </div>

            {/* Root Cause Summary for Context */}
            {rootCause && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-green-800 dark:text-green-200 text-sm">Root Cause Identified</h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">{rootCause}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State for Actions */}
            {actionPlans.immediate.length === 0 && actionPlans.shortTerm.length === 0 && actionPlans.longTerm.length === 0 && !isValidated && (
              <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                <div className="text-4xl mb-3">📋</div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">No Corrective Actions Yet</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Add corrective actions to address the identified root cause. You can use the AI-assisted analysis in the "5 Whys Analysis" tab to generate action plans automatically.
                </p>
                <button
                  onClick={() => setActiveTab('analysis')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Analysis
                </button>
              </div>
            )}

            {/* Immediate Actions */}
            <div className="p-4 border-2 border-red-200 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/10">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-red-700 dark:text-red-300 flex items-center space-x-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span>Immediate Actions (0-24 hours)</span>
                </h4>
                {!isValidated && (
                  <button
                    onClick={() => addActionItem('immediate')}
                    className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add</span>
                  </button>
                )}
              </div>
              {actionPlans.immediate.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No immediate actions defined</p>
              ) : (
                <div className="space-y-3">
                  {actionPlans.immediate.map((item) => (
                    <div key={item.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700">
                      <div className="flex items-start justify-between gap-2">
                        <textarea
                          value={item.action}
                          onChange={(e) => updateActionItem('immediate', item.id, 'action', e.target.value)}
                          disabled={isValidated}
                          rows={2}
                          className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                          placeholder="Describe the immediate action..."
                        />
                        {!isValidated && (
                          <button
                            onClick={() => removeActionItem('immediate', item.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400">Start:</label>
                          <input
                            type="date"
                            value={item.startDate || ''}
                            onChange={(e) => updateActionItem('immediate', item.id, 'startDate', e.target.value)}
                            disabled={isValidated}
                            className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400">End:</label>
                          <input
                            type="date"
                            value={item.endDate || ''}
                            onChange={(e) => updateActionItem('immediate', item.id, 'endDate', e.target.value)}
                            disabled={isValidated}
                            className={`text-xs px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 ${getDateError(item) ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'}`}
                          />
                        </div>
                        {getDateError(item) && (
                          <span className="text-xs text-red-500 font-medium">⚠️ {getDateError(item)}</span>
                        )}
                        <select
                          value={item.priority}
                          onChange={(e) => updateActionItem('immediate', item.id, 'priority', e.target.value)}
                          disabled={isValidated}
                          className={`text-xs px-2 py-1 rounded ${getPriorityColor(item.priority)} disabled:opacity-50`}
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <select
                          value={item.status}
                          onChange={(e) => updateActionItem('immediate', item.id, 'status', e.target.value)}
                          disabled={isValidated}
                          className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)} disabled:opacity-50`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        <input
                          type="text"
                          value={item.owner || ''}
                          onChange={(e) => updateActionItem('immediate', item.id, 'owner', e.target.value)}
                          disabled={isValidated}
                          placeholder="Owner"
                          className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-24 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Short-Term Actions */}
            <div className="p-4 border-2 border-amber-200 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-900/10">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-amber-700 dark:text-amber-300 flex items-center space-x-2">
                  <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                  <span>Short-Term Actions (1-30 days)</span>
                </h4>
                {!isValidated && (
                  <button
                    onClick={() => addActionItem('shortTerm')}
                    className="text-sm text-amber-600 hover:text-amber-800 dark:text-amber-400 flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add</span>
                  </button>
                )}
              </div>
              {actionPlans.shortTerm.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No short-term actions defined</p>
              ) : (
                <div className="space-y-3">
                  {actionPlans.shortTerm.map((item) => (
                    <div key={item.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-700">
                      <div className="flex items-start justify-between gap-2">
                        <textarea
                          value={item.action}
                          onChange={(e) => updateActionItem('shortTerm', item.id, 'action', e.target.value)}
                          disabled={isValidated}
                          rows={2}
                          className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                          placeholder="Describe the short-term action..."
                        />
                        {!isValidated && (
                          <button
                            onClick={() => removeActionItem('shortTerm', item.id)}
                            className="text-amber-500 hover:text-amber-700 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400">Start:</label>
                          <input
                            type="date"
                            value={item.startDate || ''}
                            onChange={(e) => updateActionItem('shortTerm', item.id, 'startDate', e.target.value)}
                            disabled={isValidated}
                            className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400">End:</label>
                          <input
                            type="date"
                            value={item.endDate || ''}
                            onChange={(e) => updateActionItem('shortTerm', item.id, 'endDate', e.target.value)}
                            disabled={isValidated}
                            className={`text-xs px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 ${getDateError(item) ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'}`}
                          />
                        </div>
                        {getDateError(item) && (
                          <span className="text-xs text-red-500 font-medium">⚠️ {getDateError(item)}</span>
                        )}
                        <select
                          value={item.priority}
                          onChange={(e) => updateActionItem('shortTerm', item.id, 'priority', e.target.value)}
                          disabled={isValidated}
                          className={`text-xs px-2 py-1 rounded ${getPriorityColor(item.priority)} disabled:opacity-50`}
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <select
                          value={item.status}
                          onChange={(e) => updateActionItem('shortTerm', item.id, 'status', e.target.value)}
                          disabled={isValidated}
                          className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)} disabled:opacity-50`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        <input
                          type="text"
                          value={item.owner || ''}
                          onChange={(e) => updateActionItem('shortTerm', item.id, 'owner', e.target.value)}
                          disabled={isValidated}
                          placeholder="Owner"
                          className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-24 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Long-Term Actions */}
            <div className="p-4 border-2 border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/10">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-700 dark:text-blue-300 flex items-center space-x-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  <span>Long-Term Actions (30+ days)</span>
                </h4>
                {!isValidated && (
                  <button
                    onClick={() => addActionItem('longTerm')}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add</span>
                  </button>
                )}
              </div>
              {actionPlans.longTerm.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No long-term actions defined</p>
              ) : (
                <div className="space-y-3">
                  {actionPlans.longTerm.map((item) => (
                    <div key={item.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                      <div className="flex items-start justify-between gap-2">
                        <textarea
                          value={item.action}
                          onChange={(e) => updateActionItem('longTerm', item.id, 'action', e.target.value)}
                          disabled={isValidated}
                          rows={2}
                          className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                          placeholder="Describe the long-term action..."
                        />
                        {!isValidated && (
                          <button
                            onClick={() => removeActionItem('longTerm', item.id)}
                            className="text-blue-500 hover:text-blue-700 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400">Start:</label>
                          <input
                            type="date"
                            value={item.startDate || ''}
                            onChange={(e) => updateActionItem('longTerm', item.id, 'startDate', e.target.value)}
                            disabled={isValidated}
                            className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400">End:</label>
                          <input
                            type="date"
                            value={item.endDate || ''}
                            onChange={(e) => updateActionItem('longTerm', item.id, 'endDate', e.target.value)}
                            disabled={isValidated}
                            className={`text-xs px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 ${getDateError(item) ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'}`}
                          />
                        </div>
                        {getDateError(item) && (
                          <span className="text-xs text-red-500 font-medium">⚠️ {getDateError(item)}</span>
                        )}
                        <select
                          value={item.priority}
                          onChange={(e) => updateActionItem('longTerm', item.id, 'priority', e.target.value)}
                          disabled={isValidated}
                          className={`text-xs px-2 py-1 rounded ${getPriorityColor(item.priority)} disabled:opacity-50`}
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <select
                          value={item.status}
                          onChange={(e) => updateActionItem('longTerm', item.id, 'status', e.target.value)}
                          disabled={isValidated}
                          className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)} disabled:opacity-50`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        <input
                          type="text"
                          value={item.owner || ''}
                          onChange={(e) => updateActionItem('longTerm', item.id, 'owner', e.target.value)}
                          disabled={isValidated}
                          placeholder="Owner"
                          className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-24 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Preventive Controls Tab Content */}
      {activeTab === 'controls' && (
        <>
          <div className="mt-4 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <span>🛡️</span>
                <span>Preventive Controls</span>
                {isValidated && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded-full">
                    Validated
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3">
                {!isValidated && (
                  <>
                    <button
                      onClick={generateAIPreventiveControls}
                      disabled={loadingPreventiveControls || !rootCause.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                    >
                      {loadingPreventiveControls ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>✨ AI Generate Controls</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={addPreventiveControl}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Control
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Info Card */}
            {preventiveControls.length === 0 && !isValidated && (
              <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-purple-800 dark:text-purple-200">What are Preventive Controls?</h4>
                    <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                      Preventive controls are systemic measures to prevent similar incidents from occurring in the future. 
                      These include process changes, training programs, equipment upgrades, documentation updates, and monitoring systems.
                    </p>
                    {rootCause.trim() && (
                      <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-purple-200 dark:border-purple-700">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">AI-Powered Generation</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Click "✨ AI Generate Controls" to automatically create preventive controls based on your 5 Whys analysis and root cause. 
                          Our AI reviews your entire analysis to suggest practical, implementable controls that address the core issues you've identified.
                        </p>
                      </div>
                    )}
                    {!rootCause.trim() && (
                      <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          💡 Complete your 5 Whys analysis and identify the root cause in the Analysis tab to unlock AI-powered control generation.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Preventive Controls List */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
                Define preventive measures based on the root cause identified in your 5 Whys analysis.
              </p>
              
              <div className="space-y-4">
                {preventiveControls.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">No preventive controls defined yet. Click "✨ AI Generate Controls" or "Add Control" to create one.</p>
                ) : (
                  preventiveControls.map((control) => (
                    <div key={control.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-purple-100 dark:border-purple-800">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Control Type Badge */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getControlTypeColor(control.type)}`}>
                              {getControlTypeIcon(control.type)} {control.type.charAt(0).toUpperCase() + control.type.slice(1)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              control.status === 'implemented' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300' 
                                : control.status === 'in-progress' 
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {control.status}
                            </span>
                          </div>

                          {/* Control Name */}
                          {!isValidated ? (
                            <input
                              type="text"
                              value={control.control}
                              onChange={(e) => updatePreventiveControl(control.id, 'control', e.target.value)}
                              className="w-full text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-purple-500 focus:outline-none"
                              placeholder="Control name (e.g., Weekly equipment inspection checklist)"
                            />
                          ) : (
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{control.control}</p>
                          )}

                          {/* Control Description */}
                          {!isValidated ? (
                            <textarea
                              value={control.description}
                              onChange={(e) => updatePreventiveControl(control.id, 'description', e.target.value)}
                              rows={2}
                              className="w-full text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded p-2 border border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:outline-none"
                              placeholder="Describe how this control prevents recurrence..."
                            />
                          ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-300">{control.description}</p>
                          )}

                          {/* Control Details Row */}
                          <div className="flex items-center flex-wrap gap-3 text-xs">
                            {!isValidated ? (
                              <>
                                <select
                                  value={control.type}
                                  onChange={(e) => updatePreventiveControl(control.id, 'type', e.target.value)}
                                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                >
                                  {controlTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={control.owner}
                                  onChange={(e) => updatePreventiveControl(control.id, 'owner', e.target.value)}
                                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                  placeholder="Owner"
                                />
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500 dark:text-gray-400">Target:</span>
                                  <input
                                    type="date"
                                    value={control.targetDate || ''}
                                    onChange={(e) => updatePreventiveControl(control.id, 'targetDate', e.target.value)}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                  />
                                </div>
                                {control.type === 'monitoring' && (
                                  <input
                                    type="text"
                                    value={control.frequency || ''}
                                    onChange={(e) => updatePreventiveControl(control.id, 'frequency', e.target.value)}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                    placeholder="Frequency (e.g., Daily, Weekly)"
                                  />
                                )}
                                <select
                                  value={control.status}
                                  onChange={(e) => updatePreventiveControl(control.id, 'status', e.target.value as 'pending' | 'in-progress' | 'implemented')}
                                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in-progress">In Progress</option>
                                  <option value="implemented">Implemented</option>
                                </select>
                              </>
                            ) : (
                              <>
                                <span className="text-gray-500 dark:text-gray-400">Owner: {control.owner || 'N/A'}</span>
                                <span className="text-gray-500 dark:text-gray-400">Target: {control.targetDate || 'N/A'}</span>
                                {control.frequency && (
                                  <span className="text-gray-500 dark:text-gray-400">Frequency: {control.frequency}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        
                        {!isValidated && (
                          <button
                            onClick={() => removePreventiveControl(control.id)}
                            className="text-purple-400 hover:text-purple-600"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Action Buttons */}
      {!isValidated && (
        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Progress'}
          </button>
          {rootCause && steps.length >= 3 && (
            <button
              onClick={() => {
                setValidationStatement(rootCause);
                setShowValidateModal(true);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Complete & Validate
            </button>
          )}
        </div>
      )}

      {/* Validation Modal */}
      {showValidateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Validate Root Cause
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Please confirm or edit the root cause statement. Once validated, this analysis will be locked.
            </p>
            <textarea
              value={validationStatement}
              onChange={(e) => setValidationStatement(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowValidateModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleValidate}
                disabled={saving || !validationStatement.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Validating...' : 'Confirm & Validate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
