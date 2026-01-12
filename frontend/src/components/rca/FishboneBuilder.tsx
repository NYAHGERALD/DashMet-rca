'use client';

import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface FishboneCause {
  id: string;
  text: string;
  evidence?: string[];
  aiSuggested?: boolean;
  likelihood?: 'high' | 'medium' | 'low';
  reasoning?: string;  // AI explanation for why this cause was identified
  fiveWhysAnalysis?: {
    steps: Array<{ stepNumber: number; question: string; answer: string; explanation?: string }>;
    rootCause: string;
    isValidRootCause: boolean;
    confidence: number;
  };
}

interface FishboneCategory {
  id: string;
  name: string;
  causes: FishboneCause[];
}

interface FishboneData {
  problem: string;
  categories: FishboneCategory[];
  rootCauseText?: string;
  actionPlans?: ActionPlans;
  preventiveControls?: PreventiveControlItem[];
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

interface PreventiveControlItem {
  id: string;
  control: string;
  type: 'process' | 'training' | 'equipment' | 'documentation' | 'monitoring';
  description: string;
  owner?: string;
  targetDate?: string;
  status: 'pending' | 'in-progress' | 'implemented';
  frequency?: string; // For monitoring controls
}

interface AIAnalysisResult {
  problem: string;
  categories: FishboneCategory[];
  primaryRootCauses: string[];
  rootCauseText: string;
  confidence: number;
  rationale: string;
  recommendations: string[];
  actionPlans?: ActionPlans;
  error?: boolean;
}

interface ProblemValidationResult {
  isValid: boolean;
  needsClarification: boolean;
  clarificationQuestions?: string[];
  feedback: string;
  suggestedRevision?: string;
  canProceed: boolean;
}

interface CauseFiveWhysResult {
  causeId: string;
  causeText: string;
  fiveWhys: {
    steps: Array<{ stepNumber: number; question: string; answer: string; explanation?: string }>;
    rootCause: string;
    confidence: number;
  };
  resolvesOriginalProblem: boolean;
  validationExplanation: string;
  recommendation: 'keep' | 'eliminate' | 'needs_more_analysis' | 'reclassify_as_contributing';
}

interface FishboneBuilderProps {
  rcaId: string;
  data: FishboneData;
  isValidated: boolean;
  onSave: (data: FishboneData) => Promise<void>;
  onValidate: (rootCauseStatement: string) => Promise<void>;
  onReopen?: () => Promise<void>;
}

type AIWorkflowStep = 'idle' | 'validating_problem' | 'problem_feedback' | 'generating' | 'analyzing_causes' | 'complete';

export default function FishboneBuilder({
  rcaId,
  data,
  isValidated,
  onSave,
  onValidate,
  onReopen,
}: FishboneBuilderProps) {
  const { showToast } = useToast();
  const [problem, setProblem] = useState(data.problem || '');
  const [categories, setCategories] = useState<FishboneCategory[]>(data.categories || []);
  const [rootCauseText, setRootCauseText] = useState(data.rootCauseText || '');
  const [saving, setSaving] = useState(false);
  const [loadingAI, setLoadingAI] = useState<string | null>(null);
  const [generatingFullAnalysis, setGeneratingFullAnalysis] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validationStatement, setValidationStatement] = useState(rootCauseText);
  const [newCauseInputs, setNewCauseInputs] = useState<Record<string, string>>({});
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Enhanced AI Workflow State
  const [aiWorkflowStep, setAiWorkflowStep] = useState<AIWorkflowStep>('idle');
  const [problemValidation, setProblemValidation] = useState<ProblemValidationResult | null>(null);
  const [clarificationAnswers, setClarificationAnswers] = useState<string[]>([]);
  const [selectedCauseForAnalysis, setSelectedCauseForAnalysis] = useState<{id: string; text: string; categoryName: string} | null>(null);
  const [causeAnalysisResult, setCauseAnalysisResult] = useState<CauseFiveWhysResult | null>(null);
  const [analyzingCause, setAnalyzingCause] = useState(false);
  
  // Editable 5 Whys State
  const [editedFiveWhysSteps, setEditedFiveWhysSteps] = useState<Array<{ stepNumber: number; question: string; answer: string }>>([]);
  const [editedRootCause, setEditedRootCause] = useState<string>('');
  const [isEditingFiveWhys, setIsEditingFiveWhys] = useState(false);
  const [validatingEdits, setValidatingEdits] = useState(false);
  const [editValidationFeedback, setEditValidationFeedback] = useState<{
    isValid: boolean;
    issues: Array<{ stepNumber: number; issue: string; suggestion: string }>;
    overallFeedback: string;
    resolvesOriginalProblem: boolean;
    suggestedRootCause?: string;
  } | null>(null);
  
  // 5 Whys Analysis Mode State
  const [fiveWhysMode, setFiveWhysMode] = useState<'choose' | 'manual' | 'ai'>('choose');
  const [manualFiveWhysSteps, setManualFiveWhysSteps] = useState<Array<{ stepNumber: number; question: string; answer: string }>>([
    { stepNumber: 1, question: 'Why did this happen?', answer: '' },
    { stepNumber: 2, question: 'Why?', answer: '' },
    { stepNumber: 3, question: 'Why?', answer: '' },
    { stepNumber: 4, question: 'Why?', answer: '' },
    { stepNumber: 5, question: 'Why?', answer: '' },
  ]);
  const [manualRootCause, setManualRootCause] = useState('');
  const [validatingManualAnalysis, setValidatingManualAnalysis] = useState(false);
  const [manualAnalysisValidation, setManualAnalysisValidation] = useState<{
    isValid: boolean;
    issues: Array<{ stepNumber: number; issue: string; suggestion: string; correctedText?: string }>;
    overallFeedback: string;
    resolvesOriginalProblem: boolean;
    suggestedRootCause?: string;
    spellingCorrections?: Array<{ original: string; corrected: string; stepNumber?: number }>;
  } | null>(null);
  
  // Action Plans State - Initialize from saved data
  const [actionPlans, setActionPlans] = useState<ActionPlans>(
    data.actionPlans || {
      immediate: [],
      shortTerm: [],
      longTerm: [],
    }
  );
  const [showActionPlans, setShowActionPlans] = useState(
    Boolean(data.actionPlans && (
      data.actionPlans.immediate.length > 0 ||
      data.actionPlans.shortTerm.length > 0 ||
      data.actionPlans.longTerm.length > 0
    ))
  );
  
  // Preventive Controls State - Initialize from saved data
  const [preventiveControls, setPreventiveControls] = useState<PreventiveControlItem[]>(
    data.preventiveControls || []
  );
  const [showPreventiveControls, setShowPreventiveControls] = useState(
    Boolean(data.preventiveControls && data.preventiveControls.length > 0)
  );
  
  // Corrective Actions Workflow State
  const [showCorrectiveActionsSection, setShowCorrectiveActionsSection] = useState(false);
  const [generatingCorrectiveActions, setGeneratingCorrectiveActions] = useState(false);
  const [validatingCorrectiveActions, setValidatingCorrectiveActions] = useState(false);
  const [correctiveActionsValidation, setCorrectiveActionsValidation] = useState<{
    isValid: boolean;
    overallAssessment: string;
    alignmentScore: number;
    effectivenessScore: number;
    feasibilityScore: number;
    issues: Array<{
      actionId: string;
      actionType: 'immediate' | 'shortTerm' | 'longTerm';
      issue: string;
      suggestion: string;
      severity: 'critical' | 'warning' | 'info';
    }>;
    recommendations: string[];
    refinedActions?: ActionPlans;
  } | null>(null);
  const [showManualActionForm, setShowManualActionForm] = useState(false);
  
  // Root Cause Blocks State
  const [expandedRootCauses, setExpandedRootCauses] = useState<Set<string>>(new Set());
  const [allRootCausesExpanded, setAllRootCausesExpanded] = useState(true);
  
  // Dropdown Options State
  const [controlTypeOptions, setControlTypeOptions] = useState<Array<{ value: string; label: string }>>([
    { value: 'process', label: 'Process Change' },
    { value: 'training', label: 'Training' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'documentation', label: 'Documentation' },
    { value: 'monitoring', label: 'Monitoring' },
  ]);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'analysis' | 'diagram' | 'actions' | 'controls'>('analysis');
  
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
  
  // Check if all causes are analyzed
  const allCausesAnalyzed = useCallback(() => {
    const allCauses = categories.flatMap(cat => cat.causes);
    if (allCauses.length === 0) return false;
    return allCauses.every(cause => 
      cause.fiveWhysAnalysis && 
      cause.fiveWhysAnalysis.isValidRootCause !== undefined
    );
  }, [categories]);
  
  const totalAnalyzedCauses = categories.flatMap(cat => cat.causes).filter(
    cause => cause.fiveWhysAnalysis && cause.fiveWhysAnalysis.isValidRootCause !== undefined
  ).length;

  // Computed: Get all analyzed root causes for display blocks
  const analyzedRootCausesForDisplay = categories.flatMap(cat => 
    cat.causes
      .filter(c => c.fiveWhysAnalysis && c.fiveWhysAnalysis.isValidRootCause !== undefined)
      .map(c => ({
        id: c.id,
        category: cat.name,
        categoryId: cat.id,
        cause: c.text,
        rootCause: c.fiveWhysAnalysis?.rootCause || c.text,
        isValidRootCause: c.fiveWhysAnalysis?.isValidRootCause ?? false,
        confidence: c.fiveWhysAnalysis?.confidence ?? 0,
        steps: c.fiveWhysAnalysis?.steps || [],
      }))
  );

  // Toggle individual root cause block
  const toggleRootCauseBlock = (causeId: string) => {
    setExpandedRootCauses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(causeId)) {
        newSet.delete(causeId);
      } else {
        newSet.add(causeId);
      }
      return newSet;
    });
  };

  // Toggle all root cause blocks
  const toggleAllRootCauses = () => {
    if (allRootCausesExpanded) {
      setExpandedRootCauses(new Set());
      setAllRootCausesExpanded(false);
    } else {
      setExpandedRootCauses(new Set(analyzedRootCausesForDisplay.map(rc => rc.id)));
      setAllRootCausesExpanded(true);
    }
  };

  // Auto-expand all when new causes are analyzed
  useEffect(() => {
    if (analyzedRootCausesForDisplay.length > 0 && allRootCausesExpanded) {
      setExpandedRootCauses(new Set(analyzedRootCausesForDisplay.map(rc => rc.id)));
    }
  }, [analyzedRootCausesForDisplay.length, allRootCausesExpanded]);

  // Auto-sync rootCauseText with analyzed causes (for save/validation purposes)
  useEffect(() => {
    if (analyzedRootCausesForDisplay.length > 0) {
      const confirmedRootCauses = analyzedRootCausesForDisplay.filter(rc => rc.isValidRootCause);
      const contributingFactors = analyzedRootCausesForDisplay.filter(rc => !rc.isValidRootCause);
      
      let statement = `Based on 5 Whys analysis:\n\n`;
      
      if (confirmedRootCauses.length > 0) {
        statement += `Confirmed Root Causes:\n`;
        confirmedRootCauses.forEach((rc, idx) => {
          statement += `${idx + 1}. [${rc.category}] ${rc.rootCause}\n`;
        });
        statement += '\n';
      }
      
      if (contributingFactors.length > 0) {
        statement += `Contributing Factors:\n`;
        contributingFactors.forEach((rc, idx) => {
          statement += `${idx + 1}. [${rc.category}] ${rc.cause}\n`;
        });
        statement += '\n';
      }
      
      statement += `Problem: ${problem}`;
      
      setRootCauseText(statement);
    } else if (analyzedRootCausesForDisplay.length === 0 && rootCauseText) {
      // Clear rootCauseText if no analyzed causes exist
      setRootCauseText('');
    }
  }, [analyzedRootCausesForDisplay, problem]);

  const generateId = () => Math.random().toString(36).substring(2, 11);

  // Generate complete AI analysis
  const generateAIAnalysis = async () => {
    setGeneratingFullAnalysis(true);
    setShowAIPanel(true);
    try {
      const response = await api.post(`/rca/${rcaId}/ai/generate-fishbone`);
      const result = response.data.data;
      setAiAnalysis(result);
    } catch (err) {
      console.error('Failed to generate AI analysis:', err);
      setAiAnalysis({
        problem: problem,
        categories: [],
        primaryRootCauses: [],
        rootCauseText: '',
        confidence: 0,
        rationale: 'Failed to generate AI analysis. Please try again.',
        recommendations: [],
        error: true,
      });
    } finally {
      setGeneratingFullAnalysis(false);
    }
  };

  // Start Enhanced AI Workflow - First validate problem statement
  const startAIWorkflow = async () => {
    if (!problem.trim()) {
      setErrorMessage('Please enter a problem statement before starting AI analysis.');
      return;
    }
    
    setShowAIPanel(true);
    setAiWorkflowStep('validating_problem');
    setProblemValidation(null);
    
    try {
      const response = await api.post(`/rca/${rcaId}/ai/fishbone-validate-problem`, {
        problem: problem.trim(),
      }, {
        timeout: 60000 // 60 seconds for validation
      });
      
      const validation = response.data.data;
      setProblemValidation(validation);
      
      if (validation.canProceed && !validation.needsClarification) {
        // Problem is valid, proceed to generation
        setAiWorkflowStep('generating');
        await generateEnhancedAnalysis();
      } else {
        // Need clarification or problem is invalid
        setAiWorkflowStep('problem_feedback');
        if (validation.clarificationQuestions) {
          setClarificationAnswers(new Array(validation.clarificationQuestions.length).fill(''));
        }
      }
    } catch (err) {
      console.error('Problem validation failed:', err);
      // Fallback to direct generation
      setAiWorkflowStep('generating');
      await generateEnhancedAnalysis();
    }
  };

  // Generate enhanced analysis with action plans
  const generateEnhancedAnalysis = async (retryCount = 0) => {
    setGeneratingFullAnalysis(true);
    setAiWorkflowStep('generating');
    
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 90000; // 90 seconds for AI analysis
    
    try {
      const response = await api.post(`/rca/${rcaId}/ai/fishbone-enhanced`, {}, {
        timeout: TIMEOUT_MS
      });
      const result = response.data.data;
      setAiAnalysis(result);
      setAiWorkflowStep('complete');
    } catch (err: any) {
      console.error('Failed to generate enhanced analysis:', err);
      
      // Check if it's a timeout error and we can retry
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      
      if (isTimeout && retryCount < MAX_RETRIES) {
        console.log(`Retrying AI analysis (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return generateEnhancedAnalysis(retryCount + 1);
      }
      
      // Check if the error response contains AI analysis data (e.g., from 503 response)
      if (err.response?.data?.data) {
        setAiAnalysis(err.response.data.data);
      } else {
        // Extract error message from response if available
        let errorMessage = err.response?.data?.error || err.message || 'Failed to generate AI analysis. Please try again.';
        if (isTimeout) {
          errorMessage = 'AI analysis timed out. The server may be busy. Please try again in a moment.';
        }
        setAiAnalysis({
          problem: problem,
          categories: [],
          primaryRootCauses: [],
          rootCauseText: '',
          confidence: 0,
          rationale: errorMessage,
          recommendations: [],
          actionPlans: { immediate: [], shortTerm: [], longTerm: [] },
          error: true,
        });
      }
      setAiWorkflowStep('complete');
    } finally {
      setGeneratingFullAnalysis(false);
    }
  };

  // Proceed with clarification answers
  const proceedWithClarification = async () => {
    setAiWorkflowStep('generating');
    await generateEnhancedAnalysis();
  };

  // Apply suggested problem revision
  const applySuggestedProblem = () => {
    if (problemValidation?.suggestedRevision) {
      setProblem(problemValidation.suggestedRevision);
    }
  };

  // Open 5 Whys modal for a cause (shows choice between Manual and AI)
  const openFiveWhysModal = (cause: FishboneCause, categoryName: string) => {
    setSelectedCauseForAnalysis({ id: cause.id, text: cause.text, categoryName });
    setFiveWhysMode('choose');
    setCauseAnalysisResult(null);
    setManualFiveWhysSteps([
      { stepNumber: 1, question: `Why did "${cause.text}" happen?`, answer: '' },
      { stepNumber: 2, question: 'Why?', answer: '' },
      { stepNumber: 3, question: 'Why?', answer: '' },
      { stepNumber: 4, question: 'Why?', answer: '' },
      { stepNumber: 5, question: 'Why?', answer: '' },
    ]);
    setManualRootCause('');
    setManualAnalysisValidation(null);
  };

  // Start AI-powered 5 Whys analysis
  const startAIFiveWhysAnalysis = async () => {
    if (!selectedCauseForAnalysis) return;
    
    setFiveWhysMode('ai');
    setAnalyzingCause(true);
    setCauseAnalysisResult(null);
    
    try {
      const response = await api.post(`/rca/${rcaId}/ai/fishbone-cause-five-whys`, {
        causeId: selectedCauseForAnalysis.id,
        causeText: selectedCauseForAnalysis.text,
        categoryName: selectedCauseForAnalysis.categoryName,
        problem,
      });
      
      setCauseAnalysisResult(response.data.data);
    } catch (err) {
      console.error('5 Whys analysis failed:', err);
      setErrorMessage('Failed to analyze cause with 5 Whys. Please try again.');
      setFiveWhysMode('choose');
    } finally {
      setAnalyzingCause(false);
    }
  };

  // Start Manual 5 Whys analysis
  const startManualFiveWhysAnalysis = () => {
    setFiveWhysMode('manual');
    setManualAnalysisValidation(null);
  };

  // Update a manual 5 Whys step
  const updateManualStep = (stepNumber: number, answer: string) => {
    setManualFiveWhysSteps(steps => 
      steps.map(step => 
        step.stepNumber === stepNumber ? { ...step, answer } : step
      )
    );
  };

  // Validate manual 5 Whys analysis with AI
  const validateManualFiveWhysAnalysis = async () => {
    if (!selectedCauseForAnalysis) return;
    
    setValidatingManualAnalysis(true);
    setManualAnalysisValidation(null);
    
    try {
      const response = await api.post(`/rca/${rcaId}/ai/validate-five-whys`, {
        causeText: selectedCauseForAnalysis.text,
        categoryName: selectedCauseForAnalysis.categoryName,
        problem,
        fiveWhysSteps: manualFiveWhysSteps,
        rootCause: manualRootCause,
      });
      
      setManualAnalysisValidation(response.data.data);
    } catch (err) {
      console.error('Manual 5 Whys validation failed:', err);
      // Set a default validation result
      setManualAnalysisValidation({
        isValid: true,
        issues: [],
        overallFeedback: 'AI validation is currently unavailable. Please review your analysis manually.',
        resolvesOriginalProblem: true,
      });
    } finally {
      setValidatingManualAnalysis(false);
    }
  };

  // Apply spelling/grammar correction from AI validation
  const applyManualCorrection = (stepNumber: number, correctedText: string) => {
    setManualFiveWhysSteps(steps =>
      steps.map(step =>
        step.stepNumber === stepNumber ? { ...step, answer: correctedText } : step
      )
    );
  };

  // Handle manual analysis recommendation (keep or eliminate)
  const handleManualCauseRecommendation = (recommendation: 'keep' | 'eliminate') => {
    if (!selectedCauseForAnalysis) return;
    
    if (recommendation === 'eliminate') {
      // Remove the cause from its category
      const updated = categories.map((cat) => ({
        ...cat,
        causes: cat.causes.filter((c) => c.id !== selectedCauseForAnalysis.id),
      }));
      setCategories(updated);
    } else {
      // Mark as validated root cause with manual analysis
      const fiveWhysAnalysis = {
        steps: manualFiveWhysSteps,
        rootCause: manualRootCause,
        isValidRootCause: true,
        confidence: manualAnalysisValidation?.resolvesOriginalProblem ? 0.85 : 0.7, // Higher confidence if AI validated as resolving problem
      };
      const updated = categories.map((cat) => ({
        ...cat,
        causes: cat.causes.map((c) =>
          c.id === selectedCauseForAnalysis.id
            ? { ...c, fiveWhysAnalysis }
            : c
        ),
      }));
      setCategories(updated);
    }
    
    closeFiveWhysModal();
  };

  // Close the 5 Whys modal and reset all state
  const closeFiveWhysModal = () => {
    setSelectedCauseForAnalysis(null);
    setCauseAnalysisResult(null);
    setFiveWhysMode('choose');
    setAnalyzingCause(false);
    setIsEditingFiveWhys(false);
    setEditedFiveWhysSteps([]);
    setEditedRootCause('');
    setEditValidationFeedback(null);
    setManualFiveWhysSteps([
      { stepNumber: 1, question: 'Why did this happen?', answer: '' },
      { stepNumber: 2, question: 'Why?', answer: '' },
      { stepNumber: 3, question: 'Why?', answer: '' },
      { stepNumber: 4, question: 'Why?', answer: '' },
      { stepNumber: 5, question: 'Why?', answer: '' },
    ]);
    setManualRootCause('');
    setManualAnalysisValidation(null);
    setValidatingManualAnalysis(false);
  };

  // Legacy function - keep for compatibility but redirect to new modal
  const analyzeCauseWithFiveWhys = (cause: FishboneCause, categoryName: string) => {
    openFiveWhysModal(cause, categoryName);
  };

  // Mark cause based on analysis recommendation (for AI analysis)
  const handleCauseRecommendation = (recommendation: 'keep' | 'eliminate') => {
    if (!selectedCauseForAnalysis || !causeAnalysisResult) return;
    
    if (recommendation === 'eliminate') {
      // Remove the cause from its category
      const updated = categories.map((cat) => ({
        ...cat,
        causes: cat.causes.filter((c) => c.id !== selectedCauseForAnalysis.id),
      }));
      setCategories(updated);
    } else {
      // Mark as validated root cause
      const updated = categories.map((cat) => ({
        ...cat,
        causes: cat.causes.map((c) => 
          c.id === selectedCauseForAnalysis.id 
            ? { ...c, fiveWhysAnalysis: { ...causeAnalysisResult.fiveWhys, isValidRootCause: true } }
            : c
        ),
      }));
      setCategories(updated);
    }
    
    closeFiveWhysModal();
  };

  // Start editing the 5 Whys
  const startEditingFiveWhys = () => {
    if (causeAnalysisResult) {
      setEditedFiveWhysSteps([...causeAnalysisResult.fiveWhys.steps]);
      setEditedRootCause(causeAnalysisResult.fiveWhys.rootCause);
      setIsEditingFiveWhys(true);
      setEditValidationFeedback(null);
    }
  };

  // Update an edited step answer
  const updateEditedStepAnswer = (stepNumber: number, newAnswer: string) => {
    setEditedFiveWhysSteps(prev => 
      prev.map(step => 
        step.stepNumber === stepNumber ? { ...step, answer: newAnswer } : step
      )
    );
    // Clear validation feedback when user edits
    setEditValidationFeedback(null);
  };

  // Update edited root cause
  const updateEditedRootCause = (newRootCause: string) => {
    setEditedRootCause(newRootCause);
    setEditValidationFeedback(null);
  };

  // Cancel editing
  const cancelEditingFiveWhys = () => {
    setIsEditingFiveWhys(false);
    setEditedFiveWhysSteps([]);
    setEditedRootCause('');
    setEditValidationFeedback(null);
  };

  // Validate edited 5 Whys with AI
  const validateEditedFiveWhys = async () => {
    if (!selectedCauseForAnalysis) return;
    
    setValidatingEdits(true);
    setEditValidationFeedback(null);
    
    try {
      const response = await api.post(`/rca/${rcaId}/ai/validate-edited-five-whys`, {
        causeText: selectedCauseForAnalysis.text,
        categoryName: selectedCauseForAnalysis.categoryName,
        problem: problem,
        editedSteps: editedFiveWhysSteps,
        editedRootCause: editedRootCause,
      });
      
      const validation = response.data.data;
      setEditValidationFeedback(validation);
      
      // If valid, update the cause analysis result
      if (validation.isValid) {
        setCauseAnalysisResult(prev => prev ? {
          ...prev,
          fiveWhys: {
            ...prev.fiveWhys,
            steps: editedFiveWhysSteps,
            rootCause: validation.suggestedRootCause || editedRootCause,
          },
          resolvesOriginalProblem: validation.resolvesOriginalProblem,
          validationExplanation: validation.overallFeedback,
        } : null);
        setIsEditingFiveWhys(false);
      }
    } catch (err) {
      console.error('Failed to validate edited 5 Whys:', err);
      setEditValidationFeedback({
        isValid: false,
        issues: [],
        overallFeedback: 'Failed to validate edits. Please try again.',
        resolvesOriginalProblem: false,
      });
    } finally {
      setValidatingEdits(false);
    }
  };

  // Apply AI suggestion to fix an issue
  const applyIssueSuggestion = (stepNumber: number, suggestion: string) => {
    setEditedFiveWhysSteps(prev => 
      prev.map(step => 
        step.stepNumber === stepNumber ? { ...step, answer: suggestion } : step
      )
    );
    // Remove this issue from feedback
    setEditValidationFeedback(prev => prev ? {
      ...prev,
      issues: prev.issues.filter(issue => issue.stepNumber !== stepNumber),
    } : null);
  };

  // Apply AI analysis to current form
  const applyAIAnalysis = () => {
    if (aiAnalysis && !aiAnalysis.error) {
      setProblem(aiAnalysis.problem);
      setCategories(aiAnalysis.categories);
      
      // DO NOT apply rootCauseText from AI analysis
      // Root Cause Statement should only be generated AFTER all causes
      // have been individually analyzed with 5 Whys (marked as "Analyzed")
      // setRootCauseText(aiAnalysis.rootCauseText);
      
      // DO NOT apply action plans from AI analysis
      // Corrective actions should only be generated AFTER all causes
      // have been individually analyzed with 5 Whys (marked as "Analyzed")
      // The user will use the dedicated buttons to generate corrective actions
      
      setShowAIPanel(false);
      setAiWorkflowStep('idle');
    }
  };

  // Close AI workflow
  const closeAIWorkflow = () => {
    setShowAIPanel(false);
    setAiWorkflowStep('idle');
    setProblemValidation(null);
    setClarificationAnswers([]);
    setAiAnalysis(null);
  };

  const addCause = (categoryId: string) => {
    const text = newCauseInputs[categoryId]?.trim();
    if (!text) return;

    const updated = categories.map((cat) => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          causes: [...cat.causes, { id: generateId(), text, aiSuggested: false }],
        };
      }
      return cat;
    });
    setCategories(updated);
    setNewCauseInputs((prev) => ({ ...prev, [categoryId]: '' }));
  };

  const removeCause = (categoryId: string, causeId: string) => {
    const updated = categories.map((cat) => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          causes: cat.causes.filter((c) => c.id !== causeId),
        };
      }
      return cat;
    });
    setCategories(updated);
  };

  const updateCause = (categoryId: string, causeId: string, text: string) => {
    const updated = categories.map((cat) => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          causes: cat.causes.map((c) => (c.id === causeId ? { ...c, text } : c)),
        };
      }
      return cat;
    });
    setCategories(updated);
  };

  const getAISuggestions = async (categoryId: string, categoryName: string) => {
    setLoadingAI(categoryId);
    try {
      const existingCauses = categories.find(c => c.id === categoryId)?.causes.map(c => c.text) || [];
      const response = await api.post(`/rca/${rcaId}/ai/fishbone-category-suggestions`, {
        categoryName,
        existingCauses,
      });

      const { suggestedCauses } = response.data.data;
      
      const updated = categories.map((cat) => {
        if (cat.id === categoryId) {
          const newCauses = suggestedCauses.map((item: any) => ({
            id: generateId(),
            text: typeof item === 'string' ? item : item.text,
            aiSuggested: true,
            likelihood: typeof item === 'object' ? item.likelihood : 'medium',
          }));
          return {
            ...cat,
            causes: [...cat.causes, ...newCauses],
          };
        }
        return cat;
      });
      setCategories(updated);
    } catch (err) {
      console.error('Failed to get AI suggestions:', err);
    } finally {
      setLoadingAI(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      await onSave({ problem, categories, rootCauseText, actionPlans, preventiveControls });
      showToast('Progress saved successfully', 'success');
    } catch (err: any) {
      console.error('Failed to save:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to save. Please try again.');
      showToast('Failed to save progress', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Re-open validated RCA for editing
  const handleReopen = async () => {
    if (!onReopen) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await onReopen();
    } catch (err: any) {
      console.error('Failed to re-open RCA:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to re-open RCA. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!validationStatement.trim()) return;
    setSaving(true);
    setErrorMessage(null);
    try {
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

  // Generate AI Corrective Actions based on analyzed causes
  const generateAICorrectiveActions = async () => {
    setGeneratingCorrectiveActions(true);
    setCorrectiveActionsValidation(null);
    
    try {
      // Collect all analyzed causes with their 5 Whys data
      const analyzedCauses = categories.flatMap(cat => 
        cat.causes.filter(c => c.fiveWhysAnalysis && c.fiveWhysAnalysis.isValidRootCause)
          .map(c => ({
            categoryName: cat.name,
            causeText: c.text,
            rootCause: c.fiveWhysAnalysis?.rootCause,
            fiveWhysSteps: c.fiveWhysAnalysis?.steps,
          }))
      );
      
      const response = await api.post(`/rca/${rcaId}/ai/generate-corrective-actions`, {
        problem,
        analyzedCauses,
        existingActions: actionPlans,
      });
      
      const result = response.data.data;
      setActionPlans(result.actionPlans);
      // Also set preventive controls if returned
      if (result.preventiveControls) {
        setPreventiveControls(result.preventiveControls);
        setShowPreventiveControls(true);
      }
      setShowActionPlans(true);
      setShowCorrectiveActionsSection(true);
    } catch (err: any) {
      console.error('Failed to generate AI corrective actions:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to generate corrective actions. Please try again.');
    } finally {
      setGeneratingCorrectiveActions(false);
    }
  };

  // Validate corrective actions with AI
  const validateCorrectiveActionsWithAI = async () => {
    setValidatingCorrectiveActions(true);
    setCorrectiveActionsValidation(null);
    
    try {
      // Collect all analyzed causes
      const analyzedCauses = categories.flatMap(cat => 
        cat.causes.filter(c => c.fiveWhysAnalysis && c.fiveWhysAnalysis.isValidRootCause)
          .map(c => ({
            categoryName: cat.name,
            causeText: c.text,
            rootCause: c.fiveWhysAnalysis?.rootCause,
          }))
      );
      
      const response = await api.post(`/rca/${rcaId}/ai/validate-corrective-actions`, {
        problem,
        analyzedCauses,
        actionPlans,
      });
      
      setCorrectiveActionsValidation(response.data.data);
    } catch (err: any) {
      console.error('Failed to validate corrective actions:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to validate corrective actions. Please try again.');
    } finally {
      setValidatingCorrectiveActions(false);
    }
  };

  // Apply AI refined actions
  const applyRefinedActions = () => {
    if (correctiveActionsValidation?.refinedActions) {
      const refined = correctiveActionsValidation.refinedActions;
      
      console.log('Applying refined actions:', JSON.stringify(refined, null, 2));
      console.log('Current action plans:', JSON.stringify(actionPlans, null, 2));
      
      // Helper function to check if an action array has valid content
      const hasValidActions = (actions: ActionPlanItem[] | undefined): boolean => {
        if (!actions || !Array.isArray(actions)) return false;
        if (actions.length === 0) return false;
        // Check if at least one action has non-empty text
        return actions.some(a => a.action && a.action.trim().length > 0);
      };
      
      // Helper function to filter out empty actions
      const filterValidActions = (actions: ActionPlanItem[] | undefined): ActionPlanItem[] => {
        if (!actions || !Array.isArray(actions)) return [];
        return actions.filter(a => a.action && a.action.trim().length > 0);
      };
      
      // Check which categories have valid refined content
      const hasRefinedImmediate = hasValidActions(refined.immediate);
      const hasRefinedShortTerm = hasValidActions(refined.shortTerm);
      const hasRefinedLongTerm = hasValidActions(refined.longTerm);
      
      console.log('Has refined:', { hasRefinedImmediate, hasRefinedShortTerm, hasRefinedLongTerm });
      
      // Build new action plans, preserving existing if refined is empty/invalid
      const newActionPlans: ActionPlans = {
        immediate: hasRefinedImmediate ? filterValidActions(refined.immediate) : actionPlans.immediate,
        shortTerm: hasRefinedShortTerm ? filterValidActions(refined.shortTerm) : actionPlans.shortTerm,
        longTerm: hasRefinedLongTerm ? filterValidActions(refined.longTerm) : actionPlans.longTerm,
      };
      
      console.log('New action plans:', JSON.stringify(newActionPlans, null, 2));
      
      // Always set the new plans - we've already ensured we keep existing if refined is empty
      setActionPlans(newActionPlans);
    }
    
    setCorrectiveActionsValidation(null);
  };

  // Start manual corrective actions
  const startManualCorrectiveActions = () => {
    setShowManualActionForm(true);
    setShowCorrectiveActionsSection(true);
    setShowActionPlans(true);
    // Initialize with empty action items if none exist
    if (actionPlans.immediate.length === 0 && actionPlans.shortTerm.length === 0 && actionPlans.longTerm.length === 0) {
      setActionPlans({
        immediate: [{ id: `imm-${Date.now()}`, action: '', priority: 'high', status: 'pending' }],
        shortTerm: [{ id: `st-${Date.now()}`, action: '', priority: 'medium', status: 'pending' }],
        longTerm: [{ id: `lt-${Date.now()}`, action: '', priority: 'medium', status: 'pending' }],
      });
    }
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

  const totalCauses = categories.reduce((sum, cat) => sum + cat.causes.length, 0);

  // Get category colors
  const getCategoryColor = (index: number) => {
    const colors = [
      'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
      'border-green-500 bg-green-50 dark:bg-green-900/20',
      'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
      'border-red-500 bg-red-50 dark:bg-red-900/20',
      'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
      'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    ];
    return colors[index % colors.length];
  };

  const getCategoryHeaderColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-orange-500',
    ];
    return colors[index % colors.length];
  };

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
          Fishbone Diagram (Ishikawa)
        </h2>
        <div className="flex items-center space-x-3">
          {!isValidated && (
            <button
              onClick={startAIWorkflow}
              disabled={generatingFullAnalysis || showAIPanel}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center space-x-2 shadow-lg"
            >
              {generatingFullAnalysis ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>🤖 AI Generate Analysis</span>
                </>
              )}
            </button>
          )}
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
            {totalCauses} causes identified
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>Cause Analysis</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              {totalCauses}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors flex items-center space-x-2 ${
              activeTab === 'diagram'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-500 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <span className="text-lg">🐟</span>
            <span>Fishbone Diagram</span>
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

      {/* Enhanced AI Workflow Panel */}
      {showAIPanel && (
        <div className="mb-6 p-5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🤖</span>
              <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                AI-Assisted Fishbone Analysis
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

          {/* Step 1: Validating Problem */}
          {aiWorkflowStep === 'validating_problem' && (
            <div className="text-center py-8">
              <svg className="animate-spin h-10 w-10 mx-auto text-purple-600 mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-purple-700 dark:text-purple-300 font-medium">Validating Problem Statement...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">AI is analyzing if the problem is clear and actionable</p>
            </div>
          )}

          {/* Step 2: Problem Feedback */}
          {aiWorkflowStep === 'problem_feedback' && problemValidation && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${
                problemValidation.isValid 
                  ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700'
                  : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  {problemValidation.isValid ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <span className="font-medium">{problemValidation.isValid ? 'Problem Statement Validated' : 'Clarification Needed'}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{problemValidation.feedback}</p>
              </div>

              {/* Clarification Questions */}
              {problemValidation.clarificationQuestions && problemValidation.clarificationQuestions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">Please provide additional information:</h4>
                  {problemValidation.clarificationQuestions.map((question, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="text-sm text-gray-700 dark:text-gray-300">{question}</label>
                      <input
                        type="text"
                        value={clarificationAnswers[idx] || ''}
                        onChange={(e) => {
                          const updated = [...clarificationAnswers];
                          updated[idx] = e.target.value;
                          setClarificationAnswers(updated);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Your answer..."
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested Revision */}
              {problemValidation.suggestedRevision && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Suggested Problem Statement:</h4>
                  <p className="text-sm text-blue-900 dark:text-blue-100 italic">&quot;{problemValidation.suggestedRevision}&quot;</p>
                  <button
                    onClick={applySuggestedProblem}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Apply this revision
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={closeAIWorkflow}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={proceedWithClarification}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Proceed with Analysis
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Generating Analysis */}
          {aiWorkflowStep === 'generating' && (
            <div className="text-center py-8">
              <svg className="animate-spin h-10 w-10 mx-auto text-purple-600 mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-purple-700 dark:text-purple-300 font-medium">Generating Fishbone Analysis...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">AI is identifying potential causes across all 6M categories</p>
            </div>
          )}

          {/* Step 4: Complete - Show Results */}
          {aiWorkflowStep === 'complete' && aiAnalysis && (
            <>
              {aiAnalysis.error ? (
                <div className="text-red-600 dark:text-red-400 p-4">
                  <p>{aiAnalysis.rationale}</p>
                </div>
              ) : (
                <>
                  {/* Confidence Score */}
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                      {Math.round(aiAnalysis.confidence * 100)}% Confidence
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {aiAnalysis.categories.reduce((sum, cat) => sum + cat.causes.length, 0)} potential causes identified
                    </span>
                  </div>

                  {/* Detailed Categories with Reasoning */}
                  <div className="space-y-4 mb-4 max-h-[400px] overflow-y-auto">
                    {aiAnalysis.categories.map((cat, idx) => (
                      <div key={idx} className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-3 flex items-center">
                          <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs mr-2">
                            {cat.causes.length}
                          </span>
                          {cat.name}
                        </h4>
                        <div className="space-y-2">
                          {cat.causes.map((cause, cIdx) => (
                            <div key={cIdx} className="pl-3 border-l-2 border-gray-200 dark:border-gray-600">
                              <div className="flex items-start gap-2">
                                <span className={`mt-0.5 flex-shrink-0 ${
                                  cause.likelihood === 'high' ? 'text-red-500' :
                                  cause.likelihood === 'medium' ? 'text-yellow-500' : 'text-gray-400'
                                }`}>●</span>
                                <div className="flex-1">
                                  <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{cause.text}</p>
                                  {cause.reasoning && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                                      💡 {cause.reasoning}
                                    </p>
                                  )}
                                </div>
                                <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                  cause.likelihood === 'high' 
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                                    : cause.likelihood === 'medium'
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}>
                                  {cause.likelihood || 'low'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Overall Rationale */}
                  {aiAnalysis.rationale && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4 border border-blue-200 dark:border-blue-700">
                      <div className="flex items-start space-x-2">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <div>
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">AI Analysis Summary</span>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{aiAnalysis.rationale}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Note: Primary Root Causes, Root Cause Statement, AI Rationale, and Action Plans
                      will only be available AFTER completing 5 Whys analysis on all causes */}
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-4 border border-amber-200 dark:border-amber-700">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Next Step: 5 Whys Analysis</span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      After applying these causes, perform 5 Whys analysis on each cause to identify root causes. 
                      Root Cause Statement and Corrective Actions will be available once all causes are analyzed.
                    </p>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
                    <span className="flex items-center"><span className="text-red-500 mr-1">●</span> High likelihood</span>
                    <span className="flex items-center"><span className="text-yellow-500 mr-1">●</span> Medium likelihood</span>
                    <span className="flex items-center"><span className="text-gray-400 mr-1">●</span> Low likelihood</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={closeAIWorkflow}
                      className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Keep Current
                    </button>
                    <button
                      onClick={applyAIAnalysis}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Apply AI Analysis</span>
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                    💡 You can edit all causes, drill down with 5 Whys, and modify action plans after applying
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Cause 5 Whys Analysis Modal */}
      {selectedCauseForAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                5 Whys Analysis: {selectedCauseForAnalysis.categoryName}
              </h3>
              <button
                onClick={closeFiveWhysModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg mb-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">Analyzing Cause:</span>
              <p className="text-gray-900 dark:text-white font-medium">{selectedCauseForAnalysis.text}</p>
            </div>

            {/* Choice Screen - Manual vs AI */}
            {fiveWhysMode === 'choose' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                  Choose how you want to perform the 5 Whys analysis for this cause:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Manual Analysis Button */}
                  <button
                    onClick={startManualFiveWhysAnalysis}
                    className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all group"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                        <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Manual Analysis</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        Enter your own 5 Whys analysis. AI will validate your answers for accuracy and spelling.
                      </p>
                    </div>
                  </button>

                  {/* AI Analysis Button */}
                  <button
                    onClick={startAIFiveWhysAnalysis}
                    className="p-6 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl hover:border-purple-400 dark:hover:border-purple-500 transition-all group"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
                        <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">AI Analysis</h4>
                      <p className="text-sm text-purple-600 dark:text-purple-400">
                        Let AI automatically generate the 5 Whys analysis based on the cause and context.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Manual Analysis Mode */}
            {fiveWhysMode === 'manual' && (
              <div className="space-y-4">
                {/* Back button */}
                <button
                  onClick={() => setFiveWhysMode('choose')}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center space-x-1 mb-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back to options</span>
                </button>

                {/* Validating spinner */}
                {validatingManualAnalysis && (
                  <div className="text-center py-4">
                    <svg className="animate-spin h-8 w-8 mx-auto text-purple-600 mb-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-600 dark:text-gray-300">AI is validating your analysis...</p>
                  </div>
                )}

                {/* Manual 5 Whys Steps */}
                {!validatingManualAnalysis && (
                  <>
                    <div className="space-y-3">
                      {manualFiveWhysSteps.map((step) => {
                        const issue = manualAnalysisValidation?.issues.find(i => i.stepNumber === step.stepNumber);
                        return (
                          <div key={step.stepNumber} className={`p-3 rounded-lg ${
                            issue 
                              ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' 
                              : 'bg-gray-50 dark:bg-gray-700/50'
                          }`}>
                            <div className="flex items-start space-x-2">
                              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shrink-0 ${
                                issue ? 'bg-amber-500' : 'bg-blue-600'
                              }`}>
                                {step.stepNumber}
                              </span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{step.question}</p>
                                <textarea
                                  value={step.answer}
                                  onChange={(e) => updateManualStep(step.stepNumber, e.target.value)}
                                  placeholder="Enter your answer..."
                                  rows={2}
                                  className={`w-full mt-1 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                                    issue 
                                      ? 'border-amber-300 dark:border-amber-600' 
                                      : 'border-gray-300 dark:border-gray-600'
                                  } focus:outline-none focus:ring-1 focus:border-blue-500`}
                                />
                                
                                {/* Issue Feedback from validation */}
                                {issue && (
                                  <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
                                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">⚠️ {issue.issue}</p>
                                    {issue.suggestion && (
                                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">💡 {issue.suggestion}</p>
                                    )}
                                    {issue.correctedText && (
                                      <button
                                        onClick={() => applyManualCorrection(step.stepNumber, issue.correctedText!)}
                                        className="mt-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
                                      >
                                        Apply correction
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Root Cause Input */}
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                      <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                        Root Cause (Final Answer)
                      </label>
                      <textarea
                        value={manualRootCause}
                        onChange={(e) => setManualRootCause(e.target.value)}
                        placeholder="Based on your 5 Whys analysis, what is the root cause?"
                        rows={2}
                        className="w-full px-2 py-1 text-sm border border-green-300 dark:border-green-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:border-green-500"
                      />
                      
                      {/* Suggested Root Cause from validation */}
                      {manualAnalysisValidation?.suggestedRootCause && manualAnalysisValidation.suggestedRootCause !== manualRootCause && (
                        <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                          <p className="text-xs text-blue-700 dark:text-blue-300">💡 AI Suggested Root Cause:</p>
                          <p className="text-xs text-blue-900 dark:text-blue-100 mt-1 italic">&quot;{manualAnalysisValidation.suggestedRootCause}&quot;</p>
                          <button
                            onClick={() => setManualRootCause(manualAnalysisValidation.suggestedRootCause!)}
                            className="mt-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
                          >
                            Apply Suggestion
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Spelling Corrections */}
                    {manualAnalysisValidation?.spellingCorrections && manualAnalysisValidation.spellingCorrections.length > 0 && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                        <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-2">📝 Spelling Corrections Detected:</p>
                        <ul className="space-y-1">
                          {manualAnalysisValidation.spellingCorrections.map((corr, idx) => (
                            <li key={idx} className="text-xs text-yellow-600 dark:text-yellow-400">
                              <span className="line-through text-red-500">{corr.original}</span> → <span className="text-green-600">{corr.corrected}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Overall Validation Feedback */}
                    {manualAnalysisValidation && (
                      <div className={`p-3 rounded-lg ${
                        manualAnalysisValidation.isValid
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                          : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                      }`}>
                        <div className="flex items-start space-x-2">
                          {manualAnalysisValidation.isValid ? (
                            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          )}
                          <p className="text-sm text-gray-700 dark:text-gray-300">{manualAnalysisValidation.overallFeedback}</p>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons for Manual Analysis */}
                    <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={validateManualFiveWhysAnalysis}
                        disabled={validatingManualAnalysis || manualFiveWhysSteps.some(s => !s.answer.trim()) || !manualRootCause.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Validate with AI</span>
                      </button>
                      
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleManualCauseRecommendation('eliminate')}
                          disabled={manualFiveWhysSteps.some(s => !s.answer.trim()) || !manualRootCause.trim()}
                          className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Eliminate Cause</span>
                        </button>
                        <button
                          onClick={() => handleManualCauseRecommendation('keep')}
                          disabled={manualFiveWhysSteps.some(s => !s.answer.trim()) || !manualRootCause.trim()}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Keep as Root Cause</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* AI Analysis Mode */}
            {fiveWhysMode === 'ai' && (
              <>
                {analyzingCause ? (
                  <div className="text-center py-8">
                    <svg className="animate-spin h-10 w-10 mx-auto text-purple-600 mb-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-gray-600 dark:text-gray-300">AI is performing 5 Whys analysis...</p>
                  </div>
                ) : validatingEdits ? (
                  <div className="text-center py-8">
                    <svg className="animate-spin h-10 w-10 mx-auto text-purple-600 mb-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-gray-600 dark:text-gray-300">AI is validating your edits...</p>
                  </div>
                ) : causeAnalysisResult ? (
              <div className="space-y-4">
                {/* Edit Mode Toggle */}
                {!isEditingFiveWhys && (
                  <div className="flex justify-end">
                    <button
                      onClick={startEditingFiveWhys}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit Answers</span>
                    </button>
                  </div>
                )}

                {/* 5 Whys Steps - Editable or View Mode */}
                <div className="space-y-3">
                  {(isEditingFiveWhys ? editedFiveWhysSteps : causeAnalysisResult.fiveWhys.steps).map((step, idx) => {
                    const issue = editValidationFeedback?.issues.find(i => i.stepNumber === step.stepNumber);
                    const originalStep = causeAnalysisResult.fiveWhys.steps[idx];
                    return (
                      <div key={idx} className={`p-4 rounded-lg ${
                        issue 
                          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700' 
                          : 'bg-gray-50 dark:bg-gray-700/50'
                      }`}>
                        <div className="flex items-start space-x-3">
                          <span className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shrink-0 ${
                            issue ? 'bg-red-500' : 'bg-purple-600'
                          }`}>
                            {step.stepNumber}
                          </span>
                          <div className="flex-1">
                            {/* Question */}
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{step.question}</p>
                            
                            {/* Two-column layout for Answer and Explanation */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* Answer Column */}
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">Answer</span>
                                {isEditingFiveWhys ? (
                                  <textarea
                                    value={step.answer}
                                    onChange={(e) => updateEditedStepAnswer(step.stepNumber, e.target.value)}
                                    rows={3}
                                    className={`w-full mt-2 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                                      issue 
                                        ? 'border-red-300 dark:border-red-600 focus:border-red-500' 
                                        : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                                    } focus:outline-none focus:ring-1`}
                                  />
                                ) : (
                                  <p className="text-sm text-gray-900 dark:text-white mt-2">{step.answer}</p>
                                )}
                              </div>
                              
                              {/* Explanation Column */}
                              {!isEditingFiveWhys && originalStep?.explanation && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Why This Matters
                                  </span>
                                  <p className="text-sm text-blue-800 dark:text-blue-200 mt-2 leading-relaxed">{originalStep.explanation}</p>
                                </div>
                              )}
                            </div>
                            
                            {/* Issue Feedback */}
                            {issue && (
                              <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded">
                                <p className="text-xs text-red-700 dark:text-red-300 font-medium">⚠️ {issue.issue}</p>
                                <div className="mt-1 flex items-center justify-between">
                                  <p className="text-xs text-red-600 dark:text-red-400 italic">Suggestion: {issue.suggestion}</p>
                                  <button
                                    onClick={() => applyIssueSuggestion(step.stepNumber, issue.suggestion)}
                                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
                                  >
                                    Apply Fix
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Root Cause - Editable or View Mode */}
                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <span className="text-xs font-medium text-green-700 dark:text-green-300 uppercase">Root Cause Identified</span>
                  {isEditingFiveWhys ? (
                    <textarea
                      value={editedRootCause}
                      onChange={(e) => updateEditedRootCause(e.target.value)}
                      rows={2}
                      className="w-full mt-1 px-2 py-1 text-sm border border-green-300 dark:border-green-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:border-green-500"
                    />
                  ) : (
                    <p className="text-green-900 dark:text-green-100 font-medium mt-1">{causeAnalysisResult.fiveWhys.rootCause}</p>
                  )}
                  
                  {/* Suggested Root Cause from validation */}
                  {editValidationFeedback?.suggestedRootCause && editValidationFeedback.suggestedRootCause !== editedRootCause && (
                    <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                      <p className="text-xs text-blue-700 dark:text-blue-300">💡 AI Suggested Root Cause:</p>
                      <p className="text-xs text-blue-900 dark:text-blue-100 mt-1 italic">&quot;{editValidationFeedback.suggestedRootCause}&quot;</p>
                      <button
                        onClick={() => updateEditedRootCause(editValidationFeedback.suggestedRootCause!)}
                        className="mt-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
                      >
                        Apply Suggestion
                      </button>
                    </div>
                  )}
                </div>

                {/* Overall Validation Feedback */}
                {editValidationFeedback && (
                  <div className={`p-3 rounded-lg ${
                    editValidationFeedback.isValid
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                      : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                  }`}>
                    <div className="flex items-start space-x-2">
                      {editValidationFeedback.isValid ? (
                        <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      <p className="text-sm text-gray-700 dark:text-gray-300">{editValidationFeedback.overallFeedback}</p>
                    </div>
                  </div>
                )}

                {/* Validation Result - Only show when not editing */}
                {!isEditingFiveWhys && (
                  <div className={`p-5 rounded-xl ${
                    causeAnalysisResult.resolvesOriginalProblem
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-600'
                      : 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-300 dark:border-amber-600'
                  }`}>
                    <div className="flex items-start space-x-3">
                      {causeAnalysisResult.resolvesOriginalProblem ? (
                        <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className={`text-lg font-bold mb-2 ${
                          causeAnalysisResult.resolvesOriginalProblem
                            ? 'text-green-800 dark:text-green-200'
                            : 'text-amber-800 dark:text-amber-200'
                        }`}>
                          {causeAnalysisResult.resolvesOriginalProblem 
                            ? '✓ This root cause would resolve the original problem' 
                            : '⚠ This cause may not directly resolve the problem'}
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{causeAnalysisResult.validationExplanation}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons - Different for edit mode */}
                {isEditingFiveWhys ? (
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={cancelEditingFiveWhys}
                      className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={validateEditedFiveWhys}
                      disabled={validatingEdits}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Validate with AI</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => handleCauseRecommendation('eliminate')}
                      className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 rounded-lg flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Eliminate Cause</span>
                    </button>
                    <button
                      onClick={() => handleCauseRecommendation('keep')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Keep as Root Cause</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* No AI result yet - show back button */
              <div className="text-center py-4">
                <button
                  onClick={() => setFiveWhysMode('choose')}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center space-x-1 mx-auto"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back to options</span>
                </button>
              </div>
            )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Legacy AI Analysis Panel for backward compatibility */}
      {showAIPanel && aiAnalysis && aiWorkflowStep === 'idle' && (
        <div className="mb-6 p-5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🤖</span>
              <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                AI-Generated Fishbone Analysis
              </h3>
              {!aiAnalysis.error && (
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                  {Math.round(aiAnalysis.confidence * 100)}% Confidence
                </span>
              )}
            </div>
            <button
              onClick={() => setShowAIPanel(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {aiAnalysis.error ? (
            <div className="text-red-600 dark:text-red-400">
              <p>{aiAnalysis.rationale}</p>
            </div>
          ) : (
            <>
              {/* Preview Categories */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {aiAnalysis.categories.map((cat, idx) => (
                  <div key={idx} className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2">{cat.name}</h4>
                    <ul className="space-y-1">
                      {cat.causes.slice(0, 3).map((cause, cIdx) => (
                        <li key={cIdx} className="text-xs text-gray-600 dark:text-gray-300 flex items-start">
                          <span className={`mr-1 ${
                            cause.likelihood === 'high' ? 'text-red-500' :
                            cause.likelihood === 'medium' ? 'text-yellow-500' : 'text-gray-400'
                          }`}>●</span>
                          {cause.text}
                        </li>
                      ))}
                      {cat.causes.length > 3 && (
                        <li className="text-xs text-gray-400">+{cat.causes.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Note: Primary Root Causes, Root Cause Statement, AI Rationale, and Recommendations
                  will only be available AFTER completing 5 Whys analysis on all causes */}
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-4 border border-amber-200 dark:border-amber-700">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Next Step: 5 Whys Analysis</span>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  After applying these causes, perform 5 Whys analysis on each cause to identify root causes. 
                  Root Cause Statement and Corrective Actions will be available once all causes are analyzed.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
                <span className="flex items-center"><span className="text-red-500 mr-1">●</span> High likelihood</span>
                <span className="flex items-center"><span className="text-yellow-500 mr-1">●</span> Medium likelihood</span>
                <span className="flex items-center"><span className="text-gray-400 mr-1">●</span> Low likelihood</span>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAIPanel(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Keep Current
                </button>
                <button
                  onClick={applyAIAnalysis}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Apply AI Analysis</span>
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                💡 You can edit all causes and categories after applying the AI analysis
              </p>
            </>
          )}
        </div>
      )}

      {/* Analysis Tab Content */}
      {activeTab === 'analysis' && (
        <>
          {/* Problem Statement (Fish Head) */}
          <div className="mb-8 p-4 border-2 border-gray-400 dark:border-gray-500 rounded-lg bg-gray-100 dark:bg-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Problem Statement (Effect)
            </label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              disabled={isValidated}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
              placeholder="Describe the problem or effect..."
            />
          </div>

          {/* Categories (Fish Bones) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className={`border-l-4 rounded-lg p-4 ${getCategoryColor(index)}`}
              >
                {/* Category Header */}
                <div className={`-mx-4 -mt-4 mb-4 px-4 py-2 rounded-t-lg ${getCategoryHeaderColor(index)}`}>
                  <h3 className="font-medium text-white">{category.name}</h3>
                </div>

                {/* Causes List */}
                <div className="space-y-2 mb-4">
                  {category.causes.map((cause) => (
                    <div
                      key={cause.id}
                      className={`flex items-start justify-between p-2 rounded ${
                        cause.aiSuggested
                          ? 'bg-blue-100 dark:bg-blue-800/30 border border-blue-200 dark:border-blue-600'
                          : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          {cause.likelihood && (
                            <span className={`text-xs ${
                              cause.likelihood === 'high' ? 'text-red-500' :
                              cause.likelihood === 'medium' ? 'text-yellow-500' : 'text-gray-400'
                            }`}>●</span>
                          )}
                          {isValidated ? (
                            <p className="text-sm text-gray-900 dark:text-white">{cause.text}</p>
                          ) : (
                            <input
                              type="text"
                              value={cause.text}
                              onChange={(e) => updateCause(category.id, cause.id, e.target.value)}
                              className="w-full text-sm bg-transparent text-gray-900 dark:text-white border-none p-0 focus:ring-0"
                            />
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1 ml-4">
                          {cause.aiSuggested && (
                            <span className="text-xs text-blue-600 dark:text-blue-400">AI suggested</span>
                          )}
                          {/* 5 Whys Drill-down Button */}
                          {!isValidated && cause.text && (
                            <button
                              onClick={() => analyzeCauseWithFiveWhys(cause, category.name)}
                              disabled={analyzingCause}
                              className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 flex items-center space-x-1"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>5 Whys</span>
                            </button>
                          )}
                          {/* Show if cause has been analyzed */}
                          {cause.fiveWhysAnalysis && (
                            <span className="text-xs text-green-600 dark:text-green-400 flex items-center space-x-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Analyzed</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {!isValidated && (
                        <button
                          onClick={() => removeCause(category.id, cause.id)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}

                  {category.causes.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                      No causes added yet
                    </p>
                  )}
                </div>

                {/* Add Cause Input */}
                {!isValidated && (
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newCauseInputs[category.id] || ''}
                        onChange={(e) =>
                          setNewCauseInputs((prev) => ({
                            ...prev,
                            [category.id]: e.target.value,
                          }))
                        }
                        onKeyPress={(e) => e.key === 'Enter' && addCause(category.id)}
                        placeholder="Add a cause..."
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        onClick={() => addCause(category.id)}
                        disabled={!newCauseInputs[category.id]?.trim()}
                        className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>

                    {/* AI Suggestions Button */}
                    <button
                      onClick={() => getAISuggestions(category.id, category.name)}
                      disabled={loadingAI === category.id}
                      className="w-full py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center justify-center space-x-1"
                    >
                      {loadingAI === category.id ? (
                        <>
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Getting suggestions...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <span>Get AI suggestions</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Diagram Tab Content */}
      {activeTab === 'diagram' && (
        <>
          {/* Professional Fishbone Diagram */}
          {totalCauses >= 1 ? (
            <div className="p-6 rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-lg">🐟</span>
                  Ishikawa (Fishbone) Diagram
                </h3>
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                  {totalCauses} cause{totalCauses !== 1 ? 's' : ''} identified
                </span>
              </div>
              
              {/* Fishbone SVG Diagram */}
              <div className="bg-slate-100 rounded-lg p-4 overflow-x-auto">
                {(() => {
                  const catsWithCauses = categories.filter(c => c.causes.length > 0);
                  const topCats = catsWithCauses.filter((_, i) => i % 2 === 0);
                  const botCats = catsWithCauses.filter((_, i) => i % 2 === 1);
                  const cols = Math.max(topCats.length, botCats.length, 1);
                  
                  // Dynamic dimensions based on content
                  const boxW = 290;
                  const gapX = 18;
                  const skewAmt = 28;
                  const arrowSize = 50, pad = 35;
                  const spineThickness = 4;
                  const headWidth = 110;
                  
                  // Calculate max causes in top and bottom rows
                  const maxTopCauses = Math.max(...topCats.map(c => c.causes.length), 1);
                  const maxBotCauses = Math.max(...botCats.map(c => c.causes.length), 1);
                  
                  // Calculate max text lines needed (estimate 50 chars per line for wrapping)
                  const getMaxLinesForCauses = (cats: typeof topCats) => {
                    return Math.max(...cats.map(cat => 
                      cat.causes.reduce((total, cause) => {
                        const estimatedLines = Math.ceil(cause.text.length / 40);
                        return total + Math.max(estimatedLines, 1);
                      }, 0)
                    ), 1);
                  };
                  
                  const maxTopLines = getMaxLinesForCauses(topCats);
                  const maxBotLines = getMaxLinesForCauses(botCats);
                  
                  // Dynamic box height: title + causes (with wrapping support) + padding
                  const causeLineHeight = 14;
                  const causeMargin = 4;
                  const titleHeight = 28;
                  const boxPadding = 20;
                  const topBoxH = titleHeight + (maxTopLines * causeLineHeight) + (maxTopCauses * causeMargin) + boxPadding;
                  const botBoxH = titleHeight + (maxBotLines * causeLineHeight) + (maxBotCauses * causeMargin) + boxPadding;
                  
                  const contentWidth = cols * boxW + (cols - 1) * gapX;
                  const svgW = arrowSize + pad + contentWidth + pad + headWidth + 20;
                  const svgH = topBoxH + botBoxH + spineThickness;
                  const spineY = topBoxH;
                  
                  // Colors
                  const palette = [
                    { bg: '#BBDEFB', border: '#1565C0', title: '#0D47A1', text: '#1A237E' },
                    { bg: '#F8BBD0', border: '#C2185B', title: '#880E4F', text: '#4A0E2A' },
                    { bg: '#B2DFDB', border: '#00897B', title: '#004D40', text: '#00352C' },
                  ];
                  
                  // Dynamic min/max height based on content
                  const minH = Math.max(350, svgH * 0.9);
                  const maxH = Math.max(700, svgH * 1.3);
                  
                  return (
                    <svg 
                      viewBox={`0 0 ${svgW} ${svgH}`} 
                      className="w-full" 
                      style={{ minHeight: minH, maxHeight: maxH }}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {/* Background */}
                      <rect width={svgW} height={svgH} fill="#F1F5F9" rx="6"/>
                      
                      {/* Left Arrow (Tail) */}
                      <path 
                        d={`M 5 ${spineY} L ${arrowSize} ${spineY - 22} L ${arrowSize} ${spineY + 22} Z`}
                        fill="#455A64"
                      />
                      
                      {/* Main Spine */}
                      <line 
                        x1={arrowSize} y1={spineY} 
                        x2={svgW - headWidth - 10} y2={spineY} 
                        stroke="#455A64" 
                        strokeWidth={spineThickness}
                      />
                      
                      {/* Fish Head - Double Triangle Design */}
                      <path 
                        d={`M ${svgW - headWidth - 10} ${spineY - 55} 
                            L ${svgW - 10} ${spineY} 
                            L ${svgW - headWidth - 10} ${spineY + 55} Z`}
                        fill="#455A64"
                      />
                      {/* Eye - white circle */}
                      <circle cx={svgW - 45} cy={spineY} r="9" fill="#fff"/>
                      
                      {/* TOP ROW - Categories above spine */}
                      {topCats.map((cat, idx) => {
                        const clr = palette[idx % palette.length];
                        const bx = arrowSize + pad + idx * (boxW + gapX);
                        const by = 0;
                        
                        // Parallelogram - bottom edge touches spine
                        const points = [
                          `${bx + skewAmt},${by}`,
                          `${bx + boxW - skewAmt},${by}`,
                          `${bx + boxW},${spineY}`,
                          `${bx},${spineY}`
                        ].join(' ');
                        
                        return (
                          <g key={cat.id}>
                            <polygon 
                              points={points} 
                              fill={clr.bg} 
                              stroke={clr.border} 
                              strokeWidth="1.5"
                            />
                            {/* Position content inside parallelogram: account for skew on both sides */}
                            <foreignObject x={bx + skewAmt + 8} y={by + 8} width={boxW - (skewAmt * 2) - 16} height={topBoxH - 16}>
                              <div style={{ fontFamily: 'Inter, system-ui, sans-serif', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ 
                                  fontWeight: 700, 
                                  fontSize: 11, 
                                  color: clr.title, 
                                  textAlign: 'center', 
                                  marginBottom: 8,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  lineHeight: 1.3
                                }}>
                                  {cat.name}
                                </div>
                                <div style={{ flex: 1, overflow: 'visible' }}>
                                  {cat.causes.map((cause) => (
                                    <div key={cause.id} style={{ 
                                      display: 'flex', 
                                      alignItems: 'flex-start', 
                                      fontSize: 9.5, 
                                      color: clr.text, 
                                      marginBottom: 4,
                                      lineHeight: 1.35,
                                      paddingLeft: 2,
                                      paddingRight: 2
                                    }}>
                                      <span style={{ marginRight: 5, flexShrink: 0, fontSize: 8, marginTop: 1 }}>•</span>
                                      <span style={{ wordBreak: 'break-word', overflowWrap: 'break-word', hyphens: 'auto', display: 'block' }}>
                                        {cause.text}
                                        {cause.fiveWhysAnalysis && <span style={{ color: '#2E7D32', marginLeft: 3, fontSize: 8 }}>✓</span>}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </foreignObject>
                          </g>
                        );
                      })}
                      
                      {/* BOTTOM ROW - Categories below spine */}
                      {botCats.map((cat, idx) => {
                        const clr = palette[(topCats.length + idx) % palette.length];
                        const bx = arrowSize + pad + idx * (boxW + gapX);
                        
                        // Parallelogram - top edge touches spine
                        const points = [
                          `${bx},${spineY}`,
                          `${bx + boxW},${spineY}`,
                          `${bx + boxW - skewAmt},${svgH}`,
                          `${bx + skewAmt},${svgH}`
                        ].join(' ');
                        
                        return (
                          <g key={cat.id}>
                            <polygon 
                              points={points} 
                              fill={clr.bg} 
                              stroke={clr.border} 
                              strokeWidth="1.5"
                            />
                            {/* Position content inside parallelogram: account for skew on both sides */}
                            <foreignObject x={bx + skewAmt + 8} y={spineY + 8} width={boxW - (skewAmt * 2) - 16} height={botBoxH - 16}>
                              <div style={{ fontFamily: 'Inter, system-ui, sans-serif', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ flex: 1, overflow: 'visible' }}>
                                  {cat.causes.map((cause) => (
                                    <div key={cause.id} style={{ 
                                      display: 'flex', 
                                      alignItems: 'flex-start', 
                                      fontSize: 9.5, 
                                      color: clr.text, 
                                      marginBottom: 4,
                                      lineHeight: 1.35,
                                      paddingLeft: 2,
                                      paddingRight: 2
                                    }}>
                                      <span style={{ marginRight: 5, flexShrink: 0, fontSize: 8, marginTop: 1 }}>•</span>
                                      <span style={{ wordBreak: 'break-word', overflowWrap: 'break-word', hyphens: 'auto', display: 'block' }}>
                                        {cause.text}
                                        {cause.fiveWhysAnalysis && <span style={{ color: '#2E7D32', marginLeft: 3, fontSize: 8 }}>✓</span>}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ 
                                  fontWeight: 700, 
                                  fontSize: 11, 
                                  color: clr.title, 
                                  textAlign: 'center', 
                                  marginTop: 6,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  lineHeight: 1.3
                                }}>
                                  {cat.name}
                                </div>
                              </div>
                            </foreignObject>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
              
              {/* Effect/Problem Statement */}
              <div className="mt-4 flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Effect (Problem Statement)</p>
                  <p className="text-sm text-gray-800 font-medium mt-0.5">{problem || 'Define your problem statement above'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-6xl mb-4 opacity-30">🐟</div>
              <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                No Causes Added Yet
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 max-w-md">
                Add causes to your categories in the "Cause Analysis" tab to see the Fishbone diagram visualization here.
              </p>
              <button
                onClick={() => setActiveTab('analysis')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Cause Analysis
              </button>
            </div>
          )}
        </>
      )}

      {/* Root Cause Summary Section - Collapsible blocks for each analyzed root cause */}
      {activeTab === 'analysis' && analyzedRootCausesForDisplay.length > 0 && (
        <div className="mt-8 border-2 border-green-300 dark:border-green-600 rounded-lg bg-green-50 dark:bg-green-900/20 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-green-100 dark:bg-green-800/30 border-b border-green-200 dark:border-green-700">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Analyzed Root Causes
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-200 dark:bg-green-700 text-green-700 dark:text-green-200">
                {analyzedRootCausesForDisplay.filter(rc => rc.isValidRootCause).length} confirmed / {analyzedRootCausesForDisplay.length} total
              </span>
            </div>
            <button
              onClick={toggleAllRootCauses}
              className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
            >
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${allRootCausesExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {allRootCausesExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>

          {/* Root Cause Blocks */}
          <div className="p-4 space-y-3">
            {/* Confirmed Root Causes */}
            {analyzedRootCausesForDisplay.filter(rc => rc.isValidRootCause).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Confirmed Root Causes
                </h4>
                {analyzedRootCausesForDisplay
                  .filter(rc => rc.isValidRootCause)
                  .map((rc, index) => (
                    <div 
                      key={rc.id}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700 overflow-hidden shadow-sm"
                    >
                      {/* Block Header - Clickable */}
                      <button
                        onClick={() => toggleRootCauseBlock(rc.id)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs font-semibold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              [{rc.category}]
                            </span>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {rc.rootCause}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300">
                            {rc.confidence}% confident
                          </span>
                          <svg 
                            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedRootCauses.has(rc.id) ? 'rotate-180' : ''}`}
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {expandedRootCauses.has(rc.id) && (
                        <div className="px-4 pb-4 border-t border-green-100 dark:border-green-800">
                          {/* Original Cause */}
                          <div className="mt-3">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Original Cause
                            </label>
                            <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm text-gray-700 dark:text-gray-300">
                              {rc.cause}
                            </div>
                          </div>

                          {/* Root Cause */}
                          <div className="mt-3">
                            <label className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">
                              Identified Root Cause
                            </label>
                            <div className="mt-1 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700 text-sm text-gray-900 dark:text-white font-medium">
                              {rc.rootCause}
                            </div>
                          </div>

                          {/* 5 Whys Steps */}
                          {rc.steps.length > 0 && (
                            <div className="mt-3">
                              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                5 Whys Analysis Steps
                              </label>
                              <div className="mt-2 space-y-3">
                                {rc.steps.map((step, stepIdx) => (
                                  <div key={stepIdx} className="border-l-2 border-green-200 dark:border-green-700 pl-3">
                                    <div className="flex items-start gap-2">
                                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 flex items-center justify-center font-medium text-xs">
                                        {step.stepNumber}
                                      </span>
                                      <div className="flex-1">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">{step.question}</p>
                                        <p className="text-sm text-gray-900 dark:text-white mt-1 font-medium">{step.answer}</p>
                                        {step.explanation && (
                                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                                            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              Why this matters:
                                            </p>
                                            <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">{step.explanation}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Contributing Factors (Not Root Causes) */}
            {analyzedRootCausesForDisplay.filter(rc => !rc.isValidRootCause).length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Contributing Factors (Analyzed but not root causes)
                </h4>
                {analyzedRootCausesForDisplay
                  .filter(rc => !rc.isValidRootCause)
                  .map((rc, index) => (
                    <div 
                      key={rc.id}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-700 overflow-hidden shadow-sm"
                    >
                      {/* Block Header - Clickable */}
                      <button
                        onClick={() => toggleRootCauseBlock(rc.id)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              [{rc.category}]
                            </span>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {rc.cause}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300">
                            Contributing factor
                          </span>
                          <svg 
                            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedRootCauses.has(rc.id) ? 'rotate-180' : ''}`}
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {expandedRootCauses.has(rc.id) && (
                        <div className="px-4 pb-4 border-t border-amber-100 dark:border-amber-800">
                          {/* Cause */}
                          <div className="mt-3">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Analyzed Cause
                            </label>
                            <div className="mt-1 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700 text-sm text-gray-900 dark:text-white">
                              {rc.cause}
                            </div>
                          </div>

                          {/* 5 Whys Steps */}
                          {rc.steps.length > 0 && (
                            <div className="mt-3">
                              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                5 Whys Analysis Steps
                              </label>
                              <div className="mt-2 space-y-3">
                                {rc.steps.map((step, stepIdx) => (
                                  <div key={stepIdx} className="border-l-2 border-amber-200 dark:border-amber-700 pl-3">
                                    <div className="flex items-start gap-2">
                                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 flex items-center justify-center font-medium text-xs">
                                        {step.stepNumber}
                                      </span>
                                      <div className="flex-1">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">{step.question}</p>
                                        <p className="text-sm text-gray-900 dark:text-white mt-1 font-medium">{step.answer}</p>
                                        {step.explanation && (
                                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                                            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              Why this matters:
                                            </p>
                                            <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">{step.explanation}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Note */}
                          <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-300">
                            <strong>Note:</strong> This cause was analyzed but determined not to be a root cause. It may be a contributing factor or symptom.
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Problem Statement Footer */}
          <div className="px-4 py-3 bg-green-100/50 dark:bg-green-800/20 border-t border-green-200 dark:border-green-700">
            <p className="text-xs text-green-700 dark:text-green-300">
              <strong>Problem:</strong> {problem}
            </p>
          </div>
        </div>
      )}

      {/* Corrective Actions Tab Content */}
      {activeTab === 'actions' && (
        <>
          {/* Corrective Actions Validation Section */}
      {correctiveActionsValidation && (
        <div className="mt-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-xl">🤖</span>
              AI Validation Results
            </h4>
            <button
              onClick={() => setCorrectiveActionsValidation(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className={`text-2xl font-bold ${correctiveActionsValidation.alignmentScore >= 70 ? 'text-green-600' : correctiveActionsValidation.alignmentScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {correctiveActionsValidation.alignmentScore}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Alignment</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className={`text-2xl font-bold ${correctiveActionsValidation.effectivenessScore >= 70 ? 'text-green-600' : correctiveActionsValidation.effectivenessScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {correctiveActionsValidation.effectivenessScore}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Effectiveness</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className={`text-2xl font-bold ${correctiveActionsValidation.feasibilityScore >= 70 ? 'text-green-600' : correctiveActionsValidation.feasibilityScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {correctiveActionsValidation.feasibilityScore}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Feasibility</div>
            </div>
          </div>

          {/* Overall Assessment */}
          <div className={`p-4 rounded-lg mb-4 ${correctiveActionsValidation.isValid ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'}`}>
            <div className="flex items-start gap-2">
              {correctiveActionsValidation.isValid ? (
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              <p className={`text-sm ${correctiveActionsValidation.isValid ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {correctiveActionsValidation.overallAssessment}
              </p>
            </div>
          </div>

          {/* Issues */}
          {correctiveActionsValidation.issues.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Issues Found:</h5>
              <div className="space-y-2">
                {correctiveActionsValidation.issues.map((issue, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg text-sm ${
                      issue.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700' :
                      issue.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' :
                      'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                    }`}
                  >
                    <p className={`font-medium ${
                      issue.severity === 'critical' ? 'text-red-700 dark:text-red-300' :
                      issue.severity === 'warning' ? 'text-amber-700 dark:text-amber-300' :
                      'text-blue-700 dark:text-blue-300'
                    }`}>
                      {issue.issue}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      💡 {issue.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {correctiveActionsValidation.recommendations.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recommendations:</h5>
              <ul className="space-y-1">
                {correctiveActionsValidation.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          {correctiveActionsValidation.refinedActions && (
            <div className="flex gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={applyRefinedActions}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg hover:from-violet-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Apply AI Refinements
              </button>
              <button
                onClick={() => setCorrectiveActionsValidation(null)}
                className="py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Keep Current
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Plans Section - Show always when there are actions (even when validated) */}
      {(showCorrectiveActionsSection || (actionPlans.immediate.length > 0 || actionPlans.shortTerm.length > 0 || actionPlans.longTerm.length > 0)) && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>📋</span>
              <span>Corrective Action Plans</span>
              {isValidated && (
                <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded-full">
                  Validated
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3">
              {/* AI Validate Button */}
              {!isValidated && (actionPlans.immediate.length > 0 || actionPlans.shortTerm.length > 0 || actionPlans.longTerm.length > 0) && (
                <button
                  onClick={validateCorrectiveActionsWithAI}
                  disabled={validatingCorrectiveActions}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm rounded-lg hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 transition-all"
                >
                  {validatingCorrectiveActions ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Validating...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>🤖 AI Validate</span>
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowActionPlans(!showActionPlans)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {showActionPlans ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {showActionPlans && (
            <div className="space-y-6">
              {/* Immediate Actions */}
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-red-700 dark:text-red-300 flex items-center space-x-2">
                    <span>🔴</span>
                    <span>Immediate Actions</span>
                  </h4>
                  {!isValidated && (
                    <button
                      onClick={() => addActionItem('immediate')}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Action</span>
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {actionPlans.immediate.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No immediate actions defined</p>
                  ) : (
                    actionPlans.immediate.map((item) => (
                      <div key={item.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-red-100 dark:border-red-800">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            {!isValidated ? (
                              <input
                                type="text"
                                value={item.action}
                                onChange={(e) => updateActionItem('immediate', item.id, 'action', e.target.value)}
                                className="w-full text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                                placeholder="Action description..."
                              />
                            ) : (
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.action}</p>
                            )}
                            <div className="flex items-center flex-wrap gap-2 text-xs">
                              {!isValidated ? (
                                <>
                                  <input
                                    type="text"
                                    value={item.owner}
                                    onChange={(e) => updateActionItem('immediate', item.id, 'owner', e.target.value)}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                    placeholder="Owner"
                                  />
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 dark:text-gray-400">Start:</span>
                                    <input
                                      type="date"
                                      value={item.startDate || ''}
                                      onChange={(e) => updateActionItem('immediate', item.id, 'startDate', e.target.value)}
                                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 dark:text-gray-400">End:</span>
                                    <input
                                      type="date"
                                      value={item.endDate || ''}
                                      onChange={(e) => updateActionItem('immediate', item.id, 'endDate', e.target.value)}
                                      className={`px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 ${getDateError(item) ? 'border border-red-500' : ''}`}
                                    />
                                  </div>
                                  {getDateError(item) && (
                                    <span className="text-red-500 font-medium">⚠️ {getDateError(item)}</span>
                                  )}
                                  <select
                                    value={item.priority}
                                    onChange={(e) => updateActionItem('immediate', item.id, 'priority', e.target.value as 'high' | 'medium' | 'low')}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                  >
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                  </select>
                                  <select
                                    value={item.status}
                                    onChange={(e) => updateActionItem('immediate', item.id, 'status', e.target.value as 'pending' | 'in-progress' | 'completed')}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                  </select>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-500 dark:text-gray-400">Owner: {item.owner}</span>
                                  <span className="text-gray-500 dark:text-gray-400">Start: {item.startDate || 'N/A'}</span>
                                  <span className="text-gray-500 dark:text-gray-400">End: {item.endDate || 'N/A'}</span>
                                  <span className={`px-2 py-0.5 rounded ${getPriorityColor(item.priority)}`}>{item.priority}</span>
                                  <span className={`px-2 py-0.5 rounded ${getStatusColor(item.status)}`}>{item.status}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {!isValidated && (
                            <button
                              onClick={() => removeActionItem('immediate', item.id)}
                              className="text-red-400 hover:text-red-600 ml-2"
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

              {/* Short-term Actions */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-amber-700 dark:text-amber-300 flex items-center space-x-2">
                    <span>🟡</span>
                    <span>Short-term Actions</span>
                  </h4>
                  {!isValidated && (
                    <button
                      onClick={() => addActionItem('shortTerm')}
                      className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Action</span>
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {actionPlans.shortTerm.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No short-term actions defined</p>
                  ) : (
                    actionPlans.shortTerm.map((item) => (
                      <div key={item.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-100 dark:border-amber-800">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            {!isValidated ? (
                              <input
                                type="text"
                                value={item.action}
                                onChange={(e) => updateActionItem('shortTerm', item.id, 'action', e.target.value)}
                                className="w-full text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                                placeholder="Action description..."
                              />
                            ) : (
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.action}</p>
                            )}
                            <div className="flex items-center flex-wrap gap-2 text-xs">
                              {!isValidated ? (
                                <>
                                  <input
                                    type="text"
                                    value={item.owner}
                                    onChange={(e) => updateActionItem('shortTerm', item.id, 'owner', e.target.value)}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                    placeholder="Owner"
                                  />
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 dark:text-gray-400">Start:</span>
                                    <input
                                      type="date"
                                      value={item.startDate || ''}
                                      onChange={(e) => updateActionItem('shortTerm', item.id, 'startDate', e.target.value)}
                                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 dark:text-gray-400">End:</span>
                                    <input
                                      type="date"
                                      value={item.endDate || ''}
                                      onChange={(e) => updateActionItem('shortTerm', item.id, 'endDate', e.target.value)}
                                      className={`px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 ${getDateError(item) ? 'border border-red-500' : ''}`}
                                    />
                                  </div>
                                  {getDateError(item) && (
                                    <span className="text-red-500 font-medium">⚠️ {getDateError(item)}</span>
                                  )}
                                  <select
                                    value={item.priority}
                                    onChange={(e) => updateActionItem('shortTerm', item.id, 'priority', e.target.value as 'high' | 'medium' | 'low')}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                  >
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                  </select>
                                  <select
                                    value={item.status}
                                    onChange={(e) => updateActionItem('shortTerm', item.id, 'status', e.target.value as 'pending' | 'in-progress' | 'completed')}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                  </select>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-500 dark:text-gray-400">Owner: {item.owner}</span>
                                  <span className="text-gray-500 dark:text-gray-400">Start: {item.startDate || 'N/A'}</span>
                                  <span className="text-gray-500 dark:text-gray-400">End: {item.endDate || 'N/A'}</span>
                                  <span className={`px-2 py-0.5 rounded ${getPriorityColor(item.priority)}`}>{item.priority}</span>
                                  <span className={`px-2 py-0.5 rounded ${getStatusColor(item.status)}`}>{item.status}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {!isValidated && (
                            <button
                              onClick={() => removeActionItem('shortTerm', item.id)}
                              className="text-amber-400 hover:text-amber-600 ml-2"
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

              {/* Long-term Actions */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-blue-700 dark:text-blue-300 flex items-center space-x-2">
                    <span>🔵</span>
                    <span>Long-term Actions</span>
                  </h4>
                  {!isValidated && (
                    <button
                      onClick={() => addActionItem('longTerm')}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Action</span>
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {actionPlans.longTerm.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No long-term actions defined</p>
                  ) : (
                    actionPlans.longTerm.map((item) => (
                      <div key={item.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-800">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            {!isValidated ? (
                              <input
                                type="text"
                                value={item.action}
                                onChange={(e) => updateActionItem('longTerm', item.id, 'action', e.target.value)}
                                className="w-full text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                                placeholder="Action description..."
                              />
                            ) : (
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.action}</p>
                            )}
                            <div className="flex items-center flex-wrap gap-2 text-xs">
                              {!isValidated ? (
                                <>
                                  <input
                                    type="text"
                                    value={item.owner}
                                    onChange={(e) => updateActionItem('longTerm', item.id, 'owner', e.target.value)}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                    placeholder="Owner"
                                  />
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 dark:text-gray-400">Start:</span>
                                    <input
                                      type="date"
                                      value={item.startDate || ''}
                                      onChange={(e) => updateActionItem('longTerm', item.id, 'startDate', e.target.value)}
                                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 dark:text-gray-400">End:</span>
                                    <input
                                      type="date"
                                      value={item.endDate || ''}
                                      onChange={(e) => updateActionItem('longTerm', item.id, 'endDate', e.target.value)}
                                      className={`px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 ${getDateError(item) ? 'border border-red-500' : ''}`}
                                    />
                                  </div>
                                  {getDateError(item) && (
                                    <span className="text-red-500 font-medium">⚠️ {getDateError(item)}</span>
                                  )}
                                  <select
                                    value={item.priority}
                                    onChange={(e) => updateActionItem('longTerm', item.id, 'priority', e.target.value as 'high' | 'medium' | 'low')}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                  >
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                  </select>
                                  <select
                                    value={item.status}
                                    onChange={(e) => updateActionItem('longTerm', item.id, 'status', e.target.value as 'pending' | 'in-progress' | 'completed')}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                  </select>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-500 dark:text-gray-400">Owner: {item.owner}</span>
                                  <span className="text-gray-500 dark:text-gray-400">Start: {item.startDate || 'N/A'}</span>
                                  <span className="text-gray-500 dark:text-gray-400">End: {item.endDate || 'N/A'}</span>
                                  <span className={`px-2 py-0.5 rounded ${getPriorityColor(item.priority)}`}>{item.priority}</span>
                                  <span className={`px-2 py-0.5 rounded ${getStatusColor(item.status)}`}>{item.status}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {!isValidated && (
                            <button
                              onClick={() => removeActionItem('longTerm', item.id)}
                              className="text-blue-400 hover:text-blue-600 ml-2"
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
          )}
        </div>
      )}

          {/* Empty State for Corrective Actions Tab */}
          {totalCauses === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-6xl mb-4 opacity-30">📋</div>
              <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                No Causes to Address Yet
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 max-w-md">
                Add causes in the "Cause Analysis" tab first, then complete their 5 Whys analysis to unlock corrective actions.
              </p>
              <button
                onClick={() => setActiveTab('analysis')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Cause Analysis
              </button>
            </div>
          )}
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
                  <button
                    onClick={addPreventiveControl}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Control
                  </button>
                )}
              </div>
            </div>

            {/* AI Generate Controls Info */}
            {preventiveControls.length === 0 && !isValidated && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-purple-800 dark:text-purple-200">Generate with AI</h4>
                    <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                      Go to the "Corrective Actions" tab and click "Generate with AI" to automatically create both corrective actions and preventive controls based on your analyzed root causes.
                    </p>
                    <button
                      onClick={() => setActiveTab('actions')}
                      className="mt-3 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Go to Corrective Actions
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preventive Controls List */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
                Preventive controls are systemic measures to prevent similar incidents from occurring in the future.
              </p>
              
              <div className="space-y-4">
                {preventiveControls.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">No preventive controls defined yet. Click "Add Control" or generate them with AI from the Corrective Actions tab.</p>
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
      {!isValidated ? (
        <div className="flex items-center justify-between mt-6">
          {/* Left side - All Causes Analyzed indicator with action buttons */}
          <div className="flex items-center gap-4">
            {allCausesAnalyzed() && (
              <>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg border border-emerald-300 dark:border-emerald-600">
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">All Causes Analyzed! 🎉</span>
                </div>
                {/* Create Manually Button */}
                <button
                  onClick={startManualCorrectiveActions}
                  disabled={generatingCorrectiveActions}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border-2 border-emerald-300 dark:border-emerald-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-all"
                >
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Create Manually</span>
                </button>
                {/* Generate with AI Button */}
                <button
                  onClick={generateAICorrectiveActions}
                  disabled={generatingCorrectiveActions}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 rounded-lg hover:shadow-lg transition-all"
                >
                  {generatingCorrectiveActions ? (
                    <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  <span className="text-sm font-medium text-white">Generate with AI</span>
                </button>
              </>
            )}
          </div>
          {/* Right side - Action buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
            {rootCauseText && totalCauses >= 3 && (
              <button
                onClick={() => {
                  setValidationStatement(rootCauseText);
                  setShowValidateModal(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Complete & Validate
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Re-open button for validated RCAs */
        onReopen && (
          <div className="flex justify-end space-x-4 mt-6">
            <div className="flex items-center gap-3 text-sm text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>This RCA has been validated and locked</span>
            </div>
            <button
              onClick={handleReopen}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              {saving ? 'Re-opening...' : 'Re-open for Editing'}
            </button>
          </div>
        )
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
