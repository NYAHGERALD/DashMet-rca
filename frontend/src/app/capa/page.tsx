/**
 * Phase 9 & 10: CAPA Board Page
 * Corrective & Preventive Action Management Dashboard
 * Enterprise-Grade with Audit Trail
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/dateUtils';
import PowerPointGenerator from '@/components/powerpoint';
import { SavedReportsModal } from '@/components/powerpoint/SavedReportsList';
import { usePrivileges, CAPA_PRIVILEGES } from '@/lib/usePrivileges';
import { useAccessDeniedModal, handlePrivilegeError } from '@/components/modals/AccessDeniedModal';

type ActionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'INEFFECTIVE';
type ActionType = 'CORRECTIVE' | 'PREVENTIVE';
type ActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface CAPAction {
  id: string;
  actionType: ActionType;
  title: string;
  description: string;
  status: ActionStatus;
  priority: ActionPriority;
  dueDate: string;
  completedAt: string | null;
  startedAt: string | null;
  verifiedAt: string | null;
  implementationPlan: string | null;
  implementationNotes: string | null;
  completionEvidence: string | null;
  completionNotes: string | null;
  verificationNotes: string | null;
  effectivenessScore: number | null;
  isEffective: boolean | null;
  recurrenceDetected: boolean;
  aiQualityScore: number | null;
  aiWeaknessFlags: string[];
  regulatoryTags: string[];
  resourceImpact: string | null;
  createdAt: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  rcaAnalysis: {
    id: string;
    status: string;
    incident: {
      id: string;
      incidentNumber?: string;
      title: string;
      type: string;
    };
  };
}

interface AuditLogEntry {
  id: string;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  notes: string | null;
  evidence: string | null;
  performedByName: string;
  performedAt: string;
}

interface CAPAStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
  effectiveness: {
    reviewed: number;
    effective: number;
    rate: number;
    avgScore: number;
  };
}

const statusColors: Record<ActionStatus, string> = {
  PLANNED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  VERIFIED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  INEFFECTIVE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const priorityColors: Record<ActionPriority, string> = {
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

type ImplementationPlanDetail = {
  label: string;
  value: string;
};

type ImplementationPlanStep = {
  title: string;
  details: ImplementationPlanDetail[];
  paragraphs: string[];
};

const implementationPlanDetailLabels = [
  'Estimated Time',
  'Responsible',
  'Due Date',
  'Ownership',
  'Verification',
  'Notes',
  'Resources Needed',
  'Documentation Requirements',
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseInlinePlanText = (value: string) => (
  value
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
);

const parseImplementationPlanDetails = (text: string) => {
  const labelsPattern = implementationPlanDetailLabels.map(escapeRegExp).join('|');
  const detailPattern = new RegExp(
    `(?:^|\\s[-–—]\\s+)(${labelsPattern}):\\s*([\\s\\S]*?)(?=\\s[-–—]\\s+(?:${labelsPattern}):|$)`,
    'gi'
  );
  const details: ImplementationPlanDetail[] = [];
  const matches = Array.from(text.matchAll(detailPattern));

  matches.forEach((match) => {
    const label = parseInlinePlanText(match[1]);
    const value = parseInlinePlanText(match[2]);
    if (label && value) {
      details.push({ label, value });
    }
  });

  return details;
};

const parseImplementationPlanSteps = (text: string): ImplementationPlanStep[] => {
  const normalized = text
    .replace(/\r/g, '')
    .replace(/^Implementation Plan:\s*/i, '')
    .replace(/\s+(\*\*Step\s+\d+\s*:)/gi, '\n$1')
    .replace(/\s+(Step\s+\d+\s*:)/gi, '\n$1')
    .trim();

  return normalized
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const boldStepMatch = block.match(/^\*\*(Step\s+\d+\s*:\s*.+?)\*\*\s*(.*)$/i);
      const plainStepPattern = new RegExp(
        `^(Step\\s+\\d+\\s*:\\s*.*?)(?=\\s[-–—]\\s+(?:${implementationPlanDetailLabels.map(escapeRegExp).join('|')}):|$)([\\s\\S]*)$`,
        'i'
      );
      const plainStepMatch = block.match(plainStepPattern);

      if (!boldStepMatch && !plainStepMatch) {
        return {
          title: '',
          details: [],
          paragraphs: [parseInlinePlanText(block)],
        };
      }

      const title = parseInlinePlanText((boldStepMatch || plainStepMatch)?.[1] || '');
      const remainingText = ((boldStepMatch || plainStepMatch)?.[2] || '').replace(/^[-–—]\s*/, '').trim();
      const details = parseImplementationPlanDetails(remainingText);
      const paragraphs = details.length === 0 && remainingText ? [parseInlinePlanText(remainingText)] : [];

      return {
        title,
        details,
        paragraphs,
      };
    })
    .filter((step) => step.title || step.details.length > 0 || step.paragraphs.some(Boolean));
};

function formatImplementationPlanForDetails(text: string) {
  const steps = parseImplementationPlanSteps(text);

  if (steps.length === 0) {
    return (
      <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
        {parseInlinePlanText(text)}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {steps.map((step, index) => (
        <section key={`${step.title}-${index}`} className="space-y-3">
          {step.title && (
            <h4 className="text-sm font-semibold leading-6 text-gray-950 dark:text-white sm:text-base">
              {step.title}
            </h4>
          )}
          {step.paragraphs.map((paragraph, paragraphIndex) => (
            <p key={`${step.title}-p-${paragraphIndex}`} className="text-sm leading-6 text-gray-700 dark:text-gray-300">
              {paragraph}
            </p>
          ))}
          {step.details.length > 0 && (
            <ul className="ml-5 list-disc space-y-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
              {step.details.map((detail) => (
                <li key={`${step.title}-${detail.label}`}>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{detail.label}:</span>{' '}
                  <span>{detail.value}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function CAPAContent() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Privilege-based access control
  const { hasPrivilege } = usePrivileges();
  const canEditCAPA = hasPrivilege(CAPA_PRIVILEGES.EDIT);
  const { showAccessDenied, accessDeniedModal } = useAccessDeniedModal();
  
  const [actions, setActions] = useState<CAPAction[]>([]);
  const [stats, setStats] = useState<CAPAStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<ActionStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<ActionPriority | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<ActionType | 'ALL'>('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  
  // Expanded RCA groups state
  const [expandedRCAs, setExpandedRCAs] = useState<Set<string>>(new Set());
  
  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<CAPAction | null>(null);
  const [qualityAnalysis, setQualityAnalysis] = useState<any>(null);
  const [analyzingQuality, setAnalyzingQuality] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loadingAuditLog, setLoadingAuditLog] = useState(false);

  // Saved reports modal
  const [showSavedReportsModal, setShowSavedReportsModal] = useState(false);
  const [savedReportsRcaId, setSavedReportsRcaId] = useState<string>('');
  const [savedReportsIncidentNumber, setSavedReportsIncidentNumber] = useState<string>('');

  // Enterprise workflow modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showIneffectiveModal, setShowIneffectiveModal] = useState(false);
  const [showEffectivenessModal, setShowEffectivenessModal] = useState(false);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [workflowAction, setWorkflowAction] = useState<CAPAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [implementationPlan, setImplementationPlan] = useState('');
  const [implementationNotes, setImplementationNotes] = useState('');
  const [targetDueDate, setTargetDueDate] = useState('');
  const [completionEvidence, setCompletionEvidence] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [ineffectiveNotes, setIneffectiveNotes] = useState('');

  // Effectiveness Review states
  const [effectivenessScore, setEffectivenessScore] = useState(80);
  const [isEffective, setIsEffective] = useState(true);
  const [effectivenessNotes, setEffectivenessNotes] = useState('');

  // Recurrence states
  const [recurrenceData, setRecurrenceData] = useState<{
    hasRecurrence: boolean;
    similarIncidentCount: number;
    similarIncidents: any[];
    message: string;
  } | null>(null);
  const [checkingRecurrence, setCheckingRecurrence] = useState(false);

  // AI-related states
  const [generatingAIPlan, setGeneratingAIPlan] = useState(false);
  const [validatingPlan, setValidatingPlan] = useState(false);
  const [planValidation, setPlanValidation] = useState<{
    score: number;
    verdict: 'APPROVED' | 'NEEDS_REVISION' | 'INSUFFICIENT';
    strengths: string[];
    gaps: string[];
    suggestions: string[];
    complianceNotes: string[];
    summary: string;
  } | null>(null);
  const [planEdited, setPlanEdited] = useState(false);

  // Helper functions - defined early so they can be used in grouping
  const isOverdue = (action: CAPAction) => {
    return new Date(action.dueDate) < new Date() && 
           !['COMPLETED', 'VERIFIED'].includes(action.status);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter, typeFilter, overdueOnly]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (typeFilter !== 'ALL') params.append('actionType', typeFilter);
      if (overdueOnly) params.append('overdueOnly', 'true');

      const [actionsRes, statsRes] = await Promise.all([
        api.get(`/capa?${params.toString()}`),
        api.get('/capa/stats'),
      ]);

      // Transform backend response to match frontend types
      const transformedActions = actionsRes.data.data.actions.map((action: any) => ({
        ...action,
        owner: action.User || action.owner,
        rcaAnalysis: action.RCAAnalysis ? {
          id: action.RCAAnalysis.id,
          status: action.RCAAnalysis.status,
          incident: action.RCAAnalysis.Incident ? {
            id: action.RCAAnalysis.Incident.id,
            incidentNumber: action.RCAAnalysis.Incident.incidentNumber || `INC-${action.RCAAnalysis.Incident.id.slice(0, 8)}`,
            title: action.RCAAnalysis.Incident.customTitle || action.RCAAnalysis.Incident.incidentNumber || `Incident ${action.RCAAnalysis.Incident.id.slice(0, 8)}`,
            type: action.RCAAnalysis.Incident.type,
          } : null,
        } : action.rcaAnalysis,
      }));

      setActions(transformedActions);
      setStats(statsRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load CAPA data');
    } finally {
      setLoading(false);
    }
  };

  // Group actions by their RCA
  interface GroupedRCA {
    rcaId: string;
    incidentId: string;
    incidentNumber: string;
    incidentTitle: string;
    incidentType: string;
    rcaStatus: string;
    actions: CAPAction[];
    totalActions: number;
    completedActions: number;
    overdueActions: number;
  }

  const groupActionsByRCA = (): GroupedRCA[] => {
    const groups: Record<string, GroupedRCA> = {};
    
    actions.forEach((action) => {
      // Skip actions without rcaAnalysis
      if (!action.rcaAnalysis) return;
      
      const rcaId = action.rcaAnalysis.id;
      if (!groups[rcaId]) {
        groups[rcaId] = {
          rcaId,
          incidentId: action.rcaAnalysis.incident?.id || '',
          incidentNumber: action.rcaAnalysis.incident?.incidentNumber || action.rcaAnalysis.incident?.title || `INC-${action.rcaAnalysis.incident?.id?.slice(0, 8) || 'Unknown'}`,
          incidentTitle: action.rcaAnalysis.incident?.title || `Incident ${action.rcaAnalysis.incident?.id?.slice(0, 8) || 'Unknown'}`,
          incidentType: action.rcaAnalysis.incident?.type || 'Unknown',
          rcaStatus: action.rcaAnalysis.status,
          actions: [],
          totalActions: 0,
          completedActions: 0,
          overdueActions: 0,
        };
      }
      groups[rcaId].actions.push(action);
      groups[rcaId].totalActions++;
      if (['COMPLETED', 'VERIFIED'].includes(action.status)) {
        groups[rcaId].completedActions++;
      }
      if (isOverdue(action)) {
        groups[rcaId].overdueActions++;
      }
    });

    return Object.values(groups);
  };

  const toggleRCAGroup = (rcaId: string) => {
    setExpandedRCAs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rcaId)) {
        newSet.delete(rcaId);
      } else {
        newSet.add(rcaId);
      }
      return newSet;
    });
  };

  const expandAllGroups = () => {
    const allRcaIds = groupActionsByRCA().map((g) => g.rcaId);
    setExpandedRCAs(new Set(allRcaIds));
  };

  const collapseAllGroups = () => {
    setExpandedRCAs(new Set());
  };

  const handleStatusChange = async (actionId: string, newStatus: ActionStatus) => {
    try {
      await api.patch(`/capa/${actionId}/status`, { status: newStatus });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  // Enterprise workflow handlers
  const openStartModal = (action: CAPAction) => {
    // Navigate to full-page implementation plan editor
    router.push(`/capa/start/${action.id}`);
  };

  // AI Implementation Plan Generation
  const generateAIPlan = async () => {
    if (!workflowAction) return;
    
    setGeneratingAIPlan(true);
    setPlanValidation(null);
    setPlanEdited(false);
    
    try {
      const response = await api.post(`/capa/${workflowAction.id}/generate-implementation-plan`);
      const generatedPlan = response.data.data.implementationPlan;
      setImplementationPlan(generatedPlan);
    } catch (err: any) {
      // If AI fails, check for fallback plan
      if (err.response?.data?.fallbackPlan) {
        setImplementationPlan(err.response.data.fallbackPlan);
      } else {
        setError(err.response?.data?.error || 'Failed to generate AI plan. Please write manually.');
      }
    } finally {
      setGeneratingAIPlan(false);
    }
  };

  // AI Plan Validation
  const validatePlan = async () => {
    if (!workflowAction || !implementationPlan.trim()) return;
    
    setValidatingPlan(true);
    
    try {
      const response = await api.post(`/capa/${workflowAction.id}/validate-implementation-plan`, {
        implementationPlan,
      });
      setPlanValidation(response.data.data.validation);
      setPlanEdited(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to validate plan');
    } finally {
      setValidatingPlan(false);
    }
  };

  // Track plan edits
  const handlePlanChange = (value: string) => {
    setImplementationPlan(value);
    if (planValidation) {
      setPlanEdited(true);
    }
  };

  const openCompleteModal = (action: CAPAction) => {
    // Navigate to full-width complete page instead of modal
    router.push(`/capa/complete/${action.id}`);
  };

  const openVerifyModal = (action: CAPAction) => {
    setWorkflowAction(action);
    setVerificationNotes('');
    setShowVerifyModal(true);
  };

  const openIneffectiveModal = (action: CAPAction) => {
    setWorkflowAction(action);
    setIneffectiveNotes('');
    setShowIneffectiveModal(true);
  };

  const handleStartAction = async () => {
    if (!workflowAction) return;
    if (!canEditCAPA) {
      showAccessDenied();
      return;
    }
    if (!implementationPlan.trim()) {
      setError('Implementation plan is required to start an action');
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/capa/${workflowAction.id}/status`, {
        status: 'IN_PROGRESS',
        implementationPlan,
        implementationNotes,
        targetDueDate: targetDueDate || undefined,
      });
      setShowStartModal(false);
      setWorkflowAction(null);
      loadData();
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Start Action');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteAction = async () => {
    if (!workflowAction) return;
    if (!canEditCAPA) {
      showAccessDenied();
      return;
    }
    if (!completionEvidence.trim() && !completionNotes.trim()) {
      setError('Completion evidence or notes required');
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/capa/${workflowAction.id}/status`, {
        status: 'COMPLETED',
        completionEvidence,
        completionNotes,
      });
      setShowCompleteModal(false);
      setWorkflowAction(null);
      loadData();
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Complete Action');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAction = async () => {
    if (!workflowAction) return;
    if (!canEditCAPA) {
      showAccessDenied();
      return;
    }
    if (!verificationNotes.trim()) {
      setError('Verification notes required');
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/capa/${workflowAction.id}/status`, {
        status: 'VERIFIED',
        verificationNotes,
      });
      setShowVerifyModal(false);
      setWorkflowAction(null);
      loadData();
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Verify Action');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkIneffective = async () => {
    if (!workflowAction) return;
    if (!canEditCAPA) {
      showAccessDenied();
      return;
    }
    if (!ineffectiveNotes.trim()) {
      setError('Explanation notes required for ineffective actions');
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/capa/${workflowAction.id}/status`, {
        status: 'INEFFECTIVE',
        notes: ineffectiveNotes,
      });
      setShowIneffectiveModal(false);
      setWorkflowAction(null);
      loadData();
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Mark Ineffective');
    } finally {
      setSubmitting(false);
    }
  };

  const loadAuditLog = async (actionId: string) => {
    setLoadingAuditLog(true);
    try {
      const response = await api.get(`/capa/${actionId}/audit-log`);
      setAuditLog(response.data.data.auditLogs);
    } catch (err: any) {
      console.error('Failed to load audit log:', err);
      setAuditLog([]);
    } finally {
      setLoadingAuditLog(false);
    }
  };

  const openDetails = (action: CAPAction) => {
    setSelectedAction(action);
    setQualityAnalysis(null);
    setAuditLog([]);
    setShowDetailsModal(true);
    loadAuditLog(action.id);
  };

  const analyzeQuality = async () => {
    if (!selectedAction) return;
    
    setAnalyzingQuality(true);
    try {
      const response = await api.post(`/capa/${selectedAction.id}/analyze-quality`);
      setQualityAnalysis(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Quality analysis failed');
    } finally {
      setAnalyzingQuality(false);
    }
  };

  // Phase 10.3: Effectiveness Review with AI
  const openEffectivenessReview = (action: CAPAction) => {
    setWorkflowAction(action);
    setEffectivenessScore(80);
    setIsEffective(true);
    setEffectivenessNotes('');
    setShowEffectivenessModal(true);
  };

  const handleEffectivenessReview = async () => {
    if (!workflowAction) return;
    if (!canEditCAPA) {
      showAccessDenied();
      return;
    }
    if (!effectivenessNotes.trim()) {
      setError('Effectiveness review notes are required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/capa/${workflowAction.id}/effectiveness-review`, {
        effectivenessScore,
        isEffective,
        notes: effectivenessNotes,
      });

      if (response.data.success) {
        setShowEffectivenessModal(false);
        setWorkflowAction(null);
        loadData();
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        showAccessDenied();
      } else {
        setError(err.response?.data?.error || 'Effectiveness review failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Phase 10.4: Recurrence Detection
  const checkRecurrence = async (action: CAPAction) => {
    setWorkflowAction(action);
    setRecurrenceData(null);
    setCheckingRecurrence(true);
    setShowRecurrenceModal(true);

    try {
      const response = await api.get(`/capa/${action.id}/recurrence-check`);
      setRecurrenceData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Recurrence check failed');
      setRecurrenceData({
        hasRecurrence: false,
        similarIncidentCount: 0,
        similarIncidents: [],
        message: 'Failed to check for recurrence',
      });
    } finally {
      setCheckingRecurrence(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="relative w-7 h-7 sm:w-8 sm:h-8">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <Link href="/dashboard" className="text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                ← <span className="hidden xs:inline">Back</span>
              </Link>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                CAPA Board
              </h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate max-w-[100px] sm:max-w-none">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 sm:ml-4 text-xs sm:text-sm underline">Dismiss</button>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Actions</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">In Progress</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.byStatus['IN_PROGRESS'] || 0}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Overdue</div>
              <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Completed</div>
              <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.byStatus['COMPLETED'] || 0}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 col-span-2 sm:col-span-1">
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Effectiveness Rate</div>
              <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.effectiveness.rate.toFixed(0)}%</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-4 items-center overflow-x-auto pb-2 sm:pb-0">
            <div className="min-w-[100px] sm:min-w-0">
              <label className="block text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ActionStatus | 'ALL')}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="VERIFIED">Verified</option>
                <option value="INEFFECTIVE">Ineffective</option>
              </select>
            </div>
            <div className="min-w-[100px] sm:min-w-0">
              <label className="block text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as ActionPriority | 'ALL')}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="min-w-[80px] sm:min-w-0">
              <label className="block text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ActionType | 'ALL')}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm"
              >
                <option value="ALL">All Types</option>
                <option value="CORRECTIVE">Corrective</option>
                <option value="PREVENTIVE">Preventive</option>
              </select>
            </div>
            <div className="flex items-center mt-4 sm:mt-5 whitespace-nowrap">
              <input
                type="checkbox"
                id="overdueOnly"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
                className="mr-1.5 sm:mr-2 w-4 h-4"
              />
              <label htmlFor="overdueOnly" className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                Overdue Only
              </label>
            </div>
          </div>
        </div>

        {/* Actions Table - Grouped by RCA */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
              Loading CAPA actions...
            </div>
          ) : actions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No CAPA actions found
            </div>
          ) : (
            <div>
              {/* Expand/Collapse All Controls */}
              <div className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {groupActionsByRCA().length} RCA{groupActionsByRCA().length !== 1 ? 's' : ''} with {actions.length} action{actions.length !== 1 ? 's' : ''}
                </div>
                <div className="flex gap-1 sm:gap-2">
                  <button
                    onClick={expandAllGroups}
                    className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAllGroups}
                    className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Grouped RCA Actions */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {groupActionsByRCA().map((group) => (
                  <div key={group.rcaId} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                    {/* RCA Group Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                      {/* Clickable expand/collapse section */}
                      <button
                        onClick={() => toggleRCAGroup(group.rcaId)}
                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 text-left"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <span className={`transform transition-transform duration-200 text-sm ${expandedRCAs.has(group.rcaId) ? 'rotate-90' : ''}`}>
                            ▶
                          </span>
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 min-w-0">
                            <span className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded whitespace-nowrap ${
                              group.incidentType === 'FOOD_SAFETY'
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
                                : group.incidentType === 'WORKPLACE_SAFETY'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                            }`}>
                              {group.incidentType === 'FOOD_SAFETY' ? '🍽️ Food Safety' 
                                : group.incidentType === 'WORKPLACE_SAFETY' ? '🦺 Workplace Safety' 
                                : '⚙️ Machine'}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[200px] sm:max-w-none">
                              {group.incidentTitle}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm ml-6 sm:ml-0">
                          <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {group.completedActions}/{group.totalActions} <span className="hidden sm:inline">completed</span>
                          </span>
                          {group.overdueActions > 0 && (
                            <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 whitespace-nowrap">
                              {group.overdueActions} overdue
                            </span>
                          )}
                          <span className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded whitespace-nowrap ${
                            group.rcaStatus === 'VALIDATED' || group.rcaStatus === 'CLOSED'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                          }`}>
                            <span className="hidden sm:inline">RCA: </span>{group.rcaStatus}
                          </span>
                        </div>
                      </button>
                      
                      {/* PowerPoint Buttons */}
                      <div className="px-3 sm:pr-4 pb-2 sm:pb-0 flex items-center gap-2 ml-6 sm:ml-0">
                        {/* View Saved Reports Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSavedReportsRcaId(group.rcaId);
                            setSavedReportsIncidentNumber(group.incidentNumber);
                            setShowSavedReportsModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors touch-manipulation shadow-sm border border-blue-200 dark:border-blue-800"
                          title="View Saved PowerPoint Reports"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          <span>Saved</span>
                        </button>
                        
                        {/* Generate PowerPoint Button */}
                        <PowerPointGenerator
                          rcaId={group.rcaId}
                          incidentNumber={group.incidentNumber}
                        >
                          {(triggerGenerate) => (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerGenerate();
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 rounded-lg transition-colors touch-manipulation shadow-sm border border-orange-200 dark:border-orange-800"
                              title="Generate RCA PowerPoint Report"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>Generate</span>
                            </button>
                          )}
                        </PowerPointGenerator>
                      </div>
                    </div>

                    {/* Expanded Actions - Card layout on mobile, Table on desktop */}
                    {expandedRCAs.has(group.rcaId) && (
                      <>
                        {/* Mobile Card Layout */}
                        <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                          {group.actions.map((action) => (
                            <div key={action.id} className={`p-3 ${isOverdue(action) ? 'bg-red-50 dark:bg-red-900/10' : 'bg-white dark:bg-gray-800'}`}>
                              {/* Card Header */}
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                    action.actionType === 'CORRECTIVE' 
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  }`}>
                                    {action.actionType === 'CORRECTIVE' ? 'C' : 'P'}
                                  </span>
                                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${priorityColors[action.priority]}`}>
                                    {action.priority}
                                  </span>
                                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${statusColors[action.status]}`}>
                                    {action.status.replace('_', ' ')}
                                  </span>
                                </div>
                                {action.aiQualityScore !== null && (
                                  <div className={`text-xs font-medium ${
                                    action.aiQualityScore >= 80 ? 'text-green-600' :
                                    action.aiQualityScore >= 60 ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {action.aiQualityScore}%
                                  </div>
                                )}
                              </div>
                              
                              {/* Title */}
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                {action.title}
                              </h4>
                              
                              {/* Meta Info */}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-3">
                                <span>👤 {action.owner.firstName} {action.owner.lastName}</span>
                                <span className={isOverdue(action) ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                                  📅 {formatDate(action.dueDate)}{isOverdue(action) && ' ⚠️'}
                                </span>
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => openDetails(action)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-400 rounded touch-manipulation"
                                >
                                  View
                                </button>
                                {action.status === 'PLANNED' && (
                                  <button
                                    onClick={() => openStartModal(action)}
                                    className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded touch-manipulation"
                                  >
                                    Start
                                  </button>
                                )}
                                {action.status === 'IN_PROGRESS' && (
                                  <button
                                    onClick={() => openCompleteModal(action)}
                                    className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded touch-manipulation"
                                  >
                                    Continue
                                  </button>
                                )}
                                {action.status === 'COMPLETED' && (
                                  <button
                                    onClick={() => openVerifyModal(action)}
                                    className="px-2.5 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/20 rounded touch-manipulation"
                                  >
                                    Verify
                                  </button>
                                )}
                                {action.status === 'VERIFIED' && (
                                  <>
                                    <button
                                      onClick={() => openEffectivenessReview(action)}
                                      className="px-2.5 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/20 rounded touch-manipulation"
                                    >
                                      Review
                                    </button>
                                    <button
                                      onClick={() => checkRecurrence(action)}
                                      className="px-2.5 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 rounded touch-manipulation"
                                    >
                                      Recurrence
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Desktop Table Layout */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Owner</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quality</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                              {group.actions.map((action) => (
                                <tr key={action.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isOverdue(action) ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                                      action.actionType === 'CORRECTIVE' 
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                    }`}>
                                      {action.actionType === 'CORRECTIVE' ? 'C' : 'P'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                                      {action.title}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded ${priorityColors[action.priority]}`}>
                                      {action.priority}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[action.status]}`}>
                                      {action.status.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                    {action.owner.firstName} {action.owner.lastName}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className={`text-sm ${isOverdue(action) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                                      {formatDate(action.dueDate)}
                                      {isOverdue(action) && <span className="ml-1">⚠️</span>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {action.aiQualityScore !== null ? (
                                      <div className={`text-sm font-medium ${
                                        action.aiQualityScore >= 80 ? 'text-green-600' :
                                        action.aiQualityScore >= 60 ? 'text-yellow-600' :
                                        'text-red-600'
                                      }`}>
                                        {action.aiQualityScore}%
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => openDetails(action)}
                                        className="text-primary-600 hover:text-primary-800 dark:text-primary-400 text-sm"
                                      >
                                        View
                                      </button>
                                      {action.status === 'PLANNED' && (
                                        <button
                                          onClick={() => openStartModal(action)}
                                          className="text-blue-600 hover:text-blue-800 text-sm"
                                        >
                                          Start
                                        </button>
                                      )}
                                      {action.status === 'IN_PROGRESS' && (
                                        <button
                                          onClick={() => openCompleteModal(action)}
                                          className="text-blue-600 hover:text-blue-800 text-sm"
                                        >
                                          Continue
                                        </button>
                                      )}
                                      {action.status === 'COMPLETED' && (
                                        <button
                                          onClick={() => openVerifyModal(action)}
                                          className="text-purple-600 hover:text-purple-800 text-sm"
                                        >
                                          Verify
                                        </button>
                                      )}
                                      {action.status === 'VERIFIED' && (
                                        <>
                                          <button
                                            onClick={() => openEffectivenessReview(action)}
                                            className="text-purple-600 hover:text-purple-800 text-sm"
                                          >
                                            Review
                                          </button>
                                          <button
                                            onClick={() => checkRecurrence(action)}
                                            className="text-orange-600 hover:text-orange-800 text-sm"
                                          >
                                            Recurrence
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div className="pr-4">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                      {selectedAction.title}
                    </h2>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded ${
                        selectedAction.actionType === 'CORRECTIVE'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        {selectedAction.actionType}
                      </span>
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded ${priorityColors[selectedAction.priority]}`}>
                        {selectedAction.priority}
                      </span>
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded ${statusColors[selectedAction.status]}`}>
                        {selectedAction.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 touch-manipulation"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white mt-1">{selectedAction.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Owner</h3>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white">
                        {selectedAction.owner.firstName} {selectedAction.owner.lastName}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Due Date</h3>
                      <p className={`${isOverdue(selectedAction) ? 'text-red-600 font-medium' : 'text-gray-900 dark:text-white'}`}>
                        {formatDate(selectedAction.dueDate)}
                      </p>
                    </div>
                  </div>

                  {selectedAction.regulatoryTags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Regulatory Tags</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedAction.regulatoryTags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedAction.aiWeaknessFlags.length > 0 && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">⚠️ Quality Warnings</h3>
                      <ul className="text-sm text-yellow-700 dark:text-yellow-400 list-disc list-inside">
                        {selectedAction.aiWeaknessFlags.map((flag, i) => (
                          <li key={i}>{flag.replace(/_/g, ' ')}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Quality Analysis */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">AI Quality Analysis</h3>
                      <button
                        onClick={analyzeQuality}
                        disabled={analyzingQuality}
                        className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                      >
                        {analyzingQuality ? 'Analyzing...' : 'Analyze Quality'}
                      </button>
                    </div>

                    {qualityAnalysis && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl font-bold text-primary-600">{qualityAnalysis.qualityScore}%</div>
                          <div className={`px-3 py-1 rounded font-medium ${
                            qualityAnalysis.qualityRating === 'EXCELLENT' ? 'bg-green-100 text-green-800' :
                            qualityAnalysis.qualityRating === 'GOOD' ? 'bg-blue-100 text-blue-800' :
                            qualityAnalysis.qualityRating === 'FAIR' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {qualityAnalysis.qualityRating}
                          </div>
                        </div>

                        {qualityAnalysis.weaknesses.isWeak && (
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <h4 className="text-sm font-medium text-red-800 dark:text-red-300">Detected Weaknesses:</h4>
                            <ul className="mt-1 text-sm text-red-700 dark:text-red-400 list-disc list-inside">
                              {qualityAnalysis.weaknesses.details.map((d: string, i: number) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {qualityAnalysis.suggestions.length > 0 && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">Improvement Suggestions:</h4>
                            <ul className="mt-2 space-y-2">
                              {qualityAnalysis.suggestions.map((s: any, i: number) => (
                                <li key={i} className="text-sm">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${
                                    s.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                                    s.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {s.priority}
                                  </span>
                                  <span className="text-blue-700 dark:text-blue-400">{s.suggestion}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <div className="flex gap-2">
                    {selectedAction.status === 'VERIFIED' && (
                      <>
                        <button
                          onClick={() => {
                            setShowDetailsModal(false);
                            openEffectivenessReview(selectedAction);
                          }}
                          className="px-3 py-2 text-sm text-purple-600 border border-purple-300 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        >
                          📊 Review Effectiveness
                        </button>
                        <button
                          onClick={() => {
                            setShowDetailsModal(false);
                            checkRecurrence(selectedAction);
                          }}
                          className="px-3 py-2 text-sm text-orange-600 border border-orange-300 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        >
                          🔄 Check Recurrence
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Close
                    </button>
                    <Link
                      href={`/rca/${selectedAction.rcaAnalysis.id}`}
                      className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      View RCA
                    </Link>
                  </div>
                </div>

                {/* Workflow Timeline / Enterprise Info */}
                {(selectedAction.startedAt || selectedAction.completedAt || selectedAction.verifiedAt) && (
                  <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Workflow Timeline</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="w-24 text-gray-500">Created:</span>
                        <span className="text-gray-900 dark:text-white">{formatDate(selectedAction.createdAt)}</span>
                      </div>
                      {selectedAction.startedAt && (
                        <div className="flex items-center gap-3 text-sm">
                          <span className="w-24 text-gray-500">Started:</span>
                          <span className="text-gray-900 dark:text-white">{formatDate(selectedAction.startedAt)}</span>
                        </div>
                      )}
                      {selectedAction.implementationPlan && (
                        <div className="ml-0 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm dark:border-blue-900/50 dark:bg-blue-950/30 sm:ml-8">
                          <strong className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                            Implementation Plan
                          </strong>
                          <div className="mt-4">
                            {formatImplementationPlanForDetails(selectedAction.implementationPlan)}
                          </div>
                        </div>
                      )}
                      {selectedAction.completedAt && (
                        <div className="flex items-center gap-3 text-sm">
                          <span className="w-24 text-gray-500">Completed:</span>
                          <span className="text-gray-900 dark:text-white">{formatDate(selectedAction.completedAt)}</span>
                        </div>
                      )}
                      {selectedAction.completionEvidence && (
                        <div className="ml-8 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                          <strong className="text-green-800 dark:text-green-300">Completion Evidence:</strong>
                          <p className="text-green-700 dark:text-green-400 mt-1">{selectedAction.completionEvidence}</p>
                        </div>
                      )}
                      {selectedAction.verifiedAt && (
                        <div className="flex items-center gap-3 text-sm">
                          <span className="w-24 text-gray-500">Verified:</span>
                          <span className="text-gray-900 dark:text-white">{formatDate(selectedAction.verifiedAt)}</span>
                        </div>
                      )}
                      {selectedAction.verificationNotes && (
                        <div className="ml-8 p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-sm">
                          <strong className="text-purple-800 dark:text-purple-300">Verification Notes:</strong>
                          <p className="text-purple-700 dark:text-purple-400 mt-1">{selectedAction.verificationNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Audit Trail */}
                <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    📋 Audit Trail
                  </h3>
                  {loadingAuditLog ? (
                    <div className="text-center text-gray-500 py-4">Loading audit trail...</div>
                  ) : auditLog.length === 0 ? (
                    <div className="text-center text-gray-400 py-4 text-sm">No audit entries yet</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {auditLog.map((entry) => (
                        <div key={entry.id} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {entry.previousStatus} → {entry.newStatus}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {formatDateTime(entry.performedAt)}
                            </span>
                          </div>
                          <div className="text-gray-600 dark:text-gray-400 text-xs">
                            By: {entry.performedByName}
                          </div>
                          {entry.notes && (
                            <div className="text-gray-700 dark:text-gray-300 mt-1 italic">
                              &ldquo;{entry.notes}&rdquo;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Start Action Modal - AI Enhanced */}
        {showStartModal && workflowAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  🚀 Start Action
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {workflowAction.title}
                </p>

                <div className="space-y-4">
                  {/* Implementation Plan with AI */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Implementation Plan <span className="text-red-500">*</span>
                      </label>
                      <button
                        onClick={generateAIPlan}
                        disabled={generatingAIPlan}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all"
                      >
                        {generatingAIPlan ? (
                          <>
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            <span>Generate with AI</span>
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      value={implementationPlan}
                      onChange={(e) => handlePlanChange(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                      placeholder="Describe how this action will be implemented...&#10;&#10;Or click 'Generate with AI' to get an intelligent plan based on the incident context."
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      💡 Tip: Generate an AI plan, then customize it to fit your specific situation.
                    </p>
                  </div>

                  {/* Validation Section */}
                  {implementationPlan.trim().length >= 20 && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Plan Validation
                        </span>
                        <button
                          onClick={validatePlan}
                          disabled={validatingPlan}
                          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-all ${
                            planEdited 
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          } disabled:opacity-50`}
                        >
                          {validatingPlan ? (
                            <>
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                              <span>Validating...</span>
                            </>
                          ) : planEdited ? (
                            <>
                              <span>🔄</span>
                              <span>Re-validate (edited)</span>
                            </>
                          ) : (
                            <>
                              <span>✓</span>
                              <span>Validate Plan</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Validation Results */}
                      {planValidation && !planEdited && (
                        <div className="mt-3 space-y-3">
                          {/* Score and Verdict */}
                          <div className="flex items-center gap-4">
                            <div className={`text-2xl font-bold ${
                              planValidation.score >= 75 ? 'text-green-600' :
                              planValidation.score >= 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {planValidation.score}%
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                              planValidation.verdict === 'APPROVED' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                                : planValidation.verdict === 'NEEDS_REVISION'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                            }`}>
                              {planValidation.verdict === 'APPROVED' ? '✓ Approved' : 
                               planValidation.verdict === 'NEEDS_REVISION' ? '⚠ Needs Revision' : 
                               '✗ Insufficient'}
                            </div>
                          </div>

                          {/* Summary */}
                          <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                            {planValidation.summary}
                          </p>

                          {/* Strengths */}
                          {planValidation.strengths.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">✓ Strengths:</h4>
                              <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-0.5">
                                {planValidation.strengths.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Gaps */}
                          {planValidation.gaps.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">⚠ Gaps:</h4>
                              <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-0.5">
                                {planValidation.gaps.map((g, i) => (
                                  <li key={i}>{g}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Suggestions */}
                          {planValidation.suggestions.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">💡 Suggestions:</h4>
                              <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-0.5">
                                {planValidation.suggestions.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Compliance Notes */}
                          {planValidation.complianceNotes.length > 0 && (
                            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-xs">
                              <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-1">📋 Compliance Notes:</h4>
                              <ul className="text-purple-600 dark:text-purple-400 list-disc list-inside">
                                {planValidation.complianceNotes.map((n, i) => (
                                  <li key={i}>{n}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {planEdited && planValidation && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                          ⚠ Plan has been edited since last validation. Click &quot;Re-validate&quot; to check your changes.
                        </p>
                      )}

                      {!planValidation && !validatingPlan && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Click &quot;Validate Plan&quot; to get AI feedback on your implementation plan.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Additional Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Additional Notes
                    </label>
                    <textarea
                      value={implementationNotes}
                      onChange={(e) => setImplementationNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Any resources needed, dependencies, etc."
                    />
                  </div>

                  {/* Target Due Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Target Due Date
                    </label>
                    <input
                      type="date"
                      value={targetDueDate}
                      onChange={(e) => setTargetDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowStartModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartAction}
                    disabled={submitting || !implementationPlan.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Starting...' : 'Start Action'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complete Action Modal */}
        {showCompleteModal && workflowAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  ✅ Complete Action
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {workflowAction.title}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Completion Evidence <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={completionEvidence}
                      onChange={(e) => setCompletionEvidence(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Document what was done, reference numbers, links to documentation..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Include references, document IDs, or links that prove the action was completed.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Completion Notes
                    </label>
                    <textarea
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Any deviations from plan, lessons learned, etc."
                    />
                  </div>

                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
                    <strong className="text-yellow-800 dark:text-yellow-300">⚠️ Note:</strong>
                    <p className="text-yellow-700 dark:text-yellow-400 mt-1">
                      After completion, this action will require effectiveness verification within 30 days.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowCompleteModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteAction}
                    disabled={submitting || (!completionEvidence.trim() && !completionNotes.trim())}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? 'Completing...' : 'Mark Complete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Verify Action Modal */}
        {showVerifyModal && workflowAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  🔍 Verify Effectiveness
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {workflowAction.title}
                </p>

                {workflowAction.completionEvidence && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Completion Evidence:</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {workflowAction.completionEvidence}
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Verification Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Describe how effectiveness was verified. Include metrics, observations, or test results..."
                    />
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                    <strong className="text-blue-800 dark:text-blue-300">Verification Criteria:</strong>
                    <ul className="text-blue-700 dark:text-blue-400 mt-1 list-disc list-inside">
                      <li>No recurrence of the original issue</li>
                      <li>Root cause has been addressed</li>
                      <li>Preventive measures are in place</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={() => {
                      setShowVerifyModal(false);
                      openIneffectiveModal(workflowAction);
                    }}
                    className="px-4 py-2 text-red-600 border border-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Mark Ineffective
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowVerifyModal(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleVerifyAction}
                      disabled={submitting || !verificationNotes.trim()}
                      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      {submitting ? 'Verifying...' : 'Verify Effective'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ineffective Action Modal */}
        {showIneffectiveModal && workflowAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
              <div className="p-6">
                <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
                  ⚠️ Mark as Ineffective
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {workflowAction.title}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Explanation <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={ineffectiveNotes}
                      onChange={(e) => setIneffectiveNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Explain why this action was ineffective. What was observed? Did the issue recur?"
                    />
                  </div>

                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm">
                    <strong className="text-red-800 dark:text-red-300">Note:</strong>
                    <p className="text-red-700 dark:text-red-400 mt-1">
                      Marking an action as ineffective will require a new approach. The action can be restarted with a revised plan.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowIneffectiveModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMarkIneffective}
                    disabled={submitting || !ineffectiveNotes.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {submitting ? 'Updating...' : 'Mark Ineffective'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 10.3: Effectiveness Review Modal */}
        {showEffectivenessModal && workflowAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                  📊 Effectiveness Review
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <strong>{workflowAction.title}</strong>
                </p>

                <div className="space-y-5">
                  {/* Effectiveness Score Slider */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Effectiveness Score: <span className="font-bold text-lg">{effectivenessScore}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={effectivenessScore}
                      onChange={(e) => {
                        const score = parseInt(e.target.value);
                        setEffectivenessScore(score);
                        setIsEffective(score >= 70);
                      }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0% (Ineffective)</span>
                      <span>50%</span>
                      <span>70% (Threshold)</span>
                      <span>100% (Fully Effective)</span>
                    </div>
                    <div className={`mt-2 p-2 rounded text-sm ${
                      effectivenessScore >= 70 
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    }`}>
                      {effectivenessScore >= 70 
                        ? '✅ Action meets effectiveness threshold'
                        : '⚠️ Action does not meet effectiveness threshold (70%)'}
                    </div>
                  </div>

                  {/* Effective Toggle */}
                  <div className="flex items-center gap-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Mark as Effective:
                    </label>
                    <button
                      onClick={() => setIsEffective(!isEffective)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        isEffective
                          ? 'bg-green-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {isEffective ? '✅ Yes, Effective' : '❌ No, Ineffective'}
                    </button>
                  </div>

                  {/* Review Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Review Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={effectivenessNotes}
                      onChange={(e) => setEffectivenessNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Document your effectiveness assessment. Include evidence such as:&#10;- Reduction in incidents/defects&#10;- Process improvements observed&#10;- Training completion rates&#10;- Audit results&#10;- KPI changes"
                    />
                  </div>

                  {/* Effectiveness Criteria Checklist */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                      🎯 Effectiveness Criteria to Consider:
                    </h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                      <li>• Has the root cause been eliminated or controlled?</li>
                      <li>• Have similar incidents recurred since implementation?</li>
                      <li>• Are preventive measures sustainably in place?</li>
                      <li>• Do metrics/KPIs show improvement?</li>
                      <li>• Has the action been verified through audit/inspection?</li>
                      <li>• Is personnel properly trained on new procedures?</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={() => checkRecurrence(workflowAction)}
                    className="px-4 py-2 text-blue-600 border border-blue-300 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    🔍 Check for Recurrence
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowEffectivenessModal(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEffectivenessReview}
                      disabled={submitting || !effectivenessNotes.trim()}
                      className={`px-4 py-2 rounded disabled:opacity-50 ${
                        isEffective
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-orange-600 hover:bg-orange-700 text-white'
                      }`}
                    >
                      {submitting ? 'Submitting...' : isEffective ? 'Confirm Effective' : 'Submit as Needs Rework'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 10.4: Recurrence Detection Modal */}
        {showRecurrenceModal && workflowAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                  🔄 Recurrence Detection
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Checking for similar incidents to: <strong>{workflowAction.title}</strong>
                </p>

                {checkingRecurrence ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Analyzing for similar incidents and patterns...</p>
                  </div>
                ) : recurrenceData ? (
                  <div className="space-y-4">
                    {/* Recurrence Summary */}
                    <div className={`p-4 rounded-lg ${
                      recurrenceData.hasRecurrence
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {recurrenceData.hasRecurrence ? (
                          <span className="text-2xl">⚠️</span>
                        ) : (
                          <span className="text-2xl">✅</span>
                        )}
                        <h3 className={`font-bold ${
                          recurrenceData.hasRecurrence
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-green-700 dark:text-green-400'
                        }`}>
                          {recurrenceData.hasRecurrence 
                            ? `Recurrence Detected: ${recurrenceData.similarIncidentCount} Similar Incident(s)`
                            : 'No Recurrence Detected'}
                        </h3>
                      </div>
                      <p className={`text-sm ${
                        recurrenceData.hasRecurrence
                          ? 'text-red-600 dark:text-red-300'
                          : 'text-green-600 dark:text-green-300'
                      }`}>
                        {recurrenceData.message}
                      </p>
                    </div>

                    {/* Similar Incidents List */}
                    {recurrenceData.similarIncidents && recurrenceData.similarIncidents.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Similar Incidents Found:
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {recurrenceData.similarIncidents.map((incident: any, idx: number) => (
                            <div 
                              key={incident.id || idx}
                              className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {incident.title || 'Incident'}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {incident.description?.substring(0, 100)}...
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs text-gray-500">
                                    {incident.createdAt ? formatDate(incident.createdAt) : 'Unknown date'}
                                  </span>
                                  {incident.similarity && (
                                    <div className="text-xs text-orange-600 font-medium">
                                      {(incident.similarity * 100).toFixed(0)}% match
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {recurrenceData.hasRecurrence && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2">
                          📋 Recommended Actions:
                        </h4>
                        <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                          <li>• Review root cause analysis for completeness</li>
                          <li>• Consider systemic factors not yet addressed</li>
                          <li>• Evaluate if preventive measures are sufficient</li>
                          <li>• Assess training and awareness gaps</li>
                          <li>• Consider escalation if pattern persists</li>
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No recurrence data available
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowRecurrenceModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Close
                  </button>
                  {recurrenceData?.hasRecurrence && (
                    <button
                      onClick={() => {
                        setShowRecurrenceModal(false);
                        openEffectivenessReview(workflowAction);
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                    >
                      Review Effectiveness
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Saved Reports Modal */}
        <SavedReportsModal
          open={showSavedReportsModal}
          onClose={() => setShowSavedReportsModal(false)}
          rcaId={savedReportsRcaId}
          incidentNumber={savedReportsIncidentNumber}
        />

        {/* Access Denied Modal */}
        {accessDeniedModal}
      </main>
    </div>
  );
}

export default function CAPAPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <CAPAContent />
    </ProtectedRoute>
  );
}
