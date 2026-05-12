'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import LoadingState from '@/components/ui/LoadingState';
import { useWebSocket } from '@/lib/websocket';
import { ExternalLink, Loader2 } from 'lucide-react';

interface FishboneCause {
  id: string;
  text: string;
  evidence?: string[];
  aiSuggested?: boolean;
  likelihood?: 'high' | 'medium' | 'low';
  reasoning?: string;  // AI explanation for why this cause was identified
  resolutionValidation?: CauseResolutionSelection;
  fiveWhysAnalysis?: {
    steps: Array<{ stepNumber: number; question: string; answer: string; explanation?: string }>;
    rootCause: string;
    isValidRootCause: boolean;
    confidence: number;
  };
}

interface CauseResolutionSelection {
  causeId: string;
  categoryName: string;
  causeText: string;
  rootCause: string;
  classification: 'likely' | 'unlikely';
  confidence: number;
  reason: string;
  implementationImpact: string;
  linkedCauseIds?: string[];
  source?: 'ai' | 'manual';
}

interface CauseResolutionValidationResult {
  overallDecision: string;
  problemResolutionSummary: string;
  recommendedCombination: string;
  selections: CauseResolutionSelection[];
  likelyCauseIds: string[];
  unlikelyCauseIds: string[];
  limitations: string[];
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

interface ManualStepValidationResult {
  rating: 'ACCEPTED' | 'SHALLOW';
  score: number;
  feedback: string;
  suggestedAnswer?: string | null;
  reasoning?: string;
  suggestionDismissed?: boolean;
  feedbackDismissed?: boolean;
}

type FishboneBuilderTab = 'analysis' | 'diagram' | 'actions' | 'controls';
type RCAMethod = 'FIVE_WHYS' | 'FISHBONE';

interface FishboneBuilderProps {
  rcaId: string;
  incidentId: string;
  data: FishboneData;
  isValidated: boolean;
  currentUserId?: string;
  activeTab?: FishboneBuilderTab;
  onTabChange?: (tab: FishboneBuilderTab) => void;
  hideInternalTabs?: boolean;
  sectionTitle?: string;
  onSave: (data: FishboneData) => Promise<void>;
  onOpenWhiteboard?: (data: FishboneData) => Promise<void>;
  currentMethod?: RCAMethod;
  savingMethod?: boolean;
  autoSaveEnabled?: boolean;
  saveRequestToken?: number;
  showLocalSaveControls?: boolean;
  onChangeMethod?: (method: RCAMethod) => void;
  onValidate: (rootCauseStatement: string) => Promise<void>;
  onReopen?: () => Promise<void>;
}

type AIWorkflowStep = 'idle' | 'validating_problem' | 'problem_feedback' | 'generating' | 'analyzing_causes' | 'complete';

export default function FishboneBuilder({
  rcaId,
  incidentId,
  data,
  isValidated,
  currentUserId,
  activeTab: controlledActiveTab,
  onTabChange,
  hideInternalTabs = false,
  sectionTitle = 'Fishbone Diagram (Ishikawa)',
  onSave,
  onOpenWhiteboard,
  currentMethod = 'FISHBONE',
  savingMethod = false,
  autoSaveEnabled = false,
  saveRequestToken = 0,
  showLocalSaveControls = true,
  onChangeMethod,
  onValidate,
  onReopen,
}: FishboneBuilderProps) {
  const { showToast } = useToast();
  const { 
    onRCAAISuggestionsStarted, 
    onRCAAISuggestionsReceived, 
    onRCAAIValidationStarted, 
    onRCAAIValidationComplete,
    onRCAClarificationAnswer,
    onRCAProblemUpdate,
    onRCACategoriesUpdated,
    onRCACorrectiveActionsUpdated,
    onRCACauseInputTyping,
    onRCAFiveWhysModalOpened,
    onRCAFiveWhysModalClosed,
    onRCAFiveWhysModeChanged,
    onRCAFiveWhysFieldTyping,
    onRCAFiveWhysFieldUpdate,
    onRCAFiveWhysStatusChanged,
    onRCAFiveWhysAIAnalyzing,
    onRCAFiveWhysAIResult,
    onRCAFiveWhysAIEditMode,
    onRCAFiveWhysAIEditTyping,
    onRCAFiveWhysAIEditUpdate,
    onRCAFiveWhysManualValidating,
    onRCAFiveWhysManualValidationResult,
    onRCAFiveWhysManualCorrectionApplied,
    emitRCAClarificationAnswer,
    emitRCAProblemUpdate,
    emitRCACategoriesUpdated,
    emitRCACorrectiveActionsUpdated,
    emitRCACauseInputTyping,
    emitRCAFiveWhysModalOpened,
    emitRCAFiveWhysModalClosed,
    emitRCAFiveWhysModeChanged,
    emitRCAFiveWhysFieldTyping,
    emitRCAFiveWhysFieldUpdate,
    emitRCAFiveWhysStatusChanged,
    emitRCAFiveWhysAIAnalyzing,
    emitRCAFiveWhysAIResult,
    emitRCAFiveWhysAIEditMode,
    emitRCAFiveWhysAIEditTyping,
    emitRCAFiveWhysAIEditUpdate,
    emitRCAFiveWhysManualValidating,
    emitRCAFiveWhysManualValidationResult,
    emitRCAFiveWhysManualCorrectionApplied,
    onRCAFiveWhysAIEditValidating,
    onRCAFiveWhysAIEditValidationResult,
    emitRCAFiveWhysAIEditValidating,
    emitRCAFiveWhysAIEditValidationResult,
    onRCAFiveWhysAIEditFixApplied,
    emitRCAFiveWhysAIEditFixApplied,
    onRCAFiveWhysCauseRecommendation,
    emitRCAFiveWhysCauseRecommendation,
  } = useWebSocket();
  const [problem, setProblem] = useState(data.problem || '');
  const [categories, setCategories] = useState<FishboneCategory[]>(data.categories || []);
  const [rootCauseText, setRootCauseText] = useState(data.rootCauseText || '');
  const [saving, setSaving] = useState(false);
  const [, setLoadingAI] = useState<string | null>(null);
  const [generatingFullAnalysis, setGeneratingFullAnalysis] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validationStatement, setValidationStatement] = useState(rootCauseText);
  const [newCauseInputs, setNewCauseInputs] = useState<Record<string, string>>({});
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const manualSaveRequestRef = useRef(saveRequestToken);
  const analysisAutoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analysisAutoSaveReadyRef = useRef(false);
  
  // Remote typing indicators for "Add a cause" inputs
  const [remoteTypingIndicators, setRemoteTypingIndicators] = useState<Record<string, { userName: string; text: string; timestamp: string }>>({});
  
  // Track who started the AI analysis (for collaborative display)
  const [aiAnalysisStartedBy, setAiAnalysisStartedBy] = useState<{ id: string; firstName: string; lastName: string } | null>(null);
  
  // Track who opened the 5 Whys modal (for collaborative display)
  const [fiveWhysModalOpenedBy, setFiveWhysModalOpenedBy] = useState<{ id: string; firstName: string; lastName: string } | null>(null);
  
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
  const [isSavingFiveWhys, setIsSavingFiveWhys] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [editValidationFeedback, setEditValidationFeedback] = useState<{
    isValid: boolean;
    issues: Array<{ stepNumber: number; issue: string; suggestion: string }>;
    overallFeedback: string;
    resolvesOriginalProblem: boolean;
    suggestedRootCause?: string;
  } | null>(null);
  
  // 5 Whys Analysis Mode State
  const [fiveWhysMode, setFiveWhysMode] = useState<'choose' | 'manual' | 'ai'>('manual');
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
  const [manualStepValidations, setManualStepValidations] = useState<Record<number, ManualStepValidationResult>>({});
  const [validatingManualStep, setValidatingManualStep] = useState<number | null>(null);
  
  // 5 Whys field typing indicators (who is typing on which field)
  const [fiveWhysTypingIndicators, setFiveWhysTypingIndicators] = useState<Record<string, { userName: string; userId: string; timestamp: string }>>({});
  
  // Track which causes have 5 Whys analyses with answers (for color coding)
  // Key: causeId, Value: { hasAnswers: boolean, answerCount: number }
  const [causeAnalysisStatuses, setCauseAnalysisStatuses] = useState<Record<string, { hasAnswers: boolean; answerCount: number }>>({});
  const [validatingCauseResolution, setValidatingCauseResolution] = useState(false);
  const [causeResolutionValidation, setCauseResolutionValidation] = useState<CauseResolutionValidationResult | null>(null);
  const [showCauseResolutionResultModal, setShowCauseResolutionResultModal] = useState(false);
  const [manualCauseResolutionDrafts, setManualCauseResolutionDrafts] = useState<Record<string, {
    classification: 'likely' | 'unlikely';
    reason: string;
  }>>({});
  const [savingManualCauseResolution, setSavingManualCauseResolution] = useState<string | null>(null);
  const [pendingMethodChange, setPendingMethodChange] = useState<RCAMethod | null>(null);
  
  // Currently loaded database analysis for the open 5 Whys modal
  const [currentDbAnalysis, setCurrentDbAnalysis] = useState<{
    id: string;
    causeId: string;
    steps: Array<{ id: string; stepNumber: number; question: string; answer: string | null }>;
    analysisMethod?: string | null;
  } | null>(null);
  
  // Track the analysis method used (manual or ai) - stored in database
  const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<'manual' | 'ai' | null>(null);
  const fiveWhysModalRef = useRef<HTMLDivElement | null>(null);
  const fiveWhysModalDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);
  const [fiveWhysModalPosition, setFiveWhysModalPosition] = useState({ left: 0, top: 0 });
  const [isFiveWhysModalReady, setIsFiveWhysModalReady] = useState(false);
  const [isFiveWhysModalDragging, setIsFiveWhysModalDragging] = useState(false);
  const causeResolutionModalRef = useRef<HTMLDivElement | null>(null);
  const causeResolutionModalDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);
  const [causeResolutionModalPosition, setCauseResolutionModalPosition] = useState({ left: 0, top: 0 });
  const [isCauseResolutionModalReady, setIsCauseResolutionModalReady] = useState(false);
  const [isCauseResolutionModalDragging, setIsCauseResolutionModalDragging] = useState(false);

  useEffect(() => {
    if (!selectedCauseForAnalysis) return;

    const centerFiveWhysModal = () => {
      const rect = fiveWhysModalRef.current?.getBoundingClientRect();
      const width = rect?.width || Math.min(960, window.innerWidth - 24);
      const height = rect?.height || Math.min(720, window.innerHeight - 24);

      setFiveWhysModalPosition({
        left: Math.max(12, (window.innerWidth - width) / 2),
        top: Math.max(12, (window.innerHeight - height) / 2),
      });
      setIsFiveWhysModalReady(true);
    };

    setIsFiveWhysModalReady(false);
    requestAnimationFrame(centerFiveWhysModal);
    window.addEventListener('resize', centerFiveWhysModal);

    return () => {
      window.removeEventListener('resize', centerFiveWhysModal);
      fiveWhysModalDragRef.current = null;
      setIsFiveWhysModalDragging(false);
    };
  }, [selectedCauseForAnalysis]);

  const clampFiveWhysModalPosition = useCallback((left: number, top: number) => {
    const rect = fiveWhysModalRef.current?.getBoundingClientRect();
    const width = rect?.width || 0;
    const height = rect?.height || 0;
    const margin = 12;

    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin)),
      top: Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - height - margin)),
    };
  }, []);

  const handleFiveWhysModalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isFiveWhysModalReady || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, textarea, select, a')) return;

    fiveWhysModalDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: fiveWhysModalPosition.left,
      originTop: fiveWhysModalPosition.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsFiveWhysModalDragging(true);
  };

  const handleFiveWhysModalPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = fiveWhysModalDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const nextLeft = dragState.originLeft + event.clientX - dragState.startX;
    const nextTop = dragState.originTop + event.clientY - dragState.startY;
    setFiveWhysModalPosition(clampFiveWhysModalPosition(nextLeft, nextTop));
  };

  const handleFiveWhysModalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = fiveWhysModalDragRef.current;
    if (dragState?.pointerId === event.pointerId) {
      fiveWhysModalDragRef.current = null;
      setIsFiveWhysModalDragging(false);
    }
  };

  useEffect(() => {
    if (!validatingCauseResolution && !showCauseResolutionResultModal) return;

    const centerCauseResolutionModal = () => {
      const rect = causeResolutionModalRef.current?.getBoundingClientRect();
      const width = rect?.width || Math.min(720, window.innerWidth - 24);
      const height = rect?.height || Math.min(620, window.innerHeight - 24);

      setCauseResolutionModalPosition({
        left: Math.max(12, (window.innerWidth - width) / 2),
        top: Math.max(12, (window.innerHeight - height) / 2),
      });
      setIsCauseResolutionModalReady(true);
    };

    setIsCauseResolutionModalReady(false);
    requestAnimationFrame(centerCauseResolutionModal);
    window.addEventListener('resize', centerCauseResolutionModal);

    return () => {
      window.removeEventListener('resize', centerCauseResolutionModal);
      causeResolutionModalDragRef.current = null;
      setIsCauseResolutionModalDragging(false);
    };
  }, [validatingCauseResolution, showCauseResolutionResultModal]);

  const clampCauseResolutionModalPosition = useCallback((left: number, top: number) => {
    const rect = causeResolutionModalRef.current?.getBoundingClientRect();
    const width = rect?.width || 0;
    const height = rect?.height || 0;
    const margin = 12;

    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin)),
      top: Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - height - margin)),
    };
  }, []);

  const handleCauseResolutionModalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isCauseResolutionModalReady || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, textarea, select, a')) return;

    causeResolutionModalDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: causeResolutionModalPosition.left,
      originTop: causeResolutionModalPosition.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsCauseResolutionModalDragging(true);
  };

  const handleCauseResolutionModalPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = causeResolutionModalDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const nextLeft = dragState.originLeft + event.clientX - dragState.startX;
    const nextTop = dragState.originTop + event.clientY - dragState.startY;
    setCauseResolutionModalPosition(clampCauseResolutionModalPosition(nextLeft, nextTop));
  };

  const handleCauseResolutionModalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = causeResolutionModalDragRef.current;
    if (dragState?.pointerId === event.pointerId) {
      causeResolutionModalDragRef.current = null;
      setIsCauseResolutionModalDragging(false);
    }
  };
  
  // Auto-save toast notification state
  const [autoSaveToast, setAutoSaveToast] = useState<{show: boolean; message: string}>({show: false, message: ''});
  const autoSaveToastTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Refs for debouncing field updates and typing indicators
  const fiveWhysFieldUpdateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const fiveWhysTypingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  // Debounce timer for saving to database
  const dbSaveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  
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
  const [internalActiveTab, setInternalActiveTab] = useState<FishboneBuilderTab>('analysis');
  const activeTab = controlledActiveTab || internalActiveTab;
  const setActiveTab = onTabChange || setInternalActiveTab;
  const [openingWhiteboard, setOpeningWhiteboard] = useState(false);
  
  // AI Session State - For auto-save and recovery
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSavingRef = useRef(false);
  
  // Confirmation Dialog State - For suggested problem override warning
  const [showProblemOverrideConfirm, setShowProblemOverrideConfirm] = useState(false);
  
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

  // Auto-save AI Session function
  const saveAISession = useCallback(async (force = false) => {
    // Don't save if already saving or if the panel isn't open
    if (isAutoSavingRef.current && !force) return;
    if (aiWorkflowStep === 'idle' && !showAIPanel && !problemValidation && !aiAnalysis) return;
    
    isAutoSavingRef.current = true;
    
    try {
      await api.post(`/rca/${rcaId}/ai-fishbone-session`, {
        workflowStep: aiWorkflowStep,
        problemValidation,
        clarificationAnswers,
        aiAnalysisResult: aiAnalysis
      });
    } catch (error) {
      console.error('Failed to auto-save AI session:', error);
    } finally {
      isAutoSavingRef.current = false;
    }
  }, [rcaId, aiWorkflowStep, problemValidation, clarificationAnswers, aiAnalysis, showAIPanel]);

  // Debounced auto-save - triggers 2 seconds after last change
  const debouncedAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveAISession();
    }, 2000);
  }, [saveAISession]);

  // Auto-save when key states change
  useEffect(() => {
    if (sessionLoaded && showAIPanel) {
      debouncedAutoSave();
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [aiWorkflowStep, problemValidation, clarificationAnswers, aiAnalysis, sessionLoaded, showAIPanel, debouncedAutoSave]);

  // Load saved AI session on mount
  useEffect(() => {
    const loadSavedSession = async () => {
      try {
        const response = await api.get(`/rca/${rcaId}/ai-fishbone-session`);
        if (response.data.success && response.data.data) {
          const session = response.data.data;
          
          // Restore the AI workflow state
          const workflowStepMap: Record<string, AIWorkflowStep> = {
            'IDLE': 'idle',
            'VALIDATING_PROBLEM': 'validating_problem',
            'PROBLEM_FEEDBACK': 'problem_feedback',
            'GENERATING': 'generating',
            'ANALYZING_CAUSES': 'analyzing_causes',
            'COMPLETE': 'complete'
          };
          
          const mappedStep = workflowStepMap[session.workflowStep] || 'idle';
          setAiWorkflowStep(mappedStep);
          
          if (session.problemValidation) {
            setProblemValidation(session.problemValidation);
          }
          
          if (session.clarificationAnswers && session.clarificationAnswers.length > 0) {
            setClarificationAnswers(session.clarificationAnswers);
          }
          
          if (session.aiAnalysisResult) {
            setAiAnalysis(session.aiAnalysisResult);
            setShowAIPanel(true);
          }
          
          // Set who started the session
          if (session.startedByFirstName) {
            setAiAnalysisStartedBy({
              id: session.startedById || '',
              firstName: session.startedByFirstName,
              lastName: session.startedByLastName || ''
            });
          }
          
          // If there's a saved session with meaningful state, show the AI panel
          if (mappedStep !== 'idle' || session.aiAnalysisResult || session.problemValidation) {
            setShowAIPanel(true);
          }
          
          showToast('Restored previous AI analysis session', 'info');
        }
      } catch (error) {
        console.error('Failed to load AI session:', error);
      } finally {
        setSessionLoading(false);
        setSessionLoaded(true);
      }
    };
    
    loadSavedSession();
  }, [rcaId, showToast]);

  // Load persisted 5 Whys modal state on mount
  useEffect(() => {
    const loadModalState = async () => {
      try {
        const response = await api.get(`/rca/${rcaId}`);
        if (response.data.success && response.data.data?.fiveWhysModalState) {
          const modalState = response.data.data.fiveWhysModalState;
          
          if (modalState.isOpen && modalState.causeId && modalState.causeText && modalState.categoryName) {
            // Find the cause in the current categories
            const cause: FishboneCause = {
              id: modalState.causeId,
              text: modalState.causeText,
            };
            
            // Set who opened the modal
            if (modalState.openedBy) {
              setFiveWhysModalOpenedBy({
                id: modalState.openedBy.id || '',
                firstName: modalState.openedBy.firstName || '',
                lastName: modalState.openedBy.lastName || '',
              });
            }
            
            // Open the modal with correct structure
            setSelectedCauseForAnalysis({ 
              id: cause.id, 
              text: cause.text, 
              categoryName: modalState.categoryName 
            });
            
            showToast(
              `5 Whys modal restored (opened by ${modalState.openedBy?.firstName || 'a team member'})`,
              'info'
            );
          }
        }
      } catch (error) {
        console.error('Failed to load 5 Whys modal state:', error);
      }
    };
    
    loadModalState();
  }, [rcaId, showToast]);

  // Load 5 Whys analysis statuses for all causes (for color coding)
  useEffect(() => {
    const loadAnalysisStatuses = async () => {
      try {
        const response = await api.get(`/rca/${rcaId}/five-whys-analyses`);
        if (response.data.success && response.data.analyses) {
          const statuses: Record<string, { hasAnswers: boolean; answerCount: number }> = {};
          response.data.analyses.forEach((analysis: { causeId: string; hasAnswers: boolean; answerCount: number }) => {
            statuses[analysis.causeId] = {
              hasAnswers: analysis.hasAnswers,
              answerCount: analysis.answerCount
            };
          });
          setCauseAnalysisStatuses(statuses);
          console.log('📊 Loaded 5 Whys analysis statuses:', statuses);
        }
      } catch (error) {
        console.error('Failed to load 5 Whys analysis statuses:', error);
      }
    };
    
    loadAnalysisStatuses();
  }, [rcaId]);

  // Clear AI session when analysis is applied or cancelled
  const clearAISession = useCallback(async () => {
    try {
      await api.delete(`/rca/${rcaId}/ai-fishbone-session`);
    } catch (error) {
      console.error('Failed to clear AI session:', error);
    }
  }, [rcaId]);

  // Debounced problem statement broadcast ref
  const problemBroadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle problem statement change with real-time broadcast and auto-save
  const handleProblemChange = useCallback((newProblem: string) => {
    // Update local state immediately
    setProblem(newProblem);
    
    // Debounce the broadcast (300ms delay for smoother typing experience)
    if (problemBroadcastTimeoutRef.current) {
      clearTimeout(problemBroadcastTimeoutRef.current);
    }
    
    problemBroadcastTimeoutRef.current = setTimeout(() => {
      // Broadcast to other team members
      emitRCAProblemUpdate(incidentId, rcaId, newProblem);
    }, 300);
  }, [incidentId, rcaId, emitRCAProblemUpdate]);
  
  // Cleanup problem broadcast timeout on unmount
  useEffect(() => {
    return () => {
      if (problemBroadcastTimeoutRef.current) {
        clearTimeout(problemBroadcastTimeoutRef.current);
      }
    };
  }, []);

  // WebSocket listeners for collaborative AI analysis
  useEffect(() => {
    // Listen for when another team member starts AI analysis
    const unsubSuggestionsStarted = onRCAAISuggestionsStarted((data) => {
      if (data.rcaId === rcaId) {
        // Another user started AI analysis - show the panel and loading state
        setShowAIPanel(true);
        setGeneratingFullAnalysis(true);
        setAiWorkflowStep('generating');
        setAiAnalysisStartedBy(data.startedBy);
        showToast(`${data.startedBy.firstName} ${data.startedBy.lastName} started AI analysis`, 'info');
      }
    });

    // Listen for when AI suggestions are received
    const unsubSuggestionsReceived = onRCAAISuggestionsReceived((data) => {
      if (data.rcaId === rcaId) {
        // Receive AI suggestions from another user's request
        setAiAnalysis(data.analysis);
        setAiWorkflowStep('complete');
        setGeneratingFullAnalysis(false);
        setAiAnalysisStartedBy(data.generatedBy);
        showToast(`AI analysis complete - generated by ${data.generatedBy.firstName} ${data.generatedBy.lastName}`, 'success');
      }
    });

    // Listen for when problem validation starts
    const unsubValidationStarted = onRCAAIValidationStarted((data) => {
      if (data.rcaId === rcaId) {
        // Another user started problem validation
        setShowAIPanel(true);
        setAiWorkflowStep('validating_problem');
        setAiAnalysisStartedBy(data.startedBy);
        showToast(`${data.startedBy.firstName} ${data.startedBy.lastName} is validating the problem statement`, 'info');
      }
    });

    // Listen for when problem validation is complete
    const unsubValidationComplete = onRCAAIValidationComplete((data) => {
      if (data.rcaId === rcaId) {
        // Receive validation result
        setProblemValidation(data.validation);
        if (data.validation.canProceed && !data.validation.needsClarification) {
          setAiWorkflowStep('generating');
        } else {
          setAiWorkflowStep('problem_feedback');
          // Initialize clarification answers array if needed
          if (data.validation.clarificationQuestions) {
            setClarificationAnswers(new Array(data.validation.clarificationQuestions.length).fill(''));
          }
        }
      }
    });

    // Listen for clarification answer updates from other team members
    const unsubClarificationAnswer = onRCAClarificationAnswer((data) => {
      if (data.rcaId === rcaId) {
        // Another user updated a clarification answer - update our local state
        setClarificationAnswers((prev) => {
          const updated = [...prev];
          updated[data.questionIndex] = data.answer;
          return updated;
        });
      }
    });

    // Listen for problem statement updates from other team members
    const unsubProblemUpdate = onRCAProblemUpdate((data) => {
      if (data.rcaId === rcaId) {
        // Another user updated the problem statement
        setProblem(data.problem);
      }
    });

    // Listen for categories updates from other team members (fishbone diagram sync)
    const unsubCategoriesUpdated = onRCACategoriesUpdated((data) => {
      if (data.rcaId === rcaId) {
        console.log('📊 Received categories update from:', data.userName);
        // Another user applied AI analysis or updated categories - update our local state
        setCategories(data.categories);
        setProblem(data.problem);
        // Close the AI panel for all team members when analysis is applied
        setShowAIPanel(false);
        setAiWorkflowStep('idle');
        setProblemValidation(null);
        setClarificationAnswers([]);
        setAiAnalysis(null);
        showToast(`${data.userName} applied Fishbone analysis`, 'success');
      }
    });

    // Listen for corrective actions updates from other team members
    const unsubCorrectiveActionsUpdated = onRCACorrectiveActionsUpdated((data) => {
      if (data.rcaId === rcaId) {
        console.log('🛠️ Received corrective actions update from:', data.userName);
        // Another user generated/updated corrective actions - update our local state
        setActionPlans(data.actionPlans);
        if (data.preventiveControls && data.preventiveControls.length > 0) {
          setPreventiveControls(data.preventiveControls);
          setShowPreventiveControls(true);
        }
        setShowActionPlans(true);
        setShowCorrectiveActionsSection(true);
        showToast(`${data.userName} generated Corrective Actions & Preventive Controls`, 'success');
      }
    });

    // Listen for cause input typing from other team members
    const unsubCauseInputTyping = onRCACauseInputTyping((data) => {
      if (data.rcaId === rcaId) {
        // Show remote typing indicator for this category
        setRemoteTypingIndicators(prev => ({
          ...prev,
          [data.categoryId]: {
            userName: data.userName,
            text: data.text,
            timestamp: data.timestamp,
          }
        }));
        
        // Clear the indicator after 3 seconds of no activity
        setTimeout(() => {
          setRemoteTypingIndicators(prev => {
            const current = prev[data.categoryId];
            // Only clear if this is the same update (based on timestamp)
            if (current && current.timestamp === data.timestamp) {
              const { [data.categoryId]: _, ...rest } = prev;
              return rest;
            }
            return prev;
          });
        }, 3000);
      }
    });

    // Listen for 5 Whys modal opened by other team members
    const unsubFiveWhysModalOpened = onRCAFiveWhysModalOpened((data) => {
      // Only process if opened by another user, not the current user
      if (data.rcaId === rcaId && data.openedBy.id !== currentUserId) {
        console.log('🔍 5 Whys modal opened by:', data.openedBy, 'mode:', data.mode, 'hasAnswers:', data.hasAnswers, 'rootCause:', data.rootCause);
        // Open the modal for this user as well with the same state
        setSelectedCauseForAnalysis({ 
          id: data.causeId, 
          text: data.causeText, 
          categoryName: data.categoryName 
        });
        
        // Open directly in the analysis form. Older "choose" broadcasts are mapped to manual.
        setFiveWhysMode(data.mode === 'ai' ? 'ai' : 'manual');
        setCauseAnalysisResult(null);
        
        // Use the broadcasted steps data if available, otherwise use defaults
        if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
          setManualFiveWhysSteps(data.steps);
        } else {
          setManualFiveWhysSteps([
            { stepNumber: 1, question: `Why did "${data.causeText}" happen?`, answer: '' },
            { stepNumber: 2, question: 'Why?', answer: '' },
            { stepNumber: 3, question: 'Why?', answer: '' },
            { stepNumber: 4, question: 'Why?', answer: '' },
            { stepNumber: 5, question: 'Why?', answer: '' },
          ]);
        }
        
        // Update the cause analysis status for color coding
        if (data.hasAnswers !== undefined) {
          const hasAnswers = data.hasAnswers;
          setCauseAnalysisStatuses(prev => ({
            ...prev,
            [data.causeId]: {
              hasAnswers,
              answerCount: data.answerCount || 0
            }
          }));
        }
        
        // Set the root cause from broadcast if available
        setManualRootCause(data.rootCause || '');
        setManualAnalysisValidation(null);
        setFiveWhysModalOpenedBy(data.openedBy);
        showToast(`${data.openedBy.firstName} ${data.openedBy.lastName} opened 5 Whys Analysis`, 'info');
      }
    });

    // Listen for 5 Whys modal closed by other team members
    const unsubFiveWhysModalClosed = onRCAFiveWhysModalClosed((data) => {
      if (data.rcaId === rcaId) {
        console.log('🔍 5 Whys modal closed by:', data.closedBy);
        // Close the modal for this user as well
        setSelectedCauseForAnalysis(null);
        setCauseAnalysisResult(null);
        setFiveWhysMode('manual');
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
        setManualStepValidations({});
        setValidatingManualStep(null);
        setFiveWhysModalOpenedBy(null);
        // Only show toast if closed by another user, not self
        if (data.closedBy.id !== currentUserId) {
          showToast(`${data.closedBy.firstName} ${data.closedBy.lastName} closed the 5 Whys Analysis`, 'info');
        }
      }
    });

    // Listen for 5 Whys mode changed by other team members
    const unsubFiveWhysModeChanged = onRCAFiveWhysModeChanged((data) => {
      if (data.rcaId === rcaId) {
        console.log('🔍 5 Whys mode changed by:', data.changedBy, 'to:', data.mode, 'hasResetData:', !!data.resetData);
        // Update the mode for this user as well; old chooser modes now open manual analysis.
        const newMode = data.mode === 'ai' ? 'ai' : 'manual';
        setFiveWhysMode(newMode);
        
        // If resetData is provided (Start Fresh scenario), apply the cleared steps
        if (data.resetData && data.changedBy.id !== currentUserId) {
          const resetData = data.resetData;
          // Update the steps to the cleared state
          setManualFiveWhysSteps(resetData.steps);
          // Update the cause analysis status for color coding using causeId from resetData
          setCauseAnalysisStatuses(prev => ({
            ...prev,
            [resetData.causeId]: {
              hasAnswers: resetData.hasAnswers,
              answerCount: resetData.answerCount
            }
          }));
          // Clear root cause and validation state
          setManualRootCause('');
          setManualAnalysisValidation(null);
          setManualStepValidations({});
          setValidatingManualStep(null);
        }
        
        // Only show toast if changed by another user, not self
        if (data.changedBy.id !== currentUserId) {
          const modeLabel = data.mode === 'manual' ? 'Manual Analysis' 
            : data.mode === 'ai' ? 'AI Analysis' 
            : data.resetData ? 'Start Fresh' : 'options';
          showToast(`${data.changedBy.firstName} ${data.changedBy.lastName} selected ${modeLabel}`, 'info');
        }
      }
    });

    // Listen for 5 Whys field typing indicators from other team members
    const unsubFiveWhysFieldTyping = onRCAFiveWhysFieldTyping((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys field typing:', data);
        const fieldKey = data.fieldType === 'rootCause' ? 'rootCause' : `why-${data.stepNumber}`;
        
        if (data.isTyping) {
          // Add typing indicator
          setFiveWhysTypingIndicators(prev => ({
            ...prev,
            [fieldKey]: {
              userName: data.userName,
              userId: data.userId,
              timestamp: data.timestamp,
            }
          }));
        } else {
          // Remove typing indicator
          setFiveWhysTypingIndicators(prev => {
            const updated = { ...prev };
            delete updated[fieldKey];
            return updated;
          });
        }
      }
    });

    // Listen for 5 Whys field content updates from other team members
    const unsubFiveWhysFieldUpdate = onRCAFiveWhysFieldUpdate((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys field update received:', data);
        
        if (data.fieldType === 'rootCause') {
          // Update root cause text
          setManualRootCause(data.text);
        } else if (data.fieldType === 'why' && data.stepNumber) {
          const stepNumber = data.stepNumber;
          setManualStepValidations(prev => {
            const next = { ...prev };
            for (let index = stepNumber; index <= 5; index += 1) {
              delete next[index];
            }
            return next;
          });
          // Update the specific Why step AND the next step's question
          setManualFiveWhysSteps(steps => {
            const updatedSteps = steps.map(step =>
              step.stepNumber === stepNumber ? { ...step, answer: data.text } : step
            );
            
            // Also update the next step's question if included in the broadcast
            if (data.nextQuestion && stepNumber < 5) {
              const nextStepIndex = updatedSteps.findIndex(s => s.stepNumber === stepNumber + 1);
              if (nextStepIndex !== -1) {
                updatedSteps[nextStepIndex] = {
                  ...updatedSteps[nextStepIndex],
                  question: data.nextQuestion
                };
              }
            }
            
            return updatedSteps;
          });
        }
      }
    });

    // Subscribe to 5 Whys status changes (button color sync)
    const unsubFiveWhysStatusChanged = onRCAFiveWhysStatusChanged((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys status changed received:', data);
        // Update the cause analysis status for this cause
        setCauseAnalysisStatuses(prev => ({
          ...prev,
          [data.causeId]: {
            hasAnswers: data.hasAnswers,
            answerCount: data.answerCount
          }
        }));
        // Show toast notification
        showToast(`${data.userName} updated 5 Whys analysis`);
      }
    });

    // Subscribe to 5 Whys AI analyzing state (loading spinner sync)
    const unsubFiveWhysAIAnalyzing = onRCAFiveWhysAIAnalyzing((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys AI analyzing state received:', data.isAnalyzing, 'from:', data.userName);
        setAnalyzingCause(data.isAnalyzing);
        // When AI analysis starts, switch to AI mode to show the loading state
        if (data.isAnalyzing) {
          setFiveWhysMode('ai');
          showToast(`${data.userName} started AI Analysis`, 'info');
        }
      }
    });

    // Subscribe to 5 Whys AI result (AI analysis result sync)
    const unsubFiveWhysAIResult = onRCAFiveWhysAIResult((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys AI result received from:', data.userName);
        // Set the mode to 'ai' so the UI shows the result view
        setFiveWhysMode('ai');
        setCauseAnalysisResult(data.result);
        
        // Update local status to show green button (since AI analysis is saved to database)
        if (data.causeId) {
          setCauseAnalysisStatuses(prev => ({
            ...prev,
            [data.causeId]: {
              hasAnswers: true,
              answerCount: 5
            }
          }));
        }
        
        showToast(`${data.userName} completed AI Analysis`, 'success');
      }
    });

    // Subscribe to 5 Whys AI Edit mode changes (real-time edit mode sync)
    const unsubFiveWhysAIEditMode = onRCAFiveWhysAIEditMode((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys AI edit mode received:', data.isEditing, 'from:', data.userName);
        setIsEditingFiveWhys(data.isEditing);
        if (data.isEditing && data.editedSteps) {
          setEditedFiveWhysSteps(data.editedSteps);
          setEditedRootCause(data.editedRootCause || '');
          showToast(`${data.userName} started editing AI Analysis`, 'info');
        } else if (!data.isEditing) {
          setEditedFiveWhysSteps([]);
          setEditedRootCause('');
          setEditValidationFeedback(null);
          showToast(`${data.userName} cancelled editing`, 'info');
        }
      }
    });

    // Subscribe to 5 Whys AI Edit typing (real-time typing indicator)
    const unsubFiveWhysAIEditTyping = onRCAFiveWhysAIEditTyping((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys AI edit typing received:', data.fieldType, 'step:', data.stepNumber, 'isTyping:', data.isTyping, 'from:', data.userName);
        // Could be used for typing indicators if needed
      }
    });

    // Subscribe to 5 Whys AI Edit field updates (real-time content sync)
    const unsubFiveWhysAIEditUpdate = onRCAFiveWhysAIEditUpdate((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys AI edit update received:', data.fieldType, 'step:', data.stepNumber, 'from:', data.userName);
        if (data.fieldType === 'why' && data.stepNumber) {
          setEditedFiveWhysSteps(prev => 
            prev.map(step => 
              step.stepNumber === data.stepNumber ? { ...step, answer: data.text } : step
            )
          );
        } else if (data.fieldType === 'rootCause') {
          setEditedRootCause(data.text);
        }
      }
    });

    // Subscribe to 5 Whys Manual validation state (real-time validation sync)
    const unsubFiveWhysManualValidating = onRCAFiveWhysManualValidating((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys Manual validating received:', data.isValidating, 'from:', data.userName);
        setValidatingManualAnalysis(data.isValidating);
        if (data.isValidating) {
          showToast(`${data.userName} started AI Validation`, 'info');
        }
      }
    });

    // Subscribe to 5 Whys Manual validation result (real-time result sync)
    const unsubFiveWhysManualValidationResult = onRCAFiveWhysManualValidationResult((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys Manual validation result received from:', data.userName);
        setManualAnalysisValidation(data.result);
        showToast(`${data.userName} completed AI Validation`, 'success');
      }
    });

    // Subscribe to 5 Whys Manual correction applied (real-time fix sync)
    const unsubFiveWhysManualCorrectionApplied = onRCAFiveWhysManualCorrectionApplied((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys Manual correction applied received:', data.stepNumber, 'from:', data.userName);
        // Apply the correction to the manual steps
        setManualFiveWhysSteps(steps =>
          steps.map(step =>
            step.stepNumber === data.stepNumber ? { ...step, answer: data.correctedText } : step
          )
        );
        showToast(`${data.userName} applied AI fix to Why #${data.stepNumber}`, 'info');
      }
    });

    // Subscribe to 5 Whys AI Edit validation state (real-time loading sync)
    const unsubFiveWhysAIEditValidating = onRCAFiveWhysAIEditValidating((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId && data.causeId === selectedCauseForAnalysis?.id) {
        console.log('🔍 5 Whys AI Edit validating state received:', data.isValidating, 'from:', data.userName);
        setValidatingEdits(data.isValidating);
        if (data.isValidating) {
          setEditValidationFeedback(null);
          showToast(`${data.userName} is validating AI edits...`, 'info');
        }
      }
    });

    // Subscribe to 5 Whys AI Edit validation result (real-time result sync)
    const unsubFiveWhysAIEditValidationResult = onRCAFiveWhysAIEditValidationResult((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId && data.causeId === selectedCauseForAnalysis?.id) {
        console.log('🔍 5 Whys AI Edit validation result received from:', data.userName);
        setEditValidationFeedback(data.result);
        showToast(`${data.userName} completed AI Edit Validation`, 'success');
      }
    });

    // Subscribe to 5 Whys AI Edit fix applied (real-time Apply Fix sync)
    const unsubFiveWhysAIEditFixApplied = onRCAFiveWhysAIEditFixApplied((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId && data.causeId === selectedCauseForAnalysis?.id) {
        console.log('🔍 5 Whys AI Edit fix applied received:', data.stepNumber, 'from:', data.userName);
        // Apply the fix to the edited steps
        setEditedFiveWhysSteps(steps =>
          steps.map(step =>
            step.stepNumber === data.stepNumber ? { ...step, answer: data.correctedText } : step
          )
        );
        // Remove this issue from feedback
        setEditValidationFeedback(prev => prev ? {
          ...prev,
          issues: prev.issues.filter(issue => issue.stepNumber !== data.stepNumber),
        } : null);
        showToast(`${data.userName} applied AI fix to Why #${data.stepNumber}`, 'info');
      }
    });

    // Subscribe to 5 Whys cause recommendation (real-time keep/eliminate sync)
    const unsubFiveWhysCauseRecommendation = onRCAFiveWhysCauseRecommendation((data) => {
      if (data.rcaId === rcaId && data.userId !== currentUserId) {
        console.log('🔍 5 Whys cause recommendation received:', data.recommendation, 'from:', data.userName);
        
        if (data.recommendation === 'eliminate') {
          // Remove the cause from its category
          setCategories(cats => cats.map((cat) => ({
            ...cat,
            causes: cat.causes.filter((c) => c.id !== data.causeId),
          })));
          showToast(`${data.userName} eliminated the cause`, 'info');
        } else {
          // Mark as validated root cause with the analysis
          setCategories(cats => cats.map((cat) => ({
            ...cat,
            causes: cat.causes.map((c) =>
              c.id === data.causeId
                ? { ...c, fiveWhysAnalysis: data.fiveWhysAnalysis }
                : c
            ),
          })));
          showToast(`${data.userName} confirmed the root cause`, 'success');
        }
        
        // Close modal if viewing the same cause
        if (selectedCauseForAnalysis?.id === data.causeId) {
          setSelectedCauseForAnalysis(null);
          setCauseAnalysisResult(null);
          setFiveWhysMode('manual');
        }
      }
    });

    return () => {
      unsubSuggestionsStarted();
      unsubSuggestionsReceived();
      unsubValidationStarted();
      unsubValidationComplete();
      unsubClarificationAnswer();
      unsubProblemUpdate();
      unsubCategoriesUpdated();
      unsubCorrectiveActionsUpdated();
      unsubCauseInputTyping();
      unsubFiveWhysModalOpened();
      unsubFiveWhysModalClosed();
      unsubFiveWhysModeChanged();
      unsubFiveWhysFieldTyping();
      unsubFiveWhysFieldUpdate();
      unsubFiveWhysStatusChanged();
      unsubFiveWhysAIAnalyzing();
      unsubFiveWhysAIResult();
      unsubFiveWhysAIEditMode();
      unsubFiveWhysAIEditTyping();
      unsubFiveWhysAIEditUpdate();
      unsubFiveWhysManualValidating();
      unsubFiveWhysManualValidationResult();
      unsubFiveWhysManualCorrectionApplied();
      unsubFiveWhysAIEditValidating();
      unsubFiveWhysAIEditValidationResult();
      unsubFiveWhysAIEditFixApplied();
      unsubFiveWhysCauseRecommendation();
    };
  }, [rcaId, currentUserId, selectedCauseForAnalysis?.id, onRCAAISuggestionsStarted, onRCAAISuggestionsReceived, onRCAAIValidationStarted, onRCAAIValidationComplete, onRCAClarificationAnswer, onRCAProblemUpdate, onRCACategoriesUpdated, onRCACorrectiveActionsUpdated, onRCACauseInputTyping, onRCAFiveWhysModalOpened, onRCAFiveWhysModalClosed, onRCAFiveWhysModeChanged, onRCAFiveWhysFieldTyping, onRCAFiveWhysFieldUpdate, onRCAFiveWhysStatusChanged, onRCAFiveWhysAIAnalyzing, onRCAFiveWhysAIResult, onRCAFiveWhysAIEditMode, onRCAFiveWhysAIEditTyping, onRCAFiveWhysAIEditUpdate, onRCAFiveWhysManualValidating, onRCAFiveWhysManualValidationResult, onRCAFiveWhysManualCorrectionApplied, onRCAFiveWhysAIEditValidating, onRCAFiveWhysAIEditValidationResult, onRCAFiveWhysAIEditFixApplied, onRCAFiveWhysCauseRecommendation, showToast]);
  
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

  // Apply suggested problem revision - with confirmation if overriding existing
  const applySuggestedProblem = () => {
    if (problemValidation?.suggestedRevision) {
      // If there's already a problem statement, show confirmation dialog
      if (problem.trim() && problem.trim() !== problemValidation.suggestedRevision.trim()) {
        setShowProblemOverrideConfirm(true);
      } else {
        // No existing problem or same as suggestion, apply directly
        setProblem(problemValidation.suggestedRevision);
      }
    }
  };

  // Confirm override of existing problem statement
  const confirmProblemOverride = () => {
    if (problemValidation?.suggestedRevision) {
      setProblem(problemValidation.suggestedRevision);
      setShowProblemOverrideConfirm(false);
    }
  };

  // Cancel problem override
  const cancelProblemOverride = () => {
    setShowProblemOverrideConfirm(false);
  };

  // Open 5 Whys modal for a cause and go straight to manual analysis.
  const openFiveWhysModal = async (cause: FishboneCause, categoryName: string) => {
    setSelectedCauseForAnalysis({ id: cause.id, text: cause.text, categoryName });
    setCauseAnalysisResult(null);
    setCurrentDbAnalysis(null);
    setFiveWhysMode('manual');
    setCurrentAnalysisMethod('manual');
    setManualStepValidations({});
    setValidatingManualStep(null);
    
    // Variables to track for broadcasting
    let finalMode: 'choose' | 'manual' | 'ai' = 'manual';
    let hasAnswers = false;
    let answerCount = 0;
    let finalRootCause = '';
    const firstWhyQuestion = `Why did "${cause.text}" happen?`;
    let finalSteps: Array<{ stepNumber: number; question: string; answer: string }> = [
      { stepNumber: 1, question: firstWhyQuestion, answer: '' },
      { stepNumber: 2, question: 'Why?', answer: '' },
      { stepNumber: 3, question: 'Why?', answer: '' },
      { stepNumber: 4, question: 'Why?', answer: '' },
      { stepNumber: 5, question: 'Why?', answer: '' },
    ];
    
    // Track saved analysis method (manual or ai)
    let savedAnalysisMethod: 'manual' | 'ai' | null = null;
    
    // Try to load existing analysis from database or create new one
    try {
      const response = await api.post(`/rca/${rcaId}/five-whys-analysis`, {
        causeId: cause.id,
        causeText: cause.text,
        categoryId: '', // Optional
        categoryName: categoryName,
        initialQuestion: firstWhyQuestion
      });
      
      if (response.data.success && response.data.analysis) {
        const dbAnalysis = response.data.analysis;
        setCurrentDbAnalysis({
          id: dbAnalysis.id,
          causeId: dbAnalysis.causeId,
          steps: dbAnalysis.steps,
          analysisMethod: dbAnalysis.analysisMethod
        });
        
        // Load saved analysis method
        savedAnalysisMethod = dbAnalysis.analysisMethod as 'manual' | 'ai' | null;
        setCurrentAnalysisMethod(savedAnalysisMethod);
        
        // If there are saved answers, populate the manual steps from database
        const hasExistingAnswers = dbAnalysis.steps.some((s: { answer: string | null }) => s.answer && s.answer.trim());
        hasAnswers = hasExistingAnswers;
        answerCount = dbAnalysis.answerCount || 0;
        
        if (hasExistingAnswers) {
          finalSteps = dbAnalysis.steps.map((s: { stepNumber: number; question: string; answer: string | null }) => ({
            stepNumber: s.stepNumber,
            question: s.stepNumber === 1 ? firstWhyQuestion : s.question,
            answer: s.answer || ''
          }));
          setManualFiveWhysSteps(finalSteps);
        } else {
          // Use default empty steps with proper first question
          setManualFiveWhysSteps(finalSteps);
        }
        
        finalMode = 'manual';
        setFiveWhysMode('manual');
        
        // Update the status for this cause
        setCauseAnalysisStatuses(prev => ({
          ...prev,
          [cause.id]: {
            hasAnswers: dbAnalysis.hasAnswers,
            answerCount: dbAnalysis.answerCount
          }
        }));
        
        // Load saved root cause if exists
        if (dbAnalysis.rootCause) {
          setManualRootCause(dbAnalysis.rootCause);
          finalRootCause = dbAnalysis.rootCause;
        } else {
          setManualRootCause('');
        }
        
        console.log('📊 Loaded/Created 5 Whys analysis:', dbAnalysis.id, 'isNew:', response.data.isNew, 'hasAnswers:', hasExistingAnswers, 'method:', dbAnalysis.analysisMethod, 'rootCause:', dbAnalysis.rootCause);
      } else {
        // No analysis returned, use default manual mode
        setManualFiveWhysSteps(finalSteps);
        setFiveWhysMode('manual');
        setManualRootCause('');
        setCurrentAnalysisMethod('manual');
      }
    } catch (error) {
      console.error('Failed to load/create 5 Whys analysis:', error);
      // Fallback to default empty steps and manual mode
      setManualFiveWhysSteps(finalSteps);
      setFiveWhysMode('manual');
      setManualRootCause('');
      setCurrentAnalysisMethod('manual');
    }
    
    setManualAnalysisValidation(null);
    setFiveWhysModalOpenedBy(null); // Reset - current user opened it
    
    // Broadcast to all team members to open the modal with the correct mode and data
    emitRCAFiveWhysModalOpened(incidentId, rcaId, cause.id, cause.text, categoryName, finalMode, hasAnswers, answerCount, finalSteps, finalRootCause);
  };

  // Continue with existing 5 Whys analysis (go to the previously used mode: manual or ai)
  const continueFiveWhysAnalysis = () => {
    // Use saved analysis method, or default to manual if not set
    const modeToUse = currentAnalysisMethod || 'manual';
    
    if (modeToUse === 'ai' && causeAnalysisStatuses[selectedCauseForAnalysis?.id || '']?.hasAnswers) {
      // For AI mode with existing data, set up the result and show AI view
      setCauseAnalysisResult({
        causeId: selectedCauseForAnalysis?.id || '',
        causeText: selectedCauseForAnalysis?.text || '',
        fiveWhys: {
          steps: manualFiveWhysSteps.map(s => ({
            stepNumber: s.stepNumber,
            question: s.question,
            answer: s.answer,
            explanation: ''
          })),
          rootCause: manualRootCause,
          confidence: 0,
        },
        resolvesOriginalProblem: true,
        validationExplanation: 'Continuing from saved AI analysis.',
        recommendation: 'keep',
      });
      setFiveWhysMode('ai');
    } else {
      setFiveWhysMode('manual');
    }
    
    setManualAnalysisValidation(null);
    
    // Broadcast mode change to all team members
    emitRCAFiveWhysModeChanged(incidentId, rcaId, modeToUse);
  };

  // Start fresh - clear existing answers and show choose mode
  const startFreshFiveWhysAnalysis = async () => {
    if (!selectedCauseForAnalysis) return;
    
    // Clear all answers in the steps
    const clearedSteps = [
      { stepNumber: 1, question: `Why did "${selectedCauseForAnalysis.text}" happen?`, answer: '' },
      { stepNumber: 2, question: 'Why?', answer: '' },
      { stepNumber: 3, question: 'Why?', answer: '' },
      { stepNumber: 4, question: 'Why?', answer: '' },
      { stepNumber: 5, question: 'Why?', answer: '' },
    ];
    setManualFiveWhysSteps(clearedSteps);
    setManualRootCause('');
    
    // Clear answers in database by updating with autosave endpoint
    try {
      await api.patch(`/rca/${rcaId}/five-whys-autosave`, {
        causeId: selectedCauseForAnalysis.id,
        causeText: selectedCauseForAnalysis.text,
        categoryName: selectedCauseForAnalysis.categoryName,
        steps: clearedSteps,
        rootCause: ''
      });
      
      // Update local status to reflect cleared answers
      setCauseAnalysisStatuses(prev => ({
        ...prev,
        [selectedCauseForAnalysis.id]: {
          hasAnswers: false,
          answerCount: 0
        }
      }));
      
      // Broadcast status change to other team members (color indicator)
      emitRCAFiveWhysStatusChanged(incidentId, rcaId, selectedCauseForAnalysis.id, false, 0);
      
      console.log('🗑️ Cleared all 5 Whys answers for cause:', selectedCauseForAnalysis.id);
    } catch (error) {
      console.error('Failed to clear 5 Whys answers:', error);
    }
    
    setFiveWhysMode('manual');
    
    // Broadcast mode change with reset data to all team members
    emitRCAFiveWhysModeChanged(incidentId, rcaId, 'manual', {
      causeId: selectedCauseForAnalysis.id,
      causeText: selectedCauseForAnalysis.text,
      steps: clearedSteps,
      hasAnswers: false,
      answerCount: 0
    });
  };

  // Start AI-powered 5 Whys analysis
  const startAIFiveWhysAnalysis = async () => {
    if (!selectedCauseForAnalysis) return;
    
    // Validate required fields before making API call
    if (!problem || !problem.trim()) {
      setErrorMessage('Problem statement is required for AI analysis. Please define the problem first.');
      return;
    }
    
    setFiveWhysMode('ai');
    setCurrentAnalysisMethod('ai');
    setAnalyzingCause(true);
    setCauseAnalysisResult(null);
    
    // Broadcast mode change and analyzing state to all team members
    emitRCAFiveWhysModeChanged(incidentId, rcaId, 'ai');
    emitRCAFiveWhysAIAnalyzing(incidentId, rcaId, selectedCauseForAnalysis.id, true);
    
    try {
      console.log('🔍 Starting AI 5 Whys analysis with:', {
        causeId: selectedCauseForAnalysis.id,
        causeText: selectedCauseForAnalysis.text,
        categoryName: selectedCauseForAnalysis.categoryName,
        problem,
      });
      
      const response = await api.post(`/rca/${rcaId}/ai/fishbone-cause-five-whys`, {
        causeId: selectedCauseForAnalysis.id,
        causeText: selectedCauseForAnalysis.text,
        categoryName: selectedCauseForAnalysis.categoryName,
        problem,
      });
      
      const result = response.data.data;
      setCauseAnalysisResult(result);
      
      // Save AI analysis to database (same table as manual analysis)
      try {
        const saveResponse = await api.post(`/rca/${rcaId}/ai/save-five-whys-analysis`, {
          causeId: selectedCauseForAnalysis.id,
          causeText: selectedCauseForAnalysis.text,
          categoryName: selectedCauseForAnalysis.categoryName,
          steps: result.fiveWhys.steps,
          rootCause: result.fiveWhys.rootCause,
          isValidRootCause: true,
          resolvesOriginalProblem: result.resolvesOriginalProblem,
        });
        
        console.log('🔍 AI 5 Whys analysis saved to database:', saveResponse.data);
        
        // Update local status to show green button
        setCauseAnalysisStatuses(prev => ({
          ...prev,
          [selectedCauseForAnalysis.id]: {
            hasAnswers: true,
            answerCount: 5
          }
        }));
        
        // Broadcast status change so all team members see the green button
        emitRCAFiveWhysStatusChanged(incidentId, rcaId, selectedCauseForAnalysis.id, true, 5);
      } catch (saveErr) {
        console.error('Failed to save AI 5 Whys analysis to database:', saveErr);
        // Don't fail the whole operation, just log the error
      }
      
      // Broadcast AI result to all team members
      emitRCAFiveWhysAIResult(incidentId, rcaId, selectedCauseForAnalysis.id, result);
    } catch (err) {
      console.error('5 Whys analysis failed:', err);
      setErrorMessage('Failed to analyze cause with 5 Whys. Please try again.');
      setFiveWhysMode('manual');
      emitRCAFiveWhysModeChanged(incidentId, rcaId, 'manual');
    } finally {
      setAnalyzingCause(false);
      // Broadcast analyzing state complete
      if (selectedCauseForAnalysis) {
        emitRCAFiveWhysAIAnalyzing(incidentId, rcaId, selectedCauseForAnalysis.id, false);
      }
    }
  };

  // Start Manual 5 Whys analysis
  const startManualFiveWhysAnalysis = () => {
    // Clear existing answers when starting fresh
    if (selectedCauseForAnalysis) {
      const freshSteps = [
        { stepNumber: 1, question: `Why did "${selectedCauseForAnalysis.text}" happen?`, answer: '' },
        { stepNumber: 2, question: 'Why?', answer: '' },
        { stepNumber: 3, question: 'Why?', answer: '' },
        { stepNumber: 4, question: 'Why?', answer: '' },
        { stepNumber: 5, question: 'Why?', answer: '' },
      ];
      setManualFiveWhysSteps(freshSteps);
      setManualRootCause('');
    }
    
    setFiveWhysMode('manual');
    setCurrentAnalysisMethod('manual');
    setManualAnalysisValidation(null);
    
    // Broadcast mode change to all team members
    emitRCAFiveWhysModeChanged(incidentId, rcaId, 'manual');
  };

  // Go back to manual mode.
  const goBackToChooseMode = () => {
    setFiveWhysMode('manual');
    
    // Broadcast mode change to all team members
    emitRCAFiveWhysModeChanged(incidentId, rcaId, 'manual');
  };

  // Update a manual 5 Whys step with real-time broadcast
  // These prefixes are removed locally so each next "Why" reads like a real question without needing the insight service.
  const leadingQuestionPrefixPhrases = [
    'not only but also',
    'not only but',
    'as soon as',
    'as long as',
    'as though',
    'provided that',
    'even though',
    'even if',
    'rather than',
    'whether or',
    'both and',
    'either or',
    'neither nor',
    'so that',
    'as if',
    'not only',
    'in order that',
    'assuming that',
    'given that',
    'about',
    'after',
    'although',
    'and',
    'as',
    'because',
    'before',
    'both',
    'but',
    'either',
    'for',
    'however',
    'if',
    'lest',
    'moreover',
    'neither',
    'nor',
    'once',
    'or',
    'since',
    'so',
    'than',
    'that',
    'though',
    'therefore',
    'unless',
    'until',
    'when',
    'whenever',
    'where',
    'whereas',
    'wherever',
    'whether',
    'while',
    'yet',
    // Existing multilingual prefixes from earlier manual question generation.
    'a fin de que',
    'a menos que',
    'afin que',
    'alors que',
    'antes de que',
    'apres que',
    'aussitot que',
    'avant que',
    'bien que',
    'cuando',
    'depuis que',
    'desde que',
    'despues de que',
    'en cuanto',
    'hasta que',
    'lorsque',
    'mientras',
    'parce que',
    'para que',
    'pendant que',
    'puesto que',
    'puisque',
    'quoique',
    'tan pronto como',
    'tandis que',
    'ya que',
    'aunque',
    'car',
    'comme',
    'donc',
    'et',
    'mais',
    'ni',
    'ou',
    'pero',
    'porque',
    'que',
    'si',
    'sino',
    'y',
  ];

  const phraseSeparatorPattern = `[\\s,.;:!?"'()\\-\\u2013\\u2014\\u2026]+`;
  const phraseEdgePattern = `[\\s,.;:!?"'()\\-\\u2013\\u2014\\u2026]*`;

  const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const buildFlexiblePhrasePattern = (phrase: string): string =>
    phrase
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRegExp)
      .join(phraseSeparatorPattern);

  const filterLeadingQuestionPrefix = (text: string): string => {
    let cleaned = text.trim().replace(new RegExp(`^${phraseEdgePattern}`), '');
    let passCount = 0;
    let removedPrefix = true;

    while (cleaned && removedPrefix && passCount < 3) {
      removedPrefix = false;
      passCount += 1;

      for (const phrase of leadingQuestionPrefixPhrases) {
        const phrasePattern = buildFlexiblePhrasePattern(phrase);
        const prefixPattern = new RegExp(`^${phrasePattern}(?=$|${phraseSeparatorPattern})${phraseEdgePattern}`, 'i');
        const nextText = cleaned.replace(prefixPattern, '').trim();

        if (nextText !== cleaned) {
          cleaned = nextText;
          removedPrefix = true;
          break;
        }
      }
    }

    return cleaned.replace(/[?.!]+$/g, '').trim();
  };

  // Generate the dynamic question for a Why step based on previous answer
  const generateWhyQuestion = (stepNumber: number, previousAnswer: string): string => {
    if (stepNumber === 1) {
      // First step uses the cause text
      return selectedCauseForAnalysis 
        ? `Why did "${selectedCauseForAnalysis.text}" happen?`
        : 'Why did this happen?';
    }
    
    const filteredAnswer = filterLeadingQuestionPrefix(previousAnswer);
    
    if (!filteredAnswer.trim()) {
      return 'Why?';
    }
    
    // Construct the question: "Why [filtered answer]?"
    return `Why ${filteredAnswer}?`;
  };

  const refreshManualQuestionFromPreviousAnswer = (stepNumber: number) => {
    setManualFiveWhysSteps(steps => {
      const currentStep = steps.find(step => step.stepNumber === stepNumber);

      if (!currentStep) {
        return steps;
      }

      if (stepNumber === 1) {
        const firstWhyQuestion = generateWhyQuestion(1, '');

        if (currentStep.question === firstWhyQuestion) {
          return steps;
        }

        return steps.map(step =>
          step.stepNumber === 1 ? { ...step, question: firstWhyQuestion } : step
        );
      }

      const previousStep = steps.find(step => step.stepNumber === stepNumber - 1);

      if (!previousStep?.answer.trim()) {
        return steps;
      }

      const nextQuestion = generateWhyQuestion(stepNumber, previousStep.answer);

      if (currentStep.question === nextQuestion) {
        return steps;
      }

      return steps.map(step =>
        step.stepNumber === stepNumber ? { ...step, question: nextQuestion } : step
      );
    });
  };

  // Show auto-save toast notification
  const showAutoSaveToast = (message: string = 'Changes saved') => {
    // Clear any existing timeout
    if (autoSaveToastTimeout.current) {
      clearTimeout(autoSaveToastTimeout.current);
    }
    
    // Show the toast
    setAutoSaveToast({show: true, message});
    
    // Hide after 2 seconds
    autoSaveToastTimeout.current = setTimeout(() => {
      setAutoSaveToast({show: false, message: ''});
    }, 2000);
  };

  const updateManualStep = (stepNumber: number, answer: string) => {
    setManualStepValidations(prev => {
      const next = { ...prev };
      for (let index = stepNumber; index <= 5; index += 1) {
        delete next[index];
      }
      return next;
    });

    // Update local state immediately - both the answer AND the next step's question
    setManualFiveWhysSteps(steps => {
      const updatedSteps = steps.map(step => 
        step.stepNumber === stepNumber ? { ...step, answer } : step
      );
      
      // Update the NEXT step's question based on this answer
      if (stepNumber < 5) {
        const nextStepIndex = updatedSteps.findIndex(s => s.stepNumber === stepNumber + 1);
        if (nextStepIndex !== -1) {
          const newQuestion = generateWhyQuestion(stepNumber + 1, answer);
          updatedSteps[nextStepIndex] = {
            ...updatedSteps[nextStepIndex],
            question: newQuestion
          };
        }
      }
      
      return updatedSteps;
    });

    if (stepNumber === 5) {
      updateManualRootCause(answer);
    }
    
    const fieldKey = `why-${stepNumber}`;
    
    // Generate the next question to include in the broadcast
    const nextQuestion = stepNumber < 5 ? generateWhyQuestion(stepNumber + 1, answer) : undefined;
    
    // Emit typing indicator (start typing)
    emitRCAFiveWhysFieldTyping(incidentId, rcaId, 'why', true, stepNumber);
    
    // Clear previous timeout for this field
    if (fiveWhysFieldUpdateTimeouts.current[fieldKey]) {
      clearTimeout(fiveWhysFieldUpdateTimeouts.current[fieldKey]);
    }
    if (fiveWhysTypingTimeouts.current[fieldKey]) {
      clearTimeout(fiveWhysTypingTimeouts.current[fieldKey]);
    }
    if (dbSaveTimeouts.current[fieldKey]) {
      clearTimeout(dbSaveTimeouts.current[fieldKey]);
    }
    
    // Debounce the content update (emit after 150ms of no typing)
    fiveWhysFieldUpdateTimeouts.current[fieldKey] = setTimeout(() => {
      emitRCAFiveWhysFieldUpdate(incidentId, rcaId, 'why', answer, stepNumber, nextQuestion);
    }, 150);
    
    // Stop typing indicator after 1 second of no typing
    fiveWhysTypingTimeouts.current[fieldKey] = setTimeout(() => {
      emitRCAFiveWhysFieldTyping(incidentId, rcaId, 'why', false, stepNumber);
    }, 1000);
    
    // Debounce database save (save after 500ms of no typing)
    dbSaveTimeouts.current[fieldKey] = setTimeout(async () => {
      if (selectedCauseForAnalysis) {
        try {
          // Get the latest steps state for the save
          setManualFiveWhysSteps(currentSteps => {
            // Update the question for the next step in the save payload
            const stepsToSave = currentSteps.map(step => 
              step.stepNumber === stepNumber ? { ...step, answer } : step
            );
            
            // Update next question if applicable
            if (stepNumber < 5) {
              const nextStepIndex = stepsToSave.findIndex(s => s.stepNumber === stepNumber + 1);
              if (nextStepIndex !== -1) {
                stepsToSave[nextStepIndex] = {
                  ...stepsToSave[nextStepIndex],
                  question: generateWhyQuestion(stepNumber + 1, answer)
                };
              }
            }
            
            // Perform the API call
            api.patch(`/rca/${rcaId}/five-whys-autosave`, {
              causeId: selectedCauseForAnalysis.id,
              causeText: selectedCauseForAnalysis.text,
              categoryName: selectedCauseForAnalysis.categoryName,
              steps: stepsToSave,
              fieldType: 'why',
              stepNumber,
              analysisMethod: 'manual'
            }).then(response => {
              if (response.data.success) {
                // Update cause analysis status for color coding
                setCauseAnalysisStatuses(prev => ({
                  ...prev,
                  [selectedCauseForAnalysis.id]: {
                    hasAnswers: response.data.analysis?.hasAnswers || false,
                    answerCount: response.data.analysis?.answerCount || 0
                  }
                }));
                // Broadcast status change to other team members
                emitRCAFiveWhysStatusChanged(
                  incidentId,
                  rcaId,
                  selectedCauseForAnalysis.id,
                  response.data.analysis?.hasAnswers || false,
                  response.data.analysis?.answerCount || 0
                );
                // Show auto-save toast
                showAutoSaveToast('Changes saved');
                console.log(`💾 Auto-saved 5 Whys step ${stepNumber} to database`);
              }
            }).catch(error => {
              console.error(`Failed to auto-save 5 Whys step ${stepNumber}:`, error);
            });
            
            return currentSteps; // Don't modify state, just use for reading
          });
        } catch (error) {
          console.error(`Failed to auto-save 5 Whys step ${stepNumber}:`, error);
        }
      }
    }, 500);
  };

  // Update manual root cause with real-time broadcast
  const updateManualRootCause = (text: string) => {
    // Update local state immediately
    setManualRootCause(text);
    
    const fieldKey = 'rootCause';
    
    // Emit typing indicator (start typing)
    emitRCAFiveWhysFieldTyping(incidentId, rcaId, 'rootCause', true);
    
    // Clear previous timeout for this field
    if (fiveWhysFieldUpdateTimeouts.current[fieldKey]) {
      clearTimeout(fiveWhysFieldUpdateTimeouts.current[fieldKey]);
    }
    if (fiveWhysTypingTimeouts.current[fieldKey]) {
      clearTimeout(fiveWhysTypingTimeouts.current[fieldKey]);
    }
    if (dbSaveTimeouts.current[fieldKey]) {
      clearTimeout(dbSaveTimeouts.current[fieldKey]);
    }
    
    // Debounce the content update (emit after 150ms of no typing)
    fiveWhysFieldUpdateTimeouts.current[fieldKey] = setTimeout(() => {
      emitRCAFiveWhysFieldUpdate(incidentId, rcaId, 'rootCause', text);
    }, 150);
    
    // Stop typing indicator after 1 second of no typing
    fiveWhysTypingTimeouts.current[fieldKey] = setTimeout(() => {
      emitRCAFiveWhysFieldTyping(incidentId, rcaId, 'rootCause', false);
    }, 1000);
    
    // Debounce database save (save after 500ms of no typing)
    dbSaveTimeouts.current[fieldKey] = setTimeout(async () => {
      if (selectedCauseForAnalysis) {
        try {
          const response = await api.patch(`/rca/${rcaId}/five-whys-autosave`, {
            causeId: selectedCauseForAnalysis.id,
            causeText: selectedCauseForAnalysis.text,
            categoryName: selectedCauseForAnalysis.categoryName,
            rootCause: text,
            fieldType: 'rootCause',
            analysisMethod: 'manual'
          });
          
          if (response.data.success) {
            showAutoSaveToast('Root cause saved');
            console.log(`💾 Auto-saved root cause to database`);
          }
        } catch (error) {
          console.error('Failed to auto-save root cause:', error);
        }
      }
    }, 500);
  };

  const validateManualStepAnswer = async (stepNumber: number) => {
    if (!selectedCauseForAnalysis) return;

    const step = manualFiveWhysSteps.find(item => item.stepNumber === stepNumber);
    if (!step || !step.answer.trim()) return;

    setValidatingManualStep(stepNumber);

    try {
      const response = await api.post(`/rca/${rcaId}/ai/validate-five-whys-step`, {
        causeText: selectedCauseForAnalysis.text,
        categoryName: selectedCauseForAnalysis.categoryName,
        problem,
        stepNumber,
        question: step.question,
        answer: step.answer,
        previousSteps: manualFiveWhysSteps
          .filter(item => item.stepNumber < stepNumber && item.answer.trim())
          .map(item => ({
            stepNumber: item.stepNumber,
            question: item.question,
            answer: item.answer,
          })),
      });

      const result = response.data?.data as ManualStepValidationResult | undefined;
      if (!result) return;

      setManualStepValidations(prev => ({
        ...prev,
        [stepNumber]: {
          rating: result.rating === 'ACCEPTED' ? 'ACCEPTED' : 'SHALLOW',
          score: result.score,
          feedback: result.feedback,
          suggestedAnswer: result.suggestedAnswer,
          reasoning: result.reasoning,
          suggestionDismissed: false,
          feedbackDismissed: false,
        },
      }));
    } catch (error) {
      console.error(`Failed to validate 5 Whys step ${stepNumber}:`, error);
      setManualStepValidations(prev => ({
        ...prev,
        [stepNumber]: {
          rating: 'SHALLOW',
          score: 0,
          feedback: 'Validation could not be completed. Please review this answer manually.',
          suggestedAnswer: null,
          suggestionDismissed: true,
          feedbackDismissed: false,
        },
      }));
    } finally {
      setValidatingManualStep(null);
    }
  };

  const acceptManualStepSuggestion = (stepNumber: number, suggestedAnswer: string) => {
    updateManualStep(stepNumber, suggestedAnswer);
    setManualStepValidations(prev => ({
      ...prev,
      [stepNumber]: {
        ...(prev[stepNumber] || {
          score: 80,
          feedback: 'Suggestion accepted.',
        }),
        rating: 'ACCEPTED',
        suggestedAnswer: null,
        suggestionDismissed: true,
        feedbackDismissed: false,
      },
    }));
  };

  const declineManualStepSuggestion = (stepNumber: number) => {
    setManualStepValidations(prev => ({
      ...prev,
      ...(prev[stepNumber]
        ? { [stepNumber]: { ...prev[stepNumber], suggestionDismissed: true } }
        : {}),
    }));
  };

  const dismissManualStepValidationFeedback = (stepNumber: number) => {
    setManualStepValidations(prev => ({
      ...prev,
      ...(prev[stepNumber]
        ? { [stepNumber]: { ...prev[stepNumber], feedbackDismissed: true } }
        : {}),
    }));
  };

  // Validate manual 5 Whys analysis with AI
  const validateManualFiveWhysAnalysis = async () => {
    if (!selectedCauseForAnalysis) return;
    
    setValidatingManualAnalysis(true);
    setManualAnalysisValidation(null);
    
    // Broadcast validation start to all team members
    emitRCAFiveWhysManualValidating(incidentId, rcaId, selectedCauseForAnalysis.id, true);
    
    try {
      const response = await api.post(`/rca/${rcaId}/ai/validate-five-whys`, {
        causeText: selectedCauseForAnalysis.text,
        categoryName: selectedCauseForAnalysis.categoryName,
        problem,
        fiveWhysSteps: manualFiveWhysSteps,
        rootCause: manualRootCause,
      });
      
      const validationResult = response.data.data;
      setManualAnalysisValidation(validationResult);
      
      // Broadcast validation result to all team members
      emitRCAFiveWhysManualValidationResult(incidentId, rcaId, selectedCauseForAnalysis.id, validationResult);
    } catch (err) {
      console.error('Manual 5 Whys validation failed:', err);
      // Set a default validation result
      const defaultResult = {
        isValid: true,
        issues: [],
        overallFeedback: 'Validation is currently unavailable. Please review your analysis manually.',
        resolvesOriginalProblem: true,
      };
      setManualAnalysisValidation(defaultResult);
      
      // Broadcast the fallback result
      emitRCAFiveWhysManualValidationResult(incidentId, rcaId, selectedCauseForAnalysis.id, defaultResult);
    } finally {
      setValidatingManualAnalysis(false);
      // Broadcast validation complete
      emitRCAFiveWhysManualValidating(incidentId, rcaId, selectedCauseForAnalysis.id, false);
    }
  };

  // Apply spelling/grammar correction from AI validation
  const applyManualCorrection = (stepNumber: number, correctedText: string) => {
    setManualFiveWhysSteps(steps =>
      steps.map(step =>
        step.stepNumber === stepNumber ? { ...step, answer: correctedText } : step
      )
    );
    
    // Broadcast the correction to all team members
    if (selectedCauseForAnalysis) {
      emitRCAFiveWhysManualCorrectionApplied(incidentId, rcaId, selectedCauseForAnalysis.id, stepNumber, correctedText);
    }
  };

  // Handle manual analysis recommendation (keep or eliminate)
  const handleManualCauseRecommendation = (recommendation: 'keep' | 'eliminate') => {
    if (!selectedCauseForAnalysis) return;
    
    let fiveWhysAnalysis: any = undefined;
    const finalRootCauseAnswer = manualFiveWhysSteps.find(step => step.stepNumber === 5)?.answer.trim() || manualRootCause.trim();
    
    if (recommendation === 'eliminate') {
      // Remove the cause from its category
      const updated = categories.map((cat) => ({
        ...cat,
        causes: cat.causes.filter((c) => c.id !== selectedCauseForAnalysis.id),
      }));
      setCategories(updated);
    } else {
      if (!finalRootCauseAnswer) return;

      // Mark as validated root cause with manual analysis
      fiveWhysAnalysis = {
        steps: manualFiveWhysSteps,
        rootCause: finalRootCauseAnswer,
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
    
    // Broadcast to all team members
    emitRCAFiveWhysCauseRecommendation(
      incidentId,
      rcaId,
      selectedCauseForAnalysis.id,
      selectedCauseForAnalysis.categoryName || '',
      recommendation,
      fiveWhysAnalysis
    );
    
    closeFiveWhysModal();
  };

  // Close the 5 Whys modal and reset all state
  const closeFiveWhysModal = () => {
    setSelectedCauseForAnalysis(null);
    setCauseAnalysisResult(null);
    setFiveWhysMode('manual');
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
    setManualStepValidations({});
    setValidatingManualStep(null);
    setFiveWhysModalOpenedBy(null);
    
    // Broadcast to all team members to close the modal
    emitRCAFiveWhysModalClosed(incidentId, rcaId);
  };

  // Legacy function - keep for compatibility but redirect to new modal
  const analyzeCauseWithFiveWhys = (cause: FishboneCause, categoryName: string) => {
    openFiveWhysModal(cause, categoryName);
  };

  // Mark cause based on analysis recommendation (for AI analysis)
  const handleCauseRecommendation = (recommendation: 'keep' | 'eliminate') => {
    if (!selectedCauseForAnalysis || !causeAnalysisResult) return;
    
    let fiveWhysAnalysis: any = undefined;
    
    if (recommendation === 'eliminate') {
      // Remove the cause from its category
      const updated = categories.map((cat) => ({
        ...cat,
        causes: cat.causes.filter((c) => c.id !== selectedCauseForAnalysis.id),
      }));
      setCategories(updated);
    } else {
      // Mark as validated root cause
      fiveWhysAnalysis = { ...causeAnalysisResult.fiveWhys, isValidRootCause: true };
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
    
    // Broadcast to all team members
    emitRCAFiveWhysCauseRecommendation(
      incidentId,
      rcaId,
      selectedCauseForAnalysis.id,
      selectedCauseForAnalysis.categoryName || '',
      recommendation,
      fiveWhysAnalysis
    );
    
    closeFiveWhysModal();
  };

  // Start editing the 5 Whys
  const startEditingFiveWhys = () => {
    if (causeAnalysisResult && selectedCauseForAnalysis) {
      const steps = [...causeAnalysisResult.fiveWhys.steps];
      const rootCause = causeAnalysisResult.fiveWhys.rootCause;
      
      setEditedFiveWhysSteps(steps);
      setEditedRootCause(rootCause);
      setIsEditingFiveWhys(true);
      setEditValidationFeedback(null);
      
      // Broadcast edit mode to all team members
      emitRCAFiveWhysAIEditMode(
        incidentId,
        rcaId,
        selectedCauseForAnalysis.id,
        true,
        steps,
        rootCause
      );
    }
  };

  // Update an edited step answer (AI Edit mode with auto-save)
  const updateEditedStepAnswer = (stepNumber: number, newAnswer: string) => {
    setEditedFiveWhysSteps(prev => 
      prev.map(step => 
        step.stepNumber === stepNumber ? { ...step, answer: newAnswer } : step
      )
    );
    // Clear validation feedback when user edits
    setEditValidationFeedback(null);
    
    // Broadcast field update to all team members
    if (selectedCauseForAnalysis) {
      emitRCAFiveWhysAIEditUpdate(incidentId, rcaId, 'why', newAnswer, stepNumber);
    }
    
    // Auto-save to database with debounce
    const fieldKey = `ai-edit-why-${stepNumber}`;
    if (dbSaveTimeouts.current[fieldKey]) {
      clearTimeout(dbSaveTimeouts.current[fieldKey]);
    }
    
    dbSaveTimeouts.current[fieldKey] = setTimeout(async () => {
      if (selectedCauseForAnalysis) {
        try {
          // Get current edited steps to save
          setEditedFiveWhysSteps(currentSteps => {
            const stepsToSave = currentSteps.map(step => ({
              stepNumber: step.stepNumber,
              question: step.question,
              answer: step.answer
            }));
            
            api.patch(`/rca/${rcaId}/five-whys-autosave`, {
              causeId: selectedCauseForAnalysis.id,
              causeText: selectedCauseForAnalysis.text,
              categoryName: selectedCauseForAnalysis.categoryName,
              steps: stepsToSave,
              fieldType: 'why',
              stepNumber,
              analysisMethod: 'ai'
            }).then(response => {
              if (response.data.success) {
                setCauseAnalysisStatuses(prev => ({
                  ...prev,
                  [selectedCauseForAnalysis.id]: {
                    hasAnswers: response.data.analysis?.hasAnswers || false,
                    answerCount: response.data.analysis?.answerCount || 0
                  }
                }));
                showAutoSaveToast('Changes saved');
                console.log(`💾 AI Edit: Auto-saved step ${stepNumber}`);
              }
            }).catch(error => {
              console.error(`AI Edit: Failed to auto-save step ${stepNumber}:`, error);
            });
            
            return currentSteps;
          });
        } catch (error) {
          console.error(`AI Edit: Failed to auto-save step ${stepNumber}:`, error);
        }
      }
    }, 500);
  };

  // Update edited root cause (AI Edit mode with auto-save)
  const updateEditedRootCause = (newRootCause: string) => {
    setEditedRootCause(newRootCause);
    setEditValidationFeedback(null);
    
    // Broadcast root cause update to all team members
    if (selectedCauseForAnalysis) {
      emitRCAFiveWhysAIEditUpdate(incidentId, rcaId, 'rootCause', newRootCause);
    }
    
    // Auto-save to database with debounce
    const fieldKey = 'ai-edit-rootCause';
    if (dbSaveTimeouts.current[fieldKey]) {
      clearTimeout(dbSaveTimeouts.current[fieldKey]);
    }
    
    dbSaveTimeouts.current[fieldKey] = setTimeout(async () => {
      if (selectedCauseForAnalysis) {
        try {
          const response = await api.patch(`/rca/${rcaId}/five-whys-autosave`, {
            causeId: selectedCauseForAnalysis.id,
            causeText: selectedCauseForAnalysis.text,
            categoryName: selectedCauseForAnalysis.categoryName,
            rootCause: newRootCause,
            fieldType: 'rootCause',
            analysisMethod: 'ai'
          });
          
          if (response.data.success) {
            showAutoSaveToast('Root cause saved');
            console.log('💾 AI Edit: Auto-saved root cause');
          }
        } catch (error) {
          console.error('AI Edit: Failed to auto-save root cause:', error);
        }
      }
    }, 500);
  };

  // Cancel editing (without saving)
  const cancelEditingFiveWhys = () => {
    setIsEditingFiveWhys(false);
    setEditedFiveWhysSteps([]);
    setEditedRootCause('');
    setEditValidationFeedback(null);
    
    // Broadcast edit mode off to all team members
    if (selectedCauseForAnalysis) {
      emitRCAFiveWhysAIEditMode(incidentId, rcaId, selectedCauseForAnalysis.id, false, [], '');
    }
  };

  // Save and go back - saves the current edited data and returns to choose mode
  const saveAndGoBack = async () => {
    if (!selectedCauseForAnalysis) return;
    
    setIsSavingFiveWhys(true);
    setSaveStatus('saving');
    
    try {
      // Save the current edited data to the database
      await api.patch(`/rca/${rcaId}/five-whys-autosave`, {
        causeId: selectedCauseForAnalysis.id,
        causeText: selectedCauseForAnalysis.text,
        categoryName: selectedCauseForAnalysis.categoryName,
        steps: editedFiveWhysSteps,
        rootCause: editedRootCause,
        analysisMethod: 'ai'
      });
      
      setSaveStatus('saved');
      showAutoSaveToast();
      
      // Exit edit mode and return to manual mode after a brief delay to show success
      setTimeout(() => {
        setIsEditingFiveWhys(false);
        setEditedFiveWhysSteps([]);
        setEditedRootCause('');
        setEditValidationFeedback(null);
        setFiveWhysMode('manual');
        setSaveStatus('idle');
        
        // Broadcast edit mode off to all team members
        emitRCAFiveWhysAIEditMode(incidentId, rcaId, selectedCauseForAnalysis.id, false, [], '');
      }, 500);
    } catch (error) {
      console.error('Error saving 5 Whys before going back:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } finally {
      setIsSavingFiveWhys(false);
    }
  };

  // Explicit save button - saves without exiting edit mode
  const explicitSaveFiveWhys = async () => {
    if (!selectedCauseForAnalysis) return;
    
    setIsSavingFiveWhys(true);
    setSaveStatus('saving');
    
    try {
      await api.patch(`/rca/${rcaId}/five-whys-autosave`, {
        causeId: selectedCauseForAnalysis.id,
        causeText: selectedCauseForAnalysis.text,
        categoryName: selectedCauseForAnalysis.categoryName,
        steps: editedFiveWhysSteps,
        rootCause: editedRootCause,
        analysisMethod: 'ai'
      });
      
      setSaveStatus('saved');
      showAutoSaveToast();
      
      // Reset to idle after showing success
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving 5 Whys:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } finally {
      setIsSavingFiveWhys(false);
    }
  };

  // Validate edited 5 Whys with AI
  const validateEditedFiveWhys = async () => {
    if (!selectedCauseForAnalysis) return;
    
    setValidatingEdits(true);
    setEditValidationFeedback(null);
    
    // Broadcast validation starting to all team members
    emitRCAFiveWhysAIEditValidating(incidentId, rcaId, selectedCauseForAnalysis.id, true);
    
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
      
      // Broadcast validation result to all team members
      emitRCAFiveWhysAIEditValidationResult(incidentId, rcaId, selectedCauseForAnalysis.id, validation);
      
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
        
        // Broadcast edit mode off and the updated result to all team members
        emitRCAFiveWhysAIEditMode(incidentId, rcaId, selectedCauseForAnalysis.id, false, [], '');
        
        // Broadcast the updated AI result
        const updatedResult = {
          fiveWhys: {
            steps: editedFiveWhysSteps,
            rootCause: validation.suggestedRootCause || editedRootCause,
          },
          resolvesOriginalProblem: validation.resolvesOriginalProblem,
          validationExplanation: validation.overallFeedback,
        };
        emitRCAFiveWhysAIResult(incidentId, rcaId, selectedCauseForAnalysis.id, updatedResult);
      }
    } catch (err) {
      console.error('Failed to validate edited 5 Whys:', err);
      const errorResult = {
        isValid: false,
        issues: [],
        overallFeedback: 'Failed to validate edits. Please try again.',
        resolvesOriginalProblem: false,
      };
      setEditValidationFeedback(errorResult);
      
      // Broadcast error result to all team members
      emitRCAFiveWhysAIEditValidationResult(incidentId, rcaId, selectedCauseForAnalysis.id, errorResult);
    } finally {
      setValidatingEdits(false);
      
      // Broadcast validation complete to all team members
      if (selectedCauseForAnalysis) {
        emitRCAFiveWhysAIEditValidating(incidentId, rcaId, selectedCauseForAnalysis.id, false);
      }
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
    
    // Broadcast the fix applied to all team members (includes step update + issue removal)
    if (selectedCauseForAnalysis) {
      emitRCAFiveWhysAIEditFixApplied(incidentId, rcaId, selectedCauseForAnalysis.id, stepNumber, suggestion);
    }
  };

  // Apply AI analysis to current form
  const applyAIAnalysis = () => {
    if (aiAnalysis && !aiAnalysis.error) {
      setProblem(aiAnalysis.problem);
      setCategories(aiAnalysis.categories);
      
      // Broadcast the categories update to all team members
      console.log('📊 Applying AI analysis and broadcasting categories, incidentId:', incidentId, 'rcaId:', rcaId);
      emitRCACategoriesUpdated(incidentId, rcaId, aiAnalysis.categories, aiAnalysis.problem);
      
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
      
      // Clear the AI session from database since analysis is applied
      clearAISession();
    }
  };

  // Close AI workflow
  const closeAIWorkflow = () => {
    setShowAIPanel(false);
    setAiWorkflowStep('idle');
    setProblemValidation(null);
    setClarificationAnswers([]);
    setAiAnalysis(null);
    
    // Clear the AI session when user explicitly closes the panel
    clearAISession();
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
    
    // Broadcast categories update to team members
    emitRCACategoriesUpdated(incidentId, rcaId, updated, problem);
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
    
    // Broadcast categories update to team members
    emitRCACategoriesUpdated(incidentId, rcaId, updated, problem);
  };

  // Debounced broadcast for cause text updates
  const debouncedBroadcastCauseUpdateRef = useRef<NodeJS.Timeout | null>(null);
  
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
    
    // Debounce broadcast to avoid too many updates while typing
    if (debouncedBroadcastCauseUpdateRef.current) {
      clearTimeout(debouncedBroadcastCauseUpdateRef.current);
    }
    debouncedBroadcastCauseUpdateRef.current = setTimeout(() => {
      emitRCACategoriesUpdated(incidentId, rcaId, updated, problem);
    }, 500);
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
      
      // NOTE: Do NOT broadcast AI suggestions automatically. This prevents
      // AI-generated causes from appearing on other users' screens without consent.
      // The causes will be saved to database when user clicks "Save Progress" or
      // when they manually add/edit/remove causes.
    } catch (err) {
      console.error('Failed to get AI suggestions:', err);
    } finally {
      setLoadingAI(null);
    }
  };

  const getCauseResolutionSelection = (cause: FishboneCause): CauseResolutionSelection | undefined =>
    causeResolutionValidation?.selections.find(selection => selection.causeId === cause.id) || cause.resolutionValidation;

  const getCauseFinalRootCause = (cause: FishboneCause) =>
    cause.fiveWhysAnalysis?.rootCause?.trim()
    || cause.fiveWhysAnalysis?.steps?.find(step => step.stepNumber === 5)?.answer?.trim()
    || cause.resolutionValidation?.rootCause?.trim()
    || cause.text.trim();

  const getCorrectiveActionGenerationCauses = () => {
    const analyzedCauses = categories.flatMap(category =>
      category.causes
        .filter(cause => cause.text.trim())
        .map(cause => {
          const resolutionSelection = getCauseResolutionSelection(cause);
          const rootCause = cause.fiveWhysAnalysis?.rootCause?.trim()
            || cause.fiveWhysAnalysis?.steps?.find(step => step.stepNumber === 5)?.answer?.trim()
            || resolutionSelection?.rootCause?.trim()
            || '';
          const hasSavedAnalysis = Boolean(cause.fiveWhysAnalysis?.rootCause?.trim())
            || (causeAnalysisStatuses[cause.id]?.answerCount || 0) >= 5
            || Boolean(resolutionSelection?.rootCause?.trim());

          return {
            causeId: cause.id,
            categoryName: category.name,
            causeText: cause.text,
            rootCause,
            fiveWhysSteps: cause.fiveWhysAnalysis?.steps || [],
            resolutionClassification: resolutionSelection?.classification,
            resolutionReason: resolutionSelection?.reason,
            implementationImpact: resolutionSelection?.implementationImpact,
            ready: hasSavedAnalysis,
          };
        })
        .filter(cause => cause.ready)
    );
    const hasResolutionDecisions = analyzedCauses.some(cause => cause.resolutionClassification);
    const likelyCauses = analyzedCauses.filter(cause => cause.resolutionClassification === 'likely');

    if (likelyCauses.length > 0) {
      return likelyCauses;
    }

    return analyzedCauses.filter(cause =>
      !hasResolutionDecisions || cause.resolutionClassification !== 'unlikely'
    );
  };

  const isCauseReadyForManualResolution = (cause: FishboneCause) =>
    Boolean(cause.fiveWhysAnalysis?.rootCause?.trim())
    || Boolean(cause.resolutionValidation)
    || (causeAnalysisStatuses[cause.id]?.answerCount || 0) >= 5;

  const startManualCauseResolution = (cause: FishboneCause, classification: 'likely' | 'unlikely') => {
    const currentDraft = manualCauseResolutionDrafts[cause.id];
    const existingSelection = getCauseResolutionSelection(cause);

    setManualCauseResolutionDrafts(prev => ({
      ...prev,
      [cause.id]: {
        classification,
        reason: currentDraft?.reason ?? existingSelection?.reason ?? '',
      },
    }));
  };

  const editManualCauseResolution = (cause: FishboneCause) => {
    const existingSelection = getCauseResolutionSelection(cause);
    if (!existingSelection) return;

    setManualCauseResolutionDrafts(prev => ({
      ...prev,
      [cause.id]: {
        classification: existingSelection.classification,
        reason: existingSelection.reason || '',
      },
    }));
  };

  const updateManualCauseResolutionReason = (causeId: string, reason: string) => {
    setManualCauseResolutionDrafts(prev => ({
      ...prev,
      ...(prev[causeId]
        ? { [causeId]: { ...prev[causeId], reason } }
        : {}),
    }));
  };

  const cancelManualCauseResolution = (causeId: string) => {
    setManualCauseResolutionDrafts(prev => {
      const next = { ...prev };
      delete next[causeId];
      return next;
    });
  };

  const saveManualCauseResolution = async (category: FishboneCategory, cause: FishboneCause) => {
    const draft = manualCauseResolutionDrafts[cause.id];
    const reason = draft?.reason.trim();

    if (!draft || !reason) {
      showToast('Add a reason before saving the decision', 'error');
      return;
    }

    const selection: CauseResolutionSelection = {
      causeId: cause.id,
      categoryName: category.name,
      causeText: cause.text,
      rootCause: getCauseFinalRootCause(cause),
      classification: draft.classification,
      confidence: 100,
      reason,
      implementationImpact: draft.classification === 'likely'
        ? 'This cause was manually marked as likely to resolve the problem when addressed.'
        : 'This cause was manually marked as not likely to resolve the problem by itself.',
      linkedCauseIds: [],
      source: 'manual',
    };

    const previousCategories = categories;
    const previousCauseResolutionValidation = causeResolutionValidation;
    const updatedCategories = categories.map(cat => (
      cat.id === category.id
        ? {
            ...cat,
            causes: cat.causes.map(item => (
              item.id === cause.id
                ? { ...item, resolutionValidation: selection }
                : item
            )),
          }
        : cat
    ));

    setSavingManualCauseResolution(cause.id);
    setCategories(updatedCategories);
    cancelManualCauseResolution(cause.id);
    setCauseResolutionValidation(prev => prev
      ? {
          ...prev,
          selections: prev.selections.filter(selectionItem => selectionItem.causeId !== cause.id),
          likelyCauseIds: prev.likelyCauseIds.filter(id => id !== cause.id),
          unlikelyCauseIds: prev.unlikelyCauseIds.filter(id => id !== cause.id),
        }
      : prev);

    try {
      await onSave({ problem, categories: updatedCategories, rootCauseText, actionPlans, preventiveControls });
      emitRCACategoriesUpdated(incidentId, rcaId, updatedCategories, problem);
      showToast('Manual root cause decision saved', 'success');
    } catch (err: any) {
      console.error('Failed to save manual root cause decision:', err);
      setCategories(previousCategories);
      setCauseResolutionValidation(previousCauseResolutionValidation);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to save manual root cause decision.');
      showToast('Failed to save manual root cause decision', 'error');
    } finally {
      setSavingManualCauseResolution(null);
    }
  };

  const getAnalyzedFishboneCausesForValidation = () => categories.flatMap(category =>
    category.causes
      .filter(cause => cause.text.trim())
      .map(cause => ({
        causeId: cause.id,
        categoryName: category.name,
        causeText: cause.text,
        rootCause: cause.fiveWhysAnalysis?.rootCause || cause.resolutionValidation?.rootCause || '',
        fiveWhysSteps: cause.fiveWhysAnalysis?.steps || [],
      }))
  );

  const analyzedFishboneCauseCount = getAnalyzedFishboneCausesForValidation().filter(cause => cause.rootCause.trim()).length;

  const validateAnalyzedFishboneRootCauses = async () => {
    const causesForValidation = getAnalyzedFishboneCausesForValidation();

    if (!problem.trim()) {
      showToast('Add a problem statement before validating root causes', 'error');
      return;
    }

    if (causesForValidation.length === 0) {
      showToast('Add and analyze at least one cause first', 'error');
      return;
    }

    setCauseResolutionValidation(null);
    setShowCauseResolutionResultModal(false);
    setValidatingCauseResolution(true);
    setErrorMessage(null);

    try {
      const response = await api.post(`/rca/${rcaId}/ai/validate-fishbone-root-causes`, {
        problem,
        causes: causesForValidation,
      }, {
        timeout: 120000,
      });

      setCauseResolutionValidation(response.data.data);
      setShowCauseResolutionResultModal(true);
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to validate analyzed root causes.';
      setErrorMessage(message);
      showToast(message, 'error');
    } finally {
      setValidatingCauseResolution(false);
    }
  };

  const acceptCauseResolutionValidation = async () => {
    if (!causeResolutionValidation) return;

    const selectionByCauseId = new Map(causeResolutionValidation.selections.map(selection => [selection.causeId, selection]));
    const updatedCategories = categories.map(category => ({
      ...category,
      causes: category.causes.map(cause => ({
        ...cause,
        resolutionValidation: selectionByCauseId.has(cause.id)
          ? { ...selectionByCauseId.get(cause.id)!, source: selectionByCauseId.get(cause.id)!.source || 'ai' }
          : cause.resolutionValidation,
      })),
    }));

    setCategories(updatedCategories);
    setShowCauseResolutionResultModal(false);
    setCauseResolutionValidation(null);

    try {
      await onSave({ problem, categories: updatedCategories, rootCauseText, actionPlans, preventiveControls });
      showToast('Root cause selections saved', 'success');
    } catch (err: any) {
      console.error('Failed to save root cause selections:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to save root cause selections.');
      showToast('Failed to save root cause selections', 'error');
    }
  };

  const declineCauseResolutionValidation = () => {
    setShowCauseResolutionResultModal(false);
    setCauseResolutionValidation(null);
  };

  const handleSave = async (options?: { silent?: boolean }) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      await onSave({ problem, categories, rootCauseText, actionPlans, preventiveControls });
      if (!options?.silent) {
        showToast('Progress saved successfully', 'success');
      }
    } catch (err: any) {
      console.error('Failed to save:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to save. Please try again.');
      if (!options?.silent) {
        showToast('Failed to save progress', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!saveRequestToken || manualSaveRequestRef.current === saveRequestToken) {
      return;
    }
    manualSaveRequestRef.current = saveRequestToken;
    handleSave();
  }, [saveRequestToken]);

  useEffect(() => {
    if (analysisAutoSaveTimerRef.current) {
      clearTimeout(analysisAutoSaveTimerRef.current);
    }

    if (!autoSaveEnabled || isValidated) {
      analysisAutoSaveReadyRef.current = false;
      return;
    }

    if (!analysisAutoSaveReadyRef.current) {
      analysisAutoSaveReadyRef.current = true;
      return;
    }

    analysisAutoSaveTimerRef.current = setTimeout(() => {
      handleSave({ silent: true });
    }, 1500);

    return () => {
      if (analysisAutoSaveTimerRef.current) {
        clearTimeout(analysisAutoSaveTimerRef.current);
      }
    };
  }, [autoSaveEnabled, isValidated, problem, categories, rootCauseText, actionPlans, preventiveControls]);

  const handleOpenWhiteboard = async () => {
    if (!onOpenWhiteboard || openingWhiteboard) return;

    setOpeningWhiteboard(true);
    setErrorMessage(null);
    try {
      await onOpenWhiteboard({ problem, categories, rootCauseText, actionPlans, preventiveControls });
    } catch (err: any) {
      console.error('Failed to open fishbone whiteboard:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to open the fishbone whiteboard.');
      showToast('Failed to open fishbone whiteboard', 'error');
    } finally {
      setOpeningWhiteboard(false);
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

  const getControlTypeColor = (_type: PreventiveControlItem['type']) =>
    'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200';

  // Generate AI Corrective Actions based on analyzed causes
  const generateAICorrectiveActions = async () => {
    setGeneratingCorrectiveActions(true);
    setCorrectiveActionsValidation(null);
    
    try {
      const analyzedCauses = getCorrectiveActionGenerationCauses();

      if (analyzedCauses.length === 0) {
        showToast('Analyze at least one likely root cause before generating actions', 'error');
        return;
      }
      
      const response = await api.post(`/rca/${rcaId}/ai/generate-corrective-actions`, {
        problem,
        analyzedCauses,
        existingActions: actionPlans,
        existingPreventiveControls: preventiveControls,
      });
      
      const result = response.data.data;
      const nextActionPlans = result.actionPlans;
      const nextPreventiveControls = result.preventiveControls || preventiveControls;

      setActionPlans(nextActionPlans);
      // Also set preventive controls if returned
      if (nextPreventiveControls) {
        setPreventiveControls(nextPreventiveControls);
        setShowPreventiveControls(nextPreventiveControls.length > 0);
      }
      setShowActionPlans(true);
      setShowCorrectiveActionsSection(true);
      setShowManualActionForm(false);
      
      await onSave({
        problem,
        categories,
        rootCauseText,
        actionPlans: nextActionPlans,
        preventiveControls: nextPreventiveControls,
      });

      // Broadcast to all team members
      console.log('🛠️ Broadcasting corrective actions update, incidentId:', incidentId);
      emitRCACorrectiveActionsUpdated(incidentId, rcaId, nextActionPlans, nextPreventiveControls || []);
      showToast('Corrective actions and preventive controls generated', 'success');
    } catch (err: any) {
      console.error('Failed to generate AI corrective actions:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to generate corrective actions. Please try again.');
      showToast('Failed to generate corrective actions', 'error');
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

  const getPriorityColor = (_priority: string) =>
    'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200';

  const getStatusColor = (_status: string) =>
    'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200';

  const totalCauses = categories.reduce((sum, cat) => sum + cat.causes.length, 0);

  const requestMethodChange = (method: RCAMethod) => {
    if (!onChangeMethod || method === currentMethod || savingMethod) return;

    if (totalCauses > 0) {
      setPendingMethodChange(method);
      return;
    }

    onChangeMethod(method);
  };

  const confirmMethodChange = () => {
    if (!pendingMethodChange || !onChangeMethod) return;
    const nextMethod = pendingMethodChange;
    setPendingMethodChange(null);
    onChangeMethod(nextMethod);
  };

  // Keep 6M category cards visually consistent; color does not encode meaning here.
  const getCategoryColor = (_index: number) => 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
  const getCategoryHeaderColor = (_index: number) => 'bg-blue-500';
  const manualFinalRootCauseAnswer = manualFiveWhysSteps.find(step => step.stepNumber === 5)?.answer.trim() || '';
  const manualAnalysisIsComplete = Boolean(manualFinalRootCauseAnswer);

  return (
    <div className="p-3 sm:p-6">
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            {sectionTitle}
          </h2>
          {activeTab === 'actions' && !isValidated && (
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Use Generate to create corrective actions and preventive controls from the analyzed root causes.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {!isValidated && onChangeMethod && activeTab === 'analysis' && (
            <fieldset className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <legend className="sr-only">Root cause analysis method</legend>
              {[
                { value: 'FIVE_WHYS' as const, label: '5 Whys' },
                { value: 'FISHBONE' as const, label: 'Fishbone' },
              ].map((option) => {
                const selected = currentMethod === option.value;
                return (
                  <label
                    key={option.value}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                    } ${savingMethod ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`rca-method-${rcaId}`}
                      value={option.value}
                      checked={selected}
                      disabled={savingMethod}
                      onChange={() => requestMethodChange(option.value)}
                      className="h-3.5 w-3.5 accent-blue-600"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </fieldset>
          )}
          {activeTab === 'actions' && !isValidated && (
            <>
              <button
                type="button"
                onClick={startManualCorrectiveActions}
                disabled={generatingCorrectiveActions}
                className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:bg-gray-900 dark:text-blue-200 dark:hover:bg-blue-900/30 sm:text-sm"
              >
                Create Manually
              </button>
              <button
                type="button"
                onClick={generateAICorrectiveActions}
                disabled={generatingCorrectiveActions}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                {generatingCorrectiveActions ? 'Generating...' : 'Generate'}
              </button>
            </>
          )}
          <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
            {totalCauses} causes identified
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      {!hideInternalTabs && (
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex space-x-1 min-w-max" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${
              activeTab === 'analysis'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-500 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="hidden xs:inline">Cause</span> <span>Analysis</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              {totalCauses}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${
              activeTab === 'diagram'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-500 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <span className="text-base sm:text-lg">🐟</span>
            <span className="hidden xs:inline">Fishbone</span> <span>Diagram</span>
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${
              activeTab === 'actions'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-500 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden xs:inline">Corrective</span> <span>Actions</span>
            {(actionPlans.immediate.length + actionPlans.shortTerm.length + actionPlans.longTerm.length) > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                {actionPlans.immediate.length + actionPlans.shortTerm.length + actionPlans.longTerm.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${
              activeTab === 'controls'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-500 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="hidden xs:inline">Preventive</span> <span>Controls</span>
            {preventiveControls.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                {preventiveControls.length}
              </span>
            )}
          </button>
        </nav>
      </div>
      )}

      {/* Enhanced AI Workflow Panel */}
      {showAIPanel && (
        <div className="mb-6 p-5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                  AI-Assisted Fishbone Analysis
                </h3>
                {aiAnalysisStartedBy && (
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    Started by {aiAnalysisStartedBy.firstName} {aiAnalysisStartedBy.lastName}
                  </p>
                )}
              </div>
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
            <LoadingState message="AI is analyzing if the problem is clear and actionable" title="Validating Problem Statement..." icon="search" color="purple" fullScreen={false} />
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
                          const newValue = e.target.value;
                          const updated = [...clarificationAnswers];
                          updated[idx] = newValue;
                          setClarificationAnswers(updated);
                          // Broadcast to other team members in real-time
                          console.log('📝 FishboneBuilder: onChange called, incidentId:', incidentId, 'rcaId:', rcaId, 'idx:', idx);
                          emitRCAClarificationAnswer(incidentId, rcaId, idx, newValue);
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
            <LoadingState message="AI is identifying potential causes across all 6M categories" title="Generating Fishbone Analysis..." icon="search" color="purple" fullScreen={false} />
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

      {(validatingCauseResolution || (showCauseResolutionResultModal && causeResolutionValidation)) && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-transparent pointer-events-none">
          <div
            ref={causeResolutionModalRef}
            style={isCauseResolutionModalReady ? {
              left: causeResolutionModalPosition.left,
              top: causeResolutionModalPosition.top,
              width: 'min(44rem, calc(100vw - 1.5rem))',
              maxHeight: 'min(40rem, calc(100dvh - 1.5rem))',
            } : {
              left: '50%',
              top: '50%',
              width: 'min(44rem, calc(100vw - 1.5rem))',
              maxHeight: 'min(40rem, calc(100dvh - 1.5rem))',
              transform: 'translate(-50%, -50%)',
            }}
            className={`pointer-events-auto fixed flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl shadow-gray-900/20 dark:border-gray-700 dark:bg-gray-800 ${
              isCauseResolutionModalDragging ? 'select-none' : ''
            }`}
          >
            <div
              className={`flex shrink-0 items-start justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700 ${
                isCauseResolutionModalDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              onPointerDown={handleCauseResolutionModalPointerDown}
              onPointerMove={handleCauseResolutionModalPointerMove}
              onPointerUp={handleCauseResolutionModalPointerUp}
              onPointerCancel={handleCauseResolutionModalPointerUp}
              style={{ touchAction: 'none' }}
            >
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Root Cause Review
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Review analyzed causes against the problem statement.
                </p>
              </div>
              {!validatingCauseResolution && (
                <button
                  type="button"
                  onClick={declineCauseResolutionValidation}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  aria-label="Close root cause review"
                >
                  X
                </button>
              )}
            </div>

            {validatingCauseResolution ? (
              <div className="flex min-h-[18rem] flex-col items-center justify-center px-6 py-8 text-center">
                <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
                  <div className="absolute h-16 w-16 animate-ping rounded-full bg-blue-200 opacity-40 dark:bg-blue-700" />
                  <Loader2 className="relative h-8 w-8 animate-spin text-blue-600 dark:text-blue-300" />
                </div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">Analyzing final root causes...</h4>
                <p className="mt-2 max-w-md text-sm leading-6 text-gray-600 dark:text-gray-300">
                  Reviewing the problem statement, incident details, evidence, and saved 5 Whys answers to identify the causes most likely to prevent recurrence.
                </p>
                <div className="mt-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
                </div>
              </div>
            ) : causeResolutionValidation && (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      {causeResolutionValidation.overallDecision}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-200">
                      {causeResolutionValidation.problemResolutionSummary}
                    </p>
                    {causeResolutionValidation.recommendedCombination && (
                      <p className="mt-2 text-xs leading-5 text-blue-800 dark:text-blue-200">
                        {causeResolutionValidation.recommendedCombination}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2">
                    {causeResolutionValidation.selections.map(selection => (
                      <div
                        key={selection.causeId}
                        className={`rounded-md border p-3 ${
                          selection.classification === 'likely'
                            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                            : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                        }`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className={`text-sm font-semibold text-gray-900 dark:text-white ${
                              selection.classification === 'unlikely' ? 'line-through decoration-yellow-700 decoration-2' : ''
                            }`}>
                              {selection.causeText}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {selection.categoryName} · {selection.confidence}% confidence
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            selection.classification === 'likely'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'
                          }`}>
                            {selection.classification === 'likely' ? 'Likely' : 'Not likely'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-gray-700 dark:text-gray-300">
                          {selection.reason}
                        </p>
                        {selection.implementationImpact && (
                          <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
                            {selection.implementationImpact}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {causeResolutionValidation.limitations.length > 0 && (
                    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-700/40">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Limitations</p>
                      <ul className="mt-1 space-y-1">
                        {causeResolutionValidation.limitations.map((item, index) => (
                          <li key={`${item}-${index}`} className="text-xs leading-5 text-gray-600 dark:text-gray-300">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={declineCauseResolutionValidation}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={acceptCauseResolutionValidation}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Accept
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cause 5 Whys Analysis Modal */}
      {selectedCauseForAnalysis && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-transparent pointer-events-none">
          <div
            ref={fiveWhysModalRef}
            style={isFiveWhysModalReady ? {
              left: fiveWhysModalPosition.left,
              top: fiveWhysModalPosition.top,
              width: 'min(60rem, calc(100vw - 1.5rem))',
              height: 'min(43rem, calc(100dvh - 1.5rem))',
              maxHeight: 'calc(100dvh - 1.5rem)',
            } : {
              left: '50%',
              top: '50%',
              width: 'min(60rem, calc(100vw - 1.5rem))',
              height: 'min(43rem, calc(100dvh - 1.5rem))',
              maxHeight: 'calc(100dvh - 1.5rem)',
              transform: 'translate(-50%, -50%)',
            }}
            className={`pointer-events-auto fixed flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl shadow-gray-900/20 dark:border-gray-700 dark:bg-gray-800 ${
              isFiveWhysModalDragging ? 'select-none' : ''
            }`}
          >
            {/* Auto-save toast notification */}
            {autoSaveToast.show && (
              <div className="absolute right-12 top-2 z-50 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white shadow-lg">
                <span>{autoSaveToast.message}</span>
              </div>
            )}

            <div
              className={`flex shrink-0 items-start justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700 ${
                isFiveWhysModalDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              onPointerDown={handleFiveWhysModalPointerDown}
              onPointerMove={handleFiveWhysModalPointerMove}
              onPointerUp={handleFiveWhysModalPointerUp}
              onPointerCancel={handleFiveWhysModalPointerUp}
              style={{ touchAction: 'none' }}
            >
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  5 Whys Analysis: {selectedCauseForAnalysis.categoryName}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Manual cause review
                </p>
              </div>
              <button
                type="button"
                onClick={closeFiveWhysModal}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                aria-label="Close 5 Whys analysis"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
              <div className="mb-3 rounded-md bg-gray-50 p-2 dark:bg-gray-700/60">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Analyzing Cause</span>
                <p className="mt-0.5 text-sm font-medium leading-5 text-gray-900 dark:text-white">{selectedCauseForAnalysis.text}</p>
              </div>

            {/* Manual Analysis Mode */}
            {fiveWhysMode === 'manual' && (
              <div className="space-y-2">
                {/* Validating spinner */}
                {validatingManualAnalysis && (
                  <LoadingState message="Validating your analysis..." icon="search" color="blue" fullScreen={false} />
                )}

                {/* Manual 5 Whys Steps */}
                {!validatingManualAnalysis && (
                  <>
                    <div className="space-y-2">
                      {manualFiveWhysSteps.map((step) => {
                        const issue = manualAnalysisValidation?.issues.find(i => i.stepNumber === step.stepNumber);
                        const stepValidation = manualStepValidations[step.stepNumber];
                        const isValidatingStep = validatingManualStep === step.stepNumber;
                        const showStepValidate = Boolean(step.answer.trim());
                        return (
                          <div key={step.stepNumber} className={`rounded-md p-2 ${
                            issue 
                              ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' 
                              : 'bg-gray-50 dark:bg-gray-700/50'
                          }`}>
                            <div className="flex items-start gap-2">
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                                issue ? 'bg-amber-500' : 'bg-blue-600'
                              }`}>
                                {step.stepNumber}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{step.question}</p>
                                    {stepValidation && (
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        stepValidation.rating === 'ACCEPTED'
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200'
                                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
                                      }`}>
                                        {stepValidation.rating === 'ACCEPTED' ? 'Accepted' : 'Shallow'}
                                      </span>
                                    )}
                                  </div>
                                  {/* Typing indicator for this Why step */}
                                  {fiveWhysTypingIndicators[`why-${step.stepNumber}`] && (
                                    <span className="text-xs text-blue-500 dark:text-blue-400 flex items-center animate-pulse">
                                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-bounce"></span>
                                      {fiveWhysTypingIndicators[`why-${step.stepNumber}`].userName} is typing...
                                    </span>
                                  )}
                                </div>
                                <div className="relative mt-1">
                                  <textarea
                                    value={step.answer}
                                    onFocus={() => refreshManualQuestionFromPreviousAnswer(step.stepNumber)}
                                    onChange={(e) => updateManualStep(step.stepNumber, e.target.value)}
                                    placeholder="Enter your answer..."
                                    rows={2}
                                    className={`w-full resize-y rounded border bg-white px-2 py-1 pr-24 text-xs text-gray-900 dark:bg-gray-700 dark:text-white ${
                                      fiveWhysTypingIndicators[`why-${step.stepNumber}`]
                                        ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-300 dark:ring-blue-600'
                                        : issue
                                          ? 'border-amber-300 dark:border-amber-600'
                                          : 'border-gray-300 dark:border-gray-600'
                                    } focus:outline-none focus:ring-1 focus:border-blue-500`}
                                  />
                                  {showStepValidate && (
                                    <button
                                      type="button"
                                      onClick={() => validateManualStepAnswer(step.stepNumber)}
                                      disabled={isValidatingStep}
                                      className="absolute bottom-2 right-2 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                                    >
                                      {isValidatingStep ? 'Checking...' : 'Validate'}
                                    </button>
                                  )}
                                </div>

                                {stepValidation && !stepValidation.feedbackDismissed && (
                                  <div className={`mt-2 rounded-md border p-2 ${
                                    stepValidation.rating === 'ACCEPTED'
                                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                                      : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                                  }`}>
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                      <p className="text-xs leading-5 text-gray-700 dark:text-gray-300">
                                        {stepValidation.feedback}
                                      </p>
                                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                                        {typeof stepValidation.score === 'number' && (
                                          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                                            {Math.round(stepValidation.score)}%
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => dismissManualStepValidationFeedback(step.stepNumber)}
                                          className="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold text-gray-500 transition-colors hover:bg-white/80 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                                          aria-label="Close validation feedback"
                                        >
                                          X
                                        </button>
                                      </div>
                                    </div>
                                    {stepValidation.suggestedAnswer && !stepValidation.suggestionDismissed && (
                                      <div className="mt-2 rounded border border-blue-200 bg-white p-2 dark:border-blue-800 dark:bg-gray-800">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                          Suggested Answer
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-gray-800 dark:text-gray-200">
                                          {stepValidation.suggestedAnswer}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            onClick={() => acceptManualStepSuggestion(step.stepNumber, stepValidation.suggestedAnswer!)}
                                            className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                                          >
                                            Accept
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => declineManualStepSuggestion(step.stepNumber)}
                                            className="rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                          >
                                            Decline
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
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
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-900/20">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label className="block text-xs font-medium text-blue-700 dark:text-blue-300">
                          Root Cause (Final Answer)
                        </label>
                      </div>
                      <textarea
                        value={manualFinalRootCauseAnswer}
                        readOnly
                        placeholder="The answer from Why 5 will appear here."
                        rows={2}
                        className="w-full cursor-default resize-y rounded border border-blue-300 bg-white/80 px-2 py-1 text-xs text-gray-800 focus:outline-none dark:border-blue-700 dark:bg-gray-700/80 dark:text-white"
                      />
                    </div>

                    {/* Spelling Corrections */}
                    {manualAnalysisValidation?.spellingCorrections && manualAnalysisValidation.spellingCorrections.length > 0 && (
                      <div className="rounded-md border border-yellow-200 bg-yellow-50 p-2 dark:border-yellow-700 dark:bg-yellow-900/20">
                        <p className="mb-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-300">Spelling corrections detected:</p>
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
                      <div className={`rounded-md p-2 ${
                        manualAnalysisValidation.isValid
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                          : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                      }`}>
                        <p className="text-xs leading-5 text-gray-700 dark:text-gray-300">{manualAnalysisValidation.overallFeedback}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* AI Analysis Mode */}
            {fiveWhysMode === 'ai' && (
              <>
                {analyzingCause ? (
                  <LoadingState message="Performing 5 Whys analysis..." icon="search" color="blue" fullScreen={false} />
                ) : validatingEdits ? (
                  <LoadingState message="Validating your edits..." icon="search" color="blue" fullScreen={false} />
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
                      <p className="text-xs text-blue-700 dark:text-blue-300">Suggested root cause:</p>
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
                  <div className="flex justify-between items-center pt-2">
                    {/* Left side - Back button */}
                    <button
                      onClick={saveAndGoBack}
                      disabled={isSavingFiveWhys}
                      className="px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg flex items-center space-x-2 disabled:opacity-50"
                    >
                      {isSavingFiveWhys && saveStatus === 'saving' ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                          </svg>
                          <span>Save & Back</span>
                        </>
                      )}
                    </button>
                    
                    {/* Right side - Save and Validate buttons */}
                    <div className="flex space-x-3">
                      <button
                        onClick={explicitSaveFiveWhys}
                        disabled={isSavingFiveWhys}
                        className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-300 ${
                          saveStatus === 'saved' 
                            ? 'bg-green-500 text-white' 
                            : saveStatus === 'error'
                            ? 'bg-red-600 text-white'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        } disabled:opacity-50`}
                      >
                        {saveStatus === 'saving' ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Saving...</span>
                          </>
                        ) : saveStatus === 'saved' ? (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Saved</span>
                          </>
                        ) : saveStatus === 'error' ? (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>Error</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            <span>Save</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={validateEditedFiveWhys}
                        disabled={validatingEdits || isSavingFiveWhys}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Validate Answers</span>
                      </button>
                    </div>
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
              <div className="py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                Manual analysis is ready.
              </div>
            )}
              </>
            )}
          </div>
          {fiveWhysMode === 'manual' && (
            <div className="flex shrink-0 justify-end border-t border-gray-200 px-3 py-2 dark:border-gray-700">
              <button
                type="button"
                onClick={() => handleManualCauseRecommendation('keep')}
                disabled={!manualAnalysisIsComplete}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Keep as Root Cause
              </button>
            </div>
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
          <div className="mb-4 sm:mb-8 p-3 sm:p-4 border-2 border-gray-400 dark:border-gray-500 rounded-lg bg-gray-100 dark:bg-gray-700">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
              Problem Statement (Effect)
            </label>
            <textarea
              value={problem}
              onChange={(e) => {
                handleProblemChange(e.target.value);
                // Auto-resize textarea
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onInput={(e) => {
                // Also handle input for initial load and paste events
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
              ref={(el) => {
                // Auto-resize on initial render
                if (el && problem) {
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
              disabled={isValidated}
              rows={2}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 resize-none overflow-hidden min-h-[50px] sm:min-h-[60px]"
              placeholder="Describe the problem or effect..."
            />
          </div>

          {/* Categories (Fish Bones) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-8">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className={`border-l-4 rounded-lg p-3 sm:p-4 ${getCategoryColor(index)}`}
              >
                {/* Category Header */}
                <div className={`-mx-3 sm:-mx-4 -mt-3 sm:-mt-4 mb-3 sm:mb-4 px-3 sm:px-4 py-1.5 sm:py-2 rounded-t-lg ${getCategoryHeaderColor(index)}`}>
                  <h3 className="text-sm sm:text-base font-medium text-white">{category.name}</h3>
                </div>

                {/* Causes List */}
                <div className="space-y-2 mb-4">
                  {category.causes.map((cause) => {
                    const resolutionSelection = getCauseResolutionSelection(cause);
                    const manualDraft = manualCauseResolutionDrafts[cause.id];
                    const activeClassification = manualDraft?.classification || resolutionSelection?.classification;
                    const isLikelyResolution = activeClassification === 'likely';
                    const isUnlikelyResolution = activeClassification === 'unlikely';
                    const canManuallyReviewCause = !isValidated && Boolean(cause.text.trim()) && isCauseReadyForManualResolution(cause);
                    const hasResolutionDecision = Boolean(resolutionSelection);
                    const showManualDecisionButtons = canManuallyReviewCause && !hasResolutionDecision && !manualDraft;
                    const showManualEditButton = canManuallyReviewCause && hasResolutionDecision && !manualDraft;
                    const showResolutionLabel = Boolean(resolutionSelection?.reason?.trim()) && !manualDraft;

                    return (
                      <div
                        key={cause.id}
                        className={`flex items-start justify-between rounded border p-2 transition-colors ${
                          isLikelyResolution
                            ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                            : isUnlikelyResolution
                              ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20'
                              : cause.aiSuggested
                                ? 'border-blue-200 bg-blue-100 dark:border-blue-600 dark:bg-blue-800/30'
                                : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-700'
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
                            <p className={`text-sm text-gray-900 dark:text-white ${isUnlikelyResolution ? 'line-through decoration-yellow-700 decoration-2' : ''}`}>{cause.text}</p>
                          ) : (
                            <input
                              type="text"
                              value={cause.text}
                              onChange={(e) => updateCause(category.id, cause.id, e.target.value)}
                              className={`w-full border-none bg-transparent p-0 text-sm text-gray-900 focus:ring-0 dark:text-white ${isUnlikelyResolution ? 'line-through decoration-yellow-700 decoration-2' : ''}`}
                            />
                          )}
                        </div>
                        <div className="mt-1 ml-4 flex flex-wrap items-center gap-2">
                          {cause.aiSuggested && (
                            <span className="text-xs text-blue-600 dark:text-blue-400">AI suggested</span>
                          )}
                          {/* 5 Whys Drill-down Button - Color coded based on analysis status */}
                          {!isValidated && cause.text && (
                            <button
                              onClick={() => analyzeCauseWithFiveWhys(cause, category.name)}
                              disabled={analyzingCause}
                              className={`text-xs flex items-center space-x-1 ${
                                causeAnalysisStatuses[cause.id]?.hasAnswers
                                  ? 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
                                  : 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
                              }`}
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {causeAnalysisStatuses[cause.id]?.hasAnswers ? (
                                  // Checkmark icon for analyzed
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                ) : (
                                  // Question mark icon for not analyzed
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                )}
                              </svg>
                              <span>5 Whys</span>
                              {causeAnalysisStatuses[cause.id]?.answerCount > 0 && (
                                <span className="text-[10px] bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-1 rounded">
                                  {causeAnalysisStatuses[cause.id].answerCount}/5
                                </span>
                              )}
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
                          {showResolutionLabel && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isLikelyResolution
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'
                            }`}>
                              {isLikelyResolution ? 'Likely root cause' : 'Not Likely'}
                            </span>
                          )}
                          {showManualDecisionButtons && (
                            <span className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startManualCauseResolution(cause, 'likely')}
                                className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 transition-colors hover:bg-green-100 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => startManualCauseResolution(cause, 'unlikely')}
                                className="rounded border border-yellow-200 bg-yellow-50 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800 transition-colors hover:bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200"
                              >
                                Decline
                              </button>
                            </span>
                          )}
                          {showManualEditButton && (
                            <button
                              type="button"
                              onClick={() => editManualCauseResolution(cause)}
                              className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        {resolutionSelection?.reason && !manualDraft && (
                          <p className={`mt-1 ml-4 text-xs leading-4 ${
                            isLikelyResolution ? 'text-green-700 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'
                          }`}>
                            {resolutionSelection.reason}
                          </p>
                        )}
                        {manualDraft && (
                          <div className={`mt-2 ml-4 rounded-md border p-2 ${
                            manualDraft.classification === 'likely'
                              ? 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                              : 'border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20'
                          }`}>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                Manual decision
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startManualCauseResolution(cause, 'likely')}
                                  className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                    manualDraft.classification === 'likely'
                                      ? 'bg-green-600 text-white'
                                      : 'border border-green-200 bg-white text-green-700 hover:bg-green-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-200'
                                  }`}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startManualCauseResolution(cause, 'unlikely')}
                                  className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                    manualDraft.classification === 'unlikely'
                                      ? 'bg-yellow-500 text-yellow-950'
                                      : 'border border-yellow-200 bg-white text-yellow-800 hover:bg-yellow-50 dark:border-yellow-700 dark:bg-gray-800 dark:text-yellow-200'
                                  }`}
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={manualDraft.reason}
                              onChange={(event) => updateManualCauseResolutionReason(cause.id, event.target.value)}
                              rows={2}
                              className="w-full resize-y rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                              placeholder={manualDraft.classification === 'likely'
                                ? 'Add why this cause is likely to resolve the problem.'
                                : 'Add why this cause is not likely to resolve the problem.'}
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => cancelManualCauseResolution(cause.id)}
                                disabled={savingManualCauseResolution === cause.id}
                                className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveManualCauseResolution(category, cause)}
                                disabled={!manualDraft.reason.trim() || savingManualCauseResolution === cause.id}
                                className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {savingManualCauseResolution === cause.id ? 'Saving...' : 'Save reason'}
                              </button>
                            </div>
                          </div>
                        )}
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
                    );
                  })}

                  {category.causes.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                      No causes added yet
                    </p>
                  )}
                </div>

                {/* Add Cause Input */}
                {!isValidated && (
                  <div className="space-y-2">
                    {/* Remote typing indicator - shows what other user is typing */}
                    {remoteTypingIndicators[category.id] && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded text-sm">
                        <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                          <svg className="w-3 h-3 animate-pulse flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="3" cy="10" r="2" />
                            <circle cx="10" cy="10" r="2" />
                            <circle cx="17" cy="10" r="2" />
                          </svg>
                          <span className="font-medium">{remoteTypingIndicators[category.id].userName} is typing:</span>
                        </div>
                        <p className="mt-1 text-gray-700 dark:text-gray-300 italic pl-5">
                          "{remoteTypingIndicators[category.id].text || '...'}"
                        </p>
                      </div>
                    )}
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newCauseInputs[category.id] || ''}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setNewCauseInputs((prev) => ({
                            ...prev,
                            [category.id]: newValue,
                          }));
                          // Broadcast typing to team members
                          emitRCACauseInputTyping(incidentId, rcaId, category.id, newValue);
                        }}
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
                  </div>
                )}
              </div>
            ))}
          </div>

          {!isValidated && (
            <div className="mb-4 flex flex-col gap-2 rounded-md border border-blue-200 bg-white p-3 shadow-sm dark:border-blue-800 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Validate analyzed root causes</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Review final 5 Whys answers and identify which causes are most likely to resolve the problem.
                  {analyzedFishboneCauseCount > 0 ? ` ${analyzedFishboneCauseCount} final answer${analyzedFishboneCauseCount === 1 ? '' : 's'} ready.` : ' Saved answers will be checked before the review starts.'}
                </p>
              </div>
              <button
                type="button"
                onClick={validateAnalyzedFishboneRootCauses}
                disabled={validatingCauseResolution || totalCauses === 0}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {validatingCauseResolution && <Loader2 size={14} className="animate-spin" />}
                {validatingCauseResolution ? 'Validating...' : 'Validate Root Causes'}
              </button>
            </div>
          )}
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
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                    {totalCauses} cause{totalCauses !== 1 ? 's' : ''} identified
                  </span>
                  {onOpenWhiteboard && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenWhiteboard();
                      }}
                      disabled={openingWhiteboard}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {openingWhiteboard ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      Whiteboard
                    </button>
                  )}
                </div>
              </div>
              
              {/* Fishbone SVG Diagram */}
              <div
                className={`bg-slate-100 rounded-lg p-4 overflow-x-auto ${onOpenWhiteboard ? 'cursor-pointer hover:ring-2 hover:ring-blue-200 transition-shadow' : ''}`}
                role={onOpenWhiteboard ? 'button' : undefined}
                tabIndex={onOpenWhiteboard ? 0 : undefined}
                onClick={onOpenWhiteboard ? handleOpenWhiteboard : undefined}
                onKeyDown={(event) => {
                  if (onOpenWhiteboard && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    handleOpenWhiteboard();
                  }
                }}
                title={onOpenWhiteboard ? 'Open this fishbone in the whiteboard' : undefined}
              >
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
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Validation Results
            </h4>
            <button
              onClick={() => setCorrectiveActionsValidation(null)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300"
            >
              Close
            </button>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-900/20">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-200">
                {correctiveActionsValidation.alignmentScore}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Alignment</div>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-900/20">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-200">
                {correctiveActionsValidation.effectivenessScore}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Effectiveness</div>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-900/20">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-200">
                {correctiveActionsValidation.feasibilityScore}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Feasibility</div>
            </div>
          </div>

          {/* Overall Assessment */}
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="flex items-start">
              <p className="text-sm text-blue-800 dark:text-blue-200">
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
                    className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-900/20"
                  >
                    <p className="font-medium text-blue-800 dark:text-blue-200">
                      {issue.issue}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {issue.suggestion}
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
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                Apply Refinements
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

      {!isValidated
        && totalCauses > 0
        && !showCorrectiveActionsSection
        && actionPlans.immediate.length === 0
        && actionPlans.shortTerm.length === 0
        && actionPlans.longTerm.length === 0 && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          Use Generate to create corrective actions and preventive controls from the analyzed root causes, or create corrective actions manually.
        </div>
      )}

      {/* Action Plans Section - Show always when there are actions (even when validated) */}
      {(showCorrectiveActionsSection || (actionPlans.immediate.length > 0 || actionPlans.shortTerm.length > 0 || actionPlans.longTerm.length > 0)) && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white">
              <span>Corrective Action Plans</span>
              {isValidated && (
                <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded-full">
                  Validated
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3">
              {!isValidated && (actionPlans.immediate.length > 0 || actionPlans.shortTerm.length > 0 || actionPlans.longTerm.length > 0) && (
                <button
                  onClick={validateCorrectiveActionsWithAI}
                  disabled={validatingCorrectiveActions}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {validatingCorrectiveActions ? 'Validating...' : 'Validate'}
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
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200">
                    Immediate Actions
                  </h4>
                  {!isValidated && (
                    <button
                      onClick={() => addActionItem('immediate')}
                      className="text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-200"
                    >
                      Add Action
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {actionPlans.immediate.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No immediate actions defined</p>
                  ) : (
                    actionPlans.immediate.map((item) => (
                      <div key={item.id} className="rounded-lg border border-blue-100 bg-white p-3 dark:border-blue-800 dark:bg-gray-800">
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
                                    <span className="font-medium text-red-500">{getDateError(item)}</span>
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
                              className="ml-2 text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-200"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Short-term Actions */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200">
                    Short-term Actions
                  </h4>
                  {!isValidated && (
                    <button
                      onClick={() => addActionItem('shortTerm')}
                      className="text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-200"
                    >
                      Add Action
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {actionPlans.shortTerm.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No short-term actions defined</p>
                  ) : (
                    actionPlans.shortTerm.map((item) => (
                      <div key={item.id} className="rounded-lg border border-blue-100 bg-white p-3 dark:border-blue-800 dark:bg-gray-800">
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
                                    <span className="font-medium text-red-500">{getDateError(item)}</span>
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
                              className="ml-2 text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-200"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Long-term Actions */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200">
                    Long-term Actions
                  </h4>
                  {!isValidated && (
                    <button
                      onClick={() => addActionItem('longTerm')}
                      className="text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-200"
                    >
                      Add Action
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {actionPlans.longTerm.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No long-term actions defined</p>
                  ) : (
                    actionPlans.longTerm.map((item) => (
                      <div key={item.id} className="rounded-lg border border-blue-100 bg-white p-3 dark:border-blue-800 dark:bg-gray-800">
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
                                    <span className="font-medium text-red-500">{getDateError(item)}</span>
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
                              className="ml-2 text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-200"
                            >
                              Remove
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
              <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white">
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
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700"
                  >
                    Add Control
                  </button>
                )}
              </div>
            </div>

            {/* Generate Controls Info */}
            {preventiveControls.length === 0 && !isValidated && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="flex items-start gap-3">
                  <div>
                    <h4 className="font-medium text-blue-800 dark:text-blue-200">Generate Controls</h4>
                    <p className="mt-1 text-sm text-blue-700 dark:text-blue-200">
                      Go to the "Corrective Actions" tab and click "Generate" to automatically create both corrective actions and preventive controls based on your analyzed root causes.
                    </p>
                    <button
                      onClick={() => setActiveTab('actions')}
                      className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700"
                    >
                      Go to Corrective Actions
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preventive Controls List */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="mb-4 text-sm text-blue-800 dark:text-blue-200">
                Preventive controls are systemic measures to prevent similar incidents from occurring in the future.
              </p>
              
              <div className="space-y-4">
                {preventiveControls.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">No preventive controls defined yet. Click "Add Control" or use Generate from the Corrective Actions tab.</p>
                ) : (
                  preventiveControls.map((control) => (
                    <div key={control.id} className="rounded-lg border border-blue-100 bg-white p-4 dark:border-blue-800 dark:bg-gray-800">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Control Type Badge */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getControlTypeColor(control.type)}`}>
                              {control.type.charAt(0).toUpperCase() + control.type.slice(1)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              control.status === 'implemented'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                                : control.status === 'in-progress'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
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
                              className="w-full border-b border-transparent bg-transparent text-sm font-medium text-gray-900 hover:border-gray-300 focus:border-blue-500 focus:outline-none dark:text-white dark:hover:border-gray-600"
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
                              className="w-full rounded border border-gray-200 bg-gray-50 p-2 text-sm text-gray-600 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
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
                            className="text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-200"
                          >
                            Remove
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
        showLocalSaveControls && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
          </div>
        )
      ) : (
        /* Re-open button for validated RCAs */
        onReopen && (
          <div className="flex justify-end space-x-4 mt-6">
            <div className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-300">
              <span>This RCA has been validated and locked</span>
            </div>
            <button
              onClick={handleReopen}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Re-opening...' : 'Re-open for Editing'}
            </button>
          </div>
        )
      )}

      {/* Problem Statement Override Confirmation Dialog */}
      {showProblemOverrideConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Override Problem Statement?
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Applying this suggested revision will <span className="font-semibold text-amber-600 dark:text-amber-400">replace your current problem statement</span>. This action cannot be undone.
            </p>
            <div className="mb-4 space-y-3">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Current Problem Statement:</p>
                <p className="text-sm text-red-800 dark:text-red-300">{problem}</p>
              </div>
              <div className="flex justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Suggested Revision:</p>
                <p className="text-sm text-green-800 dark:text-green-300">{problemValidation?.suggestedRevision}</p>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelProblemOverride}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Keep Current
              </button>
              <button
                onClick={confirmProblemOverride}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Apply Revision</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingMethodChange && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent px-4">
          <div className="w-full max-w-md rounded-lg border border-blue-200 bg-white shadow-2xl dark:border-blue-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Switch Methodology?
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                You are switching from {currentMethod === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone'} to {pendingMethodChange === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone'}.
              </p>
            </div>
            <div className="px-4 py-4">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                All entered causes and analysis will be lost if you continue.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setPendingMethodChange(null)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMethodChange}
                disabled={savingMethod}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                Proceed
              </button>
            </div>
          </div>
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
