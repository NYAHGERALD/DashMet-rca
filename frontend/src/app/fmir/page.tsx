'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/lib/websocket';
import { usePrivileges, FMIR_PRIVILEGES } from '@/lib/usePrivileges';
import { useAccessDeniedModal, handlePrivilegeError } from '@/components/modals/AccessDeniedModal';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api, { apiWithExtendedTimeout } from '@/lib/api';
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Calendar,
  User,
  Building2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  ArrowLeft,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  Trash2,
  Edit,
  UserPlus,
  X,
  Crown,
  Users,
  CircleDot,
  Lock,
  ShieldAlert,
  FileWarning,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trophy,
  Star,
  Award,
  ThumbsUp,
  MessageSquare,
  ClipboardCheck,
  XCircle,
  Image,
  FileImage,
  Shield,
  Target,
  Lightbulb,
  TrendingUp,
  FileSearch,
  ShieldCheck,
  Package,
  Building,
  Unlock,
  Settings,
  GitBranch,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  role?: string;
  isQAFoodSafety?: boolean;
}

interface FMIRReport {
  id: string;
  reportNumber: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_INVESTIGATION' | 'RESOLVED' | 'CLOSED';
  incidentDate: string;
  incidentTime?: string;
  department?: string;
  productName?: string;
  productItemNumber?: string;
  foreignMaterialDescription: string;
  foreignMaterialSize?: string;
  foreignMaterialHardness?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  submittedById?: string;
  isOwner?: boolean;
  isVisible?: boolean;
  isClosed?: boolean;
  closedAt?: string;
  closedById?: string;
  collaboratorIds?: string[];
  linkedIncidentId?: string | null;
  linkedIncidentNumber?: string | null;
  Facility?: {
    id: string;
    name: string;
  };
  CreatedBy?: UserProfile;
  SubmittedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  Collaborators?: UserProfile[];
  Evidence?: Array<{
    id: string;
    type: string;
    fileName: string;
  }>;
}

// Validation interfaces
interface FMIRValidationField {
  field: string;
  section: number;
  label: string;
  value: any;
  required: boolean;
  reason: string;
}

interface FMIRValidationResult {
  isValid: boolean;
  missingFields: FMIRValidationField[];
  hasEvidence: boolean;
  evidenceCount: number;
  sectionStatus: { [key: number]: { complete: boolean; missing: string[] } };
}

interface FMIRComplianceAnalysis {
  overallCompliance: 'COMPLIANT' | 'NEEDS_IMPROVEMENT' | 'NON_COMPLIANT';
  complianceScore: number;
  summary: string;
  fieldAnalysis: {
    field: string;
    section: number;
    issue: string;
    recommendation: string;
    regulatoryReference?: string;
  }[];
  evidenceAnalysis: {
    adequate: boolean;
    summary: string;
    recommendations: string[];
  };
  auditReadiness: {
    ready: boolean;
    concerns: string[];
    strengths: string[];
  };
  aiExplanation: string;
}

// Answer Quality Assessment interface
interface AnswerQualityAssessment {
  field: string;
  answer: string;
  isAdequate: boolean;
  qualityScore: number;
  issues: string[];
  recommendations: string[];
  exampleAnswer?: string;
  regulatoryGap?: string;
}

// Evidence Assessment Detail interface
interface EvidenceAssessmentDetail {
  filename: string;
  type: string;
  relevance: 'high' | 'medium' | 'low' | 'unclear';
  assessment: string;
  supportsReport: boolean;
  concerns?: string;
  missingContext?: string;
}

// Success Audit interfaces (when FMIR passes all validations)
interface FMIRSuccessAuditAnalysis {
  // CRITICAL: Whether the report can be closed
  canBeClosed: boolean;
  blockingReasons: string[];
  
  congratulations: boolean;
  auditScore: number;
  overallVerdict: 'EXCELLENT' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | 'CANNOT_CLOSE';
  passesAudit: boolean;
  
  summary: {
    headline: string;
    keyStrengths: string[];
    criticalConcerns: string[];
    immediateActions?: string[];
  };
  
  reportSummary: {
    incidentOverview: string;
    foreignMaterial: string;
    causeAnalysis: string;
    correctiveActions: string;
    verification: string;
    disposition: string;
    prevention: string;
  };
  
  // Answer Quality Assessment
  answerQuality?: {
    overallScore: number;
    passesMinimumStandard: boolean;
    assessments: AnswerQualityAssessment[];
  };
  
  contentQuality: {
    causeAnalysisAdequate: boolean;
    causeAnalysisFeedback: string;
    causeAnalysisRecommendation?: string;
    correctiveActionsAdequate: boolean;
    correctiveActionsFeedback: string;
    correctiveActionsRecommendation?: string;
    preventionMeasuresAdequate: boolean;
    preventionMeasuresFeedback: string;
    preventionMeasuresRecommendation?: string;
    logicalConsistency: boolean;
    logicalConsistencyFeedback: string;
    logicalGaps?: string[];
  };
  
  evidenceAnalysis: {
    adequate: boolean;
    count: number;
    minimumRequired?: number;
    quality: 'excellent' | 'good' | 'acceptable' | 'insufficient' | 'missing';
    supportsIncident: boolean;
    feedback: string;
    recommendations: string[];
    missingEvidenceTypes?: string[];
    detailedFindings: EvidenceAssessmentDetail[];
  };
  
  regulatoryReadiness: {
    fda21cfr117: boolean;
    gfsiStandards: boolean;
    fsmaCompliance: boolean;
    overallReady?: boolean;
    concerns: string[];
    recommendations: string[];
    specificViolations?: string[];
  };
  
  fieldValidation: {
    field: string;
    section: number;
    value: string;
    assessment: 'excellent' | 'good' | 'acceptable' | 'needs_attention' | 'inadequate';
    feedback: string;
    suggestion?: string;
    exampleAnswer?: string;
    regulatoryNote?: string;
  }[];
  
  improvementAreas: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    area: string;
    currentState: string;
    recommendation: string;
    regulatoryReference?: string;
    blocksClosureUntilFixed?: boolean;
  }[];
  
  auditorNarrative: string;
  closingStatement: string;
}

function FMIRListContent() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const { onFmirCollaboratorAdded, onFmirCollaboratorRemoved, onFmirCollaboratorsUpdated, onFmirVisibilityChanged, onFmirClosedStatusChanged, onFmirStatusChanged, onFmirUpdated, onFmirDeleted, onFmirAuditProgress } = useWebSocket();

  const [reports, setReports] = useState<FMIRReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Collaborator states
  const [organizationUsers, setOrganizationUsers] = useState<UserProfile[]>([]);
  const [qaFoodSafetyUsers, setQaFoodSafetyUsers] = useState<UserProfile[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState<string | null>(null);
  const [showCollaboratorMenu, setShowCollaboratorMenu] = useState<{ reportId: string; collaboratorId: string } | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [addingCollaborator, setAddingCollaborator] = useState<string | null>(null);
  const [removingCollaborator, setRemovingCollaborator] = useState<string | null>(null);
  const [collaboratorScrollIndex, setCollaboratorScrollIndex] = useState<Record<string, number>>({});
  const [togglingVisibility, setTogglingVisibility] = useState<string | null>(null);
  const [togglingClosedStatus, setTogglingClosedStatus] = useState<string | null>(null);
  const [togglingInvestigationStatus, setTogglingInvestigationStatus] = useState<string | null>(null);
  const [startingRCA, setStartingRCA] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Validation modal states
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResult, setValidationResult] = useState<FMIRValidationResult | null>(null);
  const [complianceAnalysis, setComplianceAnalysis] = useState<FMIRComplianceAnalysis | null>(null);
  const [validationReportNumber, setValidationReportNumber] = useState<string>('');
  const [validationReportId, setValidationReportId] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  // Success modal states (when FMIR passes all validations)
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAudit, setSuccessAudit] = useState<FMIRSuccessAuditAnalysis | null>(null);
  const [successReportNumber, setSuccessReportNumber] = useState<string>('');
  const [successReportId, setSuccessReportId] = useState<string>(''); // Track report ID for override
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [expandedFieldDetails, setExpandedFieldDetails] = useState(false);

  // AI Audit Loading Modal states
  const [showAuditLoadingModal, setShowAuditLoadingModal] = useState(false);
  const [auditLoadingReport, setAuditLoadingReport] = useState<FMIRReport | null>(null);
  const auditLoadingReportIdRef = useRef<string | null>(null); // Track current audit report ID for WebSocket events
  const [auditLoadingMessageIndex, setAuditLoadingMessageIndex] = useState(0);
  const [auditLoadingPhase, setAuditLoadingPhase] = useState(0);
  const [auditValidationSteps, setAuditValidationSteps] = useState<Array<{
    id: string;
    label: string;
    description: string;
    status: 'pending' | 'active' | 'completed';
    icon: string;
  }>>([]);
  const [auditInsightIndex, setAuditInsightIndex] = useState(0);

  // Regulation explanation modal states
  const [showRegulationModal, setShowRegulationModal] = useState(false);
  const [regulationLoading, setRegulationLoading] = useState(false);
  const [regulationExplanation, setRegulationExplanation] = useState<{
    title: string;
    plainExplanation: string;
    whyItMatters: string;
    practicalExample: string;
    keyTakeaways: string[];
  } | null>(null);
  const [selectedRegulation, setSelectedRegulation] = useState<{
    reference: string;
    field: string;
    issue: string;
    recommendation: string;
  } | null>(null);

  // Use privilege system for access control
  const { hasPrivilege, loading: privilegesLoading, version: privilegeVersion } = usePrivileges();
  
  // Access denied modal for privilege enforcement
  const { modal: accessDeniedModal, showAccessDenied } = useAccessDeniedModal({
    onContactSupport: () => {
      // Navigate to support or show support modal
      router.push('/support');
    }
  });
  
  // Legacy role checks (kept for backward compatibility, will be phased out)
  const isQAFoodSafety = user?.role === 'QA_FOOD_SAFETY' || user?.role === 'QUALITY_CONTROL_MANAGER';
  const isQualityControlManager = user?.role === 'QUALITY_CONTROL_MANAGER';
  
  // Privilege-based access checks
  const canViewFMIR = hasPrivilege(FMIR_PRIVILEGES.VIEW);
  const canViewAllFMIR = hasPrivilege(FMIR_PRIVILEGES.VIEW_ALL);
  const canCreateFMIR = hasPrivilege(FMIR_PRIVILEGES.CREATE);
  const canDeleteVisible = hasPrivilege(FMIR_PRIVILEGES.DELETE_VISIBLE);
  const canToggleInvestigation = hasPrivilege(FMIR_PRIVILEGES.TOGGLE_INVESTIGATION);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);
  const canCloseFMIR = hasPrivilege(FMIR_PRIVILEGES.CLOSE);
  const canAddComments = hasPrivilege(FMIR_PRIVILEGES.COMMENTS_ADD);
  const canExportPDF = hasPrivilege(FMIR_PRIVILEGES.EXPORT_PDF);
  const canPrint = hasPrivilege(FMIR_PRIVILEGES.EXPORT_PRINT);

  // Handler for creating new FMIR with privilege check
  const handleCreateFMIR = useCallback(() => {
    if (!canCreateFMIR) {
      showAccessDenied('Create Foreign Material Report', FMIR_PRIVILEGES.CREATE);
      return;
    }
    router.push('/fmir/new');
  }, [canCreateFMIR, showAccessDenied, router]);

  // Fetch organization users for collaborator dropdown (excludes QA/Food Safety)
  const fetchOrganizationUsers = useCallback(async () => {
    try {
      const response = await api.get('/fmir/organization-users');
      if (response.data.success) {
        setOrganizationUsers(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching organization users:', err);
    }
  }, []);

  // Fetch QA/Food Safety users (auto-added to all reports)
  const fetchQAFoodSafetyUsers = useCallback(async () => {
    try {
      const response = await api.get('/fmir/qa-users');
      if (response.data.success) {
        setQaFoodSafetyUsers((response.data.data || []).map((u: UserProfile) => ({ ...u, isQAFoodSafety: true })));
      }
    } catch (err) {
      console.error('Error fetching QA/Food Safety users:', err);
    }
  }, []);

  // Fetch regulation explanation from AI
  const fetchRegulationExplanation = useCallback(async (
    reference: string,
    field: string,
    issue: string,
    recommendation: string
  ) => {
    setSelectedRegulation({ reference, field, issue, recommendation });
    setShowRegulationModal(true);
    setRegulationLoading(true);
    setRegulationExplanation(null);

    try {
      const response = await api.post('/fmir/explain-regulation', {
        regulatoryReference: reference,
        fieldName: field,
        issue,
        recommendation,
      });

      if (response.data.success) {
        setRegulationExplanation(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching regulation explanation:', err);
      // Set a fallback explanation
      setRegulationExplanation({
        title: reference,
        plainExplanation: `This regulation (${reference}) is a food safety requirement that helps ensure products are safe for consumers. It relates to ${field}.`,
        whyItMatters: 'Following food safety regulations protects consumers, helps your facility pass audits, and demonstrates your commitment to quality.',
        practicalExample: recommendation,
        keyTakeaways: [
          'Complete all required documentation',
          'Follow your facility\'s standard procedures',
          'Keep detailed records for audits'
        ],
      });
    } finally {
      setRegulationLoading(false);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);

      const response = await api.get(`/fmir?${params.toString()}`);
      const data = response.data;
      
      if (data.success) {
        setReports(data.data.reports || []);
      } else {
        throw new Error(data.error || 'Failed to fetch reports');
      }
    } catch (err: any) {
      console.error('Error fetching FMIR reports:', err);
      setError(err.response?.data?.error || 'Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, statusFilter, debouncedSearchQuery]);

  useEffect(() => {
    fetchReports();
    fetchOrganizationUsers();
    fetchQAFoodSafetyUsers();
  }, [fetchReports, fetchOrganizationUsers, fetchQAFoodSafetyUsers]);

  // Listen for real-time collaborator additions (when QA/Food Safety user is added to open FMIRs)
  useEffect(() => {
    const unsubscribe = onFmirCollaboratorAdded((data: any) => {
      console.log('👥 FMIR collaborator added event received:', data);
      
      // Handle both event formats:
      // 1. From QA user role assignment: { reportIds: [...], userId, user, addedBy }
      // 2. From manual collaborator add: { reportId, reportNumber, addedUserId, addedByName }
      
      // For format 2 (single report), just refresh the list
      if (data.reportId && !data.reportIds) {
        console.log('📝 Single report collaborator update, refreshing...');
        fetchReports();
        return;
      }
      
      // For format 1 (multiple reports), update in-memory state
      if (!data.reportIds || !Array.isArray(data.reportIds)) {
        console.log('⚠️ No reportIds in event, skipping');
        return;
      }
      
      // Update reports state to include the new collaborator
      setReports(prevReports => 
        prevReports.map(report => {
          if (data.reportIds.includes(report.id)) {
            // Check if collaborator already exists
            const existingCollaborator = report.Collaborators?.find(c => c.id === data.userId);
            if (!existingCollaborator) {
              return {
                ...report,
                Collaborators: [...(report.Collaborators || []), { ...data.user, isQAFoodSafety: true }],
                collaboratorIds: [...(report.collaboratorIds || []), data.userId],
              };
            }
          }
          return report;
        })
      );

      // Also update QA Food Safety users list if not already present
      setQaFoodSafetyUsers(prev => {
        const exists = prev.find(u => u.id === data.userId);
        if (!exists && data.user) {
          return [...prev, { ...data.user, isQAFoodSafety: true }];
        }
        return prev;
      });
    });

    return () => unsubscribe();
  }, [onFmirCollaboratorAdded, fetchReports]);

  // Listen for real-time visibility changes (when owner toggles visibility switch)
  useEffect(() => {
    const unsubscribe = onFmirVisibilityChanged((data: any) => {
      console.log('👁️ FMIR visibility changed event received:', data);
      
      // If current user is the owner, just update the visibility state
      if (data.ownerId === user?.id) {
        setReports(prevReports => 
          prevReports.map(report => 
            report.id === data.reportId 
              ? { ...report, isVisible: data.isVisible }
              : report
          )
        );
      } else {
        // For non-owners, refresh the entire list to show/hide the report
        fetchReports();
      }
    });

    return () => unsubscribe();
  }, [onFmirVisibilityChanged, user?.id, fetchReports]);

  // Listen for real-time closed status changes (when QA toggles lock/unlock switch)
  useEffect(() => {
    const unsubscribe = onFmirClosedStatusChanged((data: any) => {
      console.log('🔒 FMIR closed status changed event received:', data);
      
      // Update the report's closed status in real-time
      setReports(prevReports => 
        prevReports.map(report => 
          report.id === data.reportId 
            ? { 
                ...report, 
                isClosed: data.isClosed, 
                closedAt: data.closedAt, 
                closedById: data.closedById 
              }
            : report
        )
      );
    });

    return () => unsubscribe();
  }, [onFmirClosedStatusChanged]);

  // Listen for real-time FMIR status changes (when QA toggles investigation on/off)
  useEffect(() => {
    const unsubscribe = onFmirStatusChanged((data: { reportId: string; reportNumber: string; previousStatus: string; newStatus: string; statusDisplay: string; changedBy: string; changedById: string }) => {
      console.log('📊 FMIR status changed event received:', data);
      
      // Update the report's status in real-time
      // Note: We don't show a toast here - this is for other users receiving the update
      // The user who initiated the action sees their own success toast from toggleInvestigationStatus
      setReports(prevReports => 
        prevReports.map(report => 
          report.id === data.reportId 
            ? { 
                ...report, 
                status: data.newStatus as FMIRReport['status']
              }
            : report
        )
      );
    });

    return () => unsubscribe();
  }, [onFmirStatusChanged]);

  // Listen for real-time FMIR updates (when someone submits or saves a report)
  useEffect(() => {
    const unsubscribe = onFmirUpdated((data: { reportId: string; reportNumber: string; updatedById: string; updatedByName: string; updateType: 'save' | 'submit'; newStatus?: string }) => {
      console.log('📝 FMIR updated event received:', data);
      
      // If it's a submit event, update the status in the list
      // Note: We don't show a toast here - this is for other users receiving the update
      if (data.updateType === 'submit' && data.newStatus) {
        setReports(prevReports => 
          prevReports.map(report => 
            report.id === data.reportId 
              ? { 
                  ...report, 
                  status: data.newStatus as FMIRReport['status']
                }
              : report
          )
        );
      }
    });

    return () => unsubscribe();
  }, [onFmirUpdated]);

  // Listen for real-time FMIR deletions (when QA deletes a report)
  useEffect(() => {
    const unsubscribe = onFmirDeleted((data: any) => {
      console.log('🗑️ FMIR deleted event received:', data);
      
      // Remove the deleted report from the list
      setReports(prevReports => 
        prevReports.filter(report => report.id !== data.reportId)
      );
    });

    return () => unsubscribe();
  }, [onFmirDeleted]);

  // Listen for collaborator removal (when owner removes current user from collaboration)
  useEffect(() => {
    const unsubscribe = onFmirCollaboratorRemoved((data: { reportId: string; reportNumber: string; removedUserId: string; removedByName: string }) => {
      console.log('👤 FMIR collaborator removed event received:', data);
      
      // If current user was removed, remove the report from their list
      if (data.removedUserId === user?.id) {
        setReports(prevReports => 
          prevReports.filter(report => report.id !== data.reportId)
        );
      }
    });

    return () => unsubscribe();
  }, [onFmirCollaboratorRemoved, user?.id]);

  // Listen for collaborator addition (when owner adds current user to collaboration)
  useEffect(() => {
    const unsubscribe = onFmirCollaboratorAdded((data: { reportId: string; reportNumber: string; addedUserId: string; addedByName: string; addedById: string }) => {
      console.log('👥 FMIR collaborator added event received:', data);
      
      // If current user was added, fetch and add the report to their list
      if (data.addedUserId === user?.id) {
        // Fetch the full report data
        api.get(`/fmir/${data.reportId}`)
          .then((response) => {
            if (response.data.success) {
              const newReport = response.data.data;
              // Add to reports list if not already there
              setReports(prevReports => {
                const exists = prevReports.some(r => r.id === newReport.id);
                if (exists) return prevReports;
                return [newReport, ...prevReports];
              });
            }
          })
          .catch((err) => {
            console.error('Error fetching added report:', err);
          });
      }
    });

    return () => unsubscribe();
  }, [onFmirCollaboratorAdded, user?.id]);

  // Listen for collaborator list updates (broadcast to all viewers including QA)
  useEffect(() => {
    const unsubscribe = onFmirCollaboratorsUpdated((data: { 
      reportId: string; 
      reportNumber: string; 
      action: 'added' | 'removed'; 
      collaboratorIds: string[]; 
      collaborators: any[]; 
      updatedByName: string; 
      updatedById: string;
      removedUserId?: string;
    }) => {
      console.log('👥 FMIR collaborators updated event received:', data);
      
      // Don't update if we're the one who made the change (we already have the update from API response)
      if (data.updatedById === user?.id) {
        return;
      }
      
      // Update the collaborators for this report in the list
      setReports(prevReports => 
        prevReports.map(report => {
          if (report.id === data.reportId) {
            return {
              ...report,
              collaboratorIds: data.collaboratorIds,
              Collaborators: data.collaborators,
            };
          }
          return report;
        })
      );
    });

    return () => unsubscribe();
  }, [onFmirCollaboratorsUpdated, user?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(null);
        setUserSearchQuery('');
      }
      // Also close collaborator menu when clicking outside
      const target = event.target as HTMLElement;
      if (!target.closest('[data-collaborator-menu]')) {
        setShowCollaboratorMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to get icon for dynamically created steps
  const getStepIcon = (stepId: string): string => {
    const iconMap: Record<string, string> = {
      incident: 'alert',
      product: 'package',
      evidence: 'image',
      department: 'building',
      rootcause: 'search',
      corrective: 'check',
      preventive: 'shield',
      compliance: 'regulation',
      quality: 'star',
    };
    return iconMap[stepId] || 'circle';
  };

  // Real-time AI Audit Progress via WebSocket - Subscribe ALWAYS (not just when modal is open)
  // Steps are FULLY DYNAMIC - created and updated based on WebSocket events from backend
  useEffect(() => {
    // Subscribe to real-time audit progress from WebSocket
    const unsubscribe = onFmirAuditProgress((data: { 
      reportId: string; 
      stepId: string; 
      stepLabel: string; 
      stepDescription: string; 
      status: 'pending' | 'active' | 'completed';
      stepIndex?: number;
      totalSteps?: number;
      message?: string;
    }) => {
      console.log('🔍 Real-time audit progress received:', data);
      
      // Only process events for the current report
      if (auditLoadingReportIdRef.current && data.reportId !== auditLoadingReportIdRef.current) {
        return;
      }
      
      // Status priority: completed > active > pending
      const statusPriority = { pending: 0, active: 1, completed: 2 };
      
      // Dynamically create/update steps based on WebSocket events
      setAuditValidationSteps(prev => {
        const existingStepIndex = prev.findIndex(s => s.id === data.stepId);
        
        if (existingStepIndex >= 0) {
          // Step exists - update it if new status is equal or higher priority
          if (statusPriority[data.status] >= statusPriority[prev[existingStepIndex].status]) {
            console.log(`   ✅ ${data.stepId}: ${prev[existingStepIndex].status} → ${data.status}`);
            const updated = [...prev];
            updated[existingStepIndex] = {
              ...updated[existingStepIndex],
              status: data.status,
              label: data.stepLabel || updated[existingStepIndex].label,
              description: data.stepDescription || updated[existingStepIndex].description,
            };
            return updated;
          }
          return prev;
        } else {
          // Step doesn't exist - create it dynamically
          console.log(`   ➕ Creating new step: ${data.stepId} (${data.status})`);
          const newStep = {
            id: data.stepId,
            label: data.stepLabel || data.stepId,
            description: data.stepDescription || '',
            status: data.status,
            icon: getStepIcon(data.stepId),
          };
          // Insert at correct position based on stepIndex, or append
          if (data.stepIndex !== undefined && data.stepIndex < prev.length) {
            const updated = [...prev];
            updated.splice(data.stepIndex, 0, newStep);
            return updated;
          }
          return [...prev, newStep];
        }
      });

      // Update the loading message if provided
      if (data.message) {
        setAuditLoadingMessageIndex(prev => prev + 1);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onFmirAuditProgress]);

  // Initialize validation steps when modal opens - now starts EMPTY (fully dynamic)
  useEffect(() => {
    if (!showAuditLoadingModal || !auditLoadingReport) {
      // Clear ref and steps when modal closes
      if (!showAuditLoadingModal) {
        auditLoadingReportIdRef.current = null;
        setAuditValidationSteps([]); // Clear steps when modal closes
      }
      return;
    }
    
    // Set the ref so WebSocket callback knows which report we're auditing
    auditLoadingReportIdRef.current = auditLoadingReport.id;
    console.log('🎯 Set audit report ID ref to:', auditLoadingReport.id);

    // Start with empty steps - they will be populated dynamically by WebSocket events
    // This ensures the UI shows exactly what the AI is actually doing
    setAuditValidationSteps([]);

    // Cycle through insights (still animated as these are informational)
    const insightInterval = setInterval(() => {
      setAuditInsightIndex(prev => prev + 1);
    }, 4000);

    // Cycle through phases for visual variety
    const phaseInterval = setInterval(() => {
      setAuditLoadingPhase(prev => (prev + 1) % 4);
    }, 1500);

    return () => {
      clearInterval(insightInterval);
      clearInterval(phaseInterval);
    };
  }, [showAuditLoadingModal, auditLoadingReport]);

  // Add collaborator to report
  const handleAddCollaborator = async (reportId: string, userId: string) => {
    setAddingCollaborator(userId);
    try {
      const response = await api.post(`/fmir/${reportId}/collaborators`, { userIds: [userId] });
      if (response.data.success) {
        // Update reports with new collaborator
        setReports(reports.map(r => {
          if (r.id === reportId) {
            return {
              ...r,
              Collaborators: response.data.data.Collaborators,
              collaboratorIds: response.data.data.collaboratorIds,
            };
          }
          return r;
        }));
        setShowUserDropdown(null);
        setUserSearchQuery('');
      }
    } catch (err: any) {
      console.error('Error adding collaborator:', err);
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Add Collaborator');
    } finally {
      setAddingCollaborator(null);
    }
  };

  // Remove collaborator from report
  const handleRemoveCollaborator = async (reportId: string, collaboratorId: string) => {
    setRemovingCollaborator(collaboratorId);
    try {
      const response = await api.delete(`/fmir/${reportId}/collaborators/${collaboratorId}`);
      if (response.data.success) {
        setReports(reports.map(r => {
          if (r.id === reportId) {
            return {
              ...r,
              Collaborators: response.data.data.Collaborators,
              collaboratorIds: response.data.data.collaboratorIds,
            };
          }
          return r;
        }));
      }
    } catch (err: any) {
      console.error('Error removing collaborator:', err);
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Remove Collaborator');
    } finally {
      setRemovingCollaborator(null);
    }
  };

  // Get initials from name
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Get available users (not already collaborators or owner)
  const getAvailableUsers = (report: FMIRReport) => {
    const existingIds = new Set([
      report.CreatedBy?.id,
      ...(report.collaboratorIds || []),
    ]);
    return organizationUsers.filter(u => 
      !existingIds.has(u.id) && 
      (userSearchQuery === '' || 
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
      )
    );
  };

  // Scroll collaborators (only for collaborators, not owner which is separate)
  const scrollCollaborators = (reportId: string, direction: 'left' | 'right', maxVisible: number) => {
    const currentIndex = collaboratorScrollIndex[reportId] || 0;
    const report = reports.find(r => r.id === reportId);
    const totalCollaborators = report?.Collaborators?.length || 0;
    
    if (direction === 'right') {
      const maxIndex = Math.max(0, totalCollaborators - maxVisible);
      setCollaboratorScrollIndex(prev => ({
        ...prev,
        [reportId]: Math.min(currentIndex + 1, maxIndex),
      }));
    } else {
      setCollaboratorScrollIndex(prev => ({
        ...prev,
        [reportId]: Math.max(0, currentIndex - 1),
      }));
    }
  };

  const handleDelete = async (id: string) => {
    // Check privilege before showing confirmation
    const report = reports.find(r => r.id === id);
    if (!report) return;
    
    // Check if user has appropriate privilege
    const hasDeletePrivilege = canDeleteVisible || report.isOwner;
    if (!hasDeletePrivilege) {
      showAccessDenied('Delete FMIR Report', FMIR_PRIVILEGES.DELETE);
      return;
    }
    
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    setDeleting(id);
    try {
      await api.delete(`/fmir/${id}`);
      setReports(reports.filter(r => r.id !== id));
    } catch (err: any) {
      console.error('Error deleting report:', err);
      // Check if it's a privilege error
      if (err.response?.status === 403) {
        showAccessDenied('Delete FMIR Report', err.response?.data?.privilegeKey || FMIR_PRIVILEGES.DELETE);
        return;
      }
      // Show the detailed message from backend if available as toast
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to delete report';
      setToastType('error');
      setToastMessage(errorMessage);
      // Auto-dismiss toast after 5 seconds
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setDeleting(null);
    }
  };

  // Handle starting RCA for an FMIR under investigation
  const handleStartRCA = async (reportId: string) => {
    setStartingRCA(reportId);
    try {
      const response = await api.post(`/fmir/${reportId}/start-rca`);
      if (response.data.success) {
        const { incident, isExisting } = response.data.data;
        
        if (isExisting) {
          setToastType('info');
          setToastMessage('An incident already exists for this FMIR. Navigating to it...');
        } else {
          setToastType('success');
          setToastMessage(`Incident ${incident.incidentNumber} created successfully! Navigating to RCA...`);
        }
        
        // Navigate to the incident page after a short delay
        setTimeout(() => {
          router.push(`/incidents/${incident.id}`);
        }, 500);
      }
    } catch (err: any) {
      console.error('Error starting RCA:', err);
      // Check if this is a privilege error (403)
      if (err.response?.status === 403) {
        showAccessDenied('Start RCA Investigation', err.response?.data?.privilegeKey || 'incidents.create');
        return;
      }
      const errorMessage = err.response?.data?.error || 'Failed to start RCA';
      setToastType('error');
      setToastMessage(errorMessage);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setStartingRCA(null);
    }
  };

  // Helper function to check if user can see the delete button
  // Uses privilege-based access control
  const canDeleteReport = (report: FMIRReport) => {
    // Users with DELETE_VISIBLE privilege can delete any visible report
    if (canDeleteVisible && report.isVisible === true) {
      return true;
    }
    
    // Admin roles (SYSTEM_ADMIN has all privileges) can delete any report
    if (user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN') {
      return true;
    }
    
    // All other users can only delete their own reports
    // Backend validates additional restrictions (visibility, section initials, etc.)
    return report.isOwner === true;
  };

  // Toggle visibility - only owner can do this
  const toggleVisibility = async (reportId: string, currentVisibility: boolean) => {
    setTogglingVisibility(reportId);
    try {
      const response = await api.patch(`/fmir/${reportId}/visibility`, {
        isVisible: !currentVisibility,
      });
      if (response.data.success) {
        // Update the report in state
        setReports(prev => prev.map(r => 
          r.id === reportId ? { ...r, isVisible: !currentVisibility } : r
        ));
      }
    } catch (err: any) {
      console.error('Error toggling visibility:', err);
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Toggle Visibility');
    } finally {
      setTogglingVisibility(null);
    }
  };

  // Toggle closed status - only QA/Food Safety can do this
  const toggleClosedStatus = async (reportId: string, currentClosedStatus: boolean) => {
    // Get report number for display
    const report = reports.find(r => r.id === reportId);
    
    // Only show loading modal when closing (AI audit runs)
    if (!currentClosedStatus && report) {
      // Set ref FIRST so WebSocket events can match immediately
      auditLoadingReportIdRef.current = reportId;
      console.log('🎯 Setting audit report ID ref BEFORE modal:', reportId);
      
      setAuditLoadingReport(report);
      setAuditLoadingMessageIndex(0);
      setAuditLoadingPhase(0);
      setShowAuditLoadingModal(true);
    }
    
    setTogglingClosedStatus(reportId);
    try {
      // Use extended timeout (3 minutes) for this operation since it involves AI audit analysis
      const responseData = await apiWithExtendedTimeout<{
        success: boolean;
        validationPassed?: boolean;
        successAudit?: any;
        reportNumber?: string;
        data?: any;
      }>({
        method: 'PATCH',
        url: `/fmir/${reportId}/closed-status`,
        data: { isClosed: !currentClosedStatus },
      }, 180000); // 3 minutes timeout for AI-powered audit

      // Close loading modal and clear ref
      setShowAuditLoadingModal(false);
      setAuditLoadingReport(null);
      auditLoadingReportIdRef.current = null;

      if (responseData.success) {
        // Update the report in state
        setReports(prev => prev.map(r => 
          r.id === reportId ? { 
            ...r, 
            isClosed: !currentClosedStatus,
            closedAt: !currentClosedStatus ? new Date().toISOString() : undefined,
            closedById: !currentClosedStatus ? user?.id : undefined,
          } : r
        ));
        
        // If this was a successful lock (isClosed was false, now true), show success modal
        if (!currentClosedStatus && responseData.validationPassed && responseData.successAudit) {
          setSuccessAudit(responseData.successAudit);
          setSuccessReportNumber(responseData.reportNumber || report?.reportNumber || '');
          setShowSuccessModal(true);
        }
      }
    } catch (err: any) {
      console.error('Error toggling closed status:', err);
      
      // Close loading modal and clear ref
      setShowAuditLoadingModal(false);
      setAuditLoadingReport(null);
      auditLoadingReportIdRef.current = null;
      
      // Check if this is a validation failure
      if (err.response?.data?.validationFailed) {
        setValidationResult(err.response.data.validation);
        setComplianceAnalysis(err.response.data.compliance);
        setValidationReportNumber(err.response.data.reportNumber || report?.reportNumber || '');
        setValidationReportId(reportId);
        setShowValidationModal(true);
      } 
      // Check if this is an audit blocking scenario (quality issues found)
      else if (err.response?.data?.auditBlocked) {
        setSuccessAudit(err.response.data.successAudit);
        setSuccessReportNumber(err.response.data.reportNumber || report?.reportNumber || '');
        setSuccessReportId(reportId); // Store report ID for potential override
        setShowOverrideConfirm(false); // Reset override state
        setShowSuccessModal(true); // Show the audit modal with blocking reasons
      } 
      // Check for timeout errors
      else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Request timed out. The AI audit is taking longer than expected. Please try again.');
      }
      else {
        // Check if this is a privilege error (403)
        handlePrivilegeError(err, showAccessDenied, setError, 'Lock/Unlock Report');
      }
    } finally {
      setTogglingClosedStatus(null);
    }
  };

  // Override passing score and force close - QA only
  const handleOverrideAndClose = async () => {
    if (!successReportId || !successAudit) return;
    
    setIsOverriding(true);
    try {
      const responseData = await apiWithExtendedTimeout<{
        success: boolean;
        validationPassed?: boolean;
        successAudit?: any;
        reportNumber?: string;
        data?: any;
        qaOverride?: boolean;
      }>({
        method: 'PATCH',
        url: `/fmir/${successReportId}/closed-status`,
        data: { 
          isClosed: true,
          overridePassingScore: true, // Signal that QA is overriding
        },
      }, 180000);

      if (responseData.success) {
        // Update the report in state
        setReports(prev => prev.map(r => 
          r.id === successReportId ? { 
            ...r, 
            isClosed: true,
            closedAt: new Date().toISOString(),
            closedById: user?.id,
          } : r
        ));
        
        // Update the modal to show success
        setSuccessAudit(prev => prev ? {
          ...prev,
          canBeClosed: true,
          overallVerdict: 'SATISFACTORY' as const,
          summary: {
            ...prev.summary,
            headline: `QA Override: Report closed with score of ${prev.auditScore}%`,
          },
        } : null);
        
        setShowOverrideConfirm(false);
        
        // Show success toast
        setToastType('success');
        setToastMessage(`FMIR ${successReportNumber} has been closed with QA override`);
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('Error overriding and closing:', err);
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Override and Close');
      setShowOverrideConfirm(false);
    } finally {
      setIsOverriding(false);
    }
  };

  // Toggle investigation status - only QA/Food Safety can do this on SUBMITTED reports
  const toggleInvestigationStatus = async (reportId: string, currentStatus: string) => {
    setTogglingInvestigationStatus(reportId);
    try {
      // If currently SUBMITTED, change to UNDER_INVESTIGATION
      // If currently UNDER_INVESTIGATION, this toggle would change back to SUBMITTED (but we'll only show this toggle when SUBMITTED)
      const newStatus = currentStatus === 'SUBMITTED' ? 'UNDER_INVESTIGATION' : 'SUBMITTED';
      
      const response = await api.patch(`/fmir/${reportId}/status`, { status: newStatus });

      if (response.data.success) {
        // Update the report in state
        setReports(prev => prev.map(r => 
          r.id === reportId ? { ...r, status: newStatus as FMIRReport['status'] } : r
        ));
        // Show success toast (only for the user who initiated the action)
        setToastType('success');
        setToastMessage(`Report status changed to ${newStatus === 'UNDER_INVESTIGATION' ? 'Under Investigation' : 'Submitted'}`);
        // Auto-dismiss toast after 5 seconds
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('Error toggling investigation status:', err);
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Toggle Investigation');
    } finally {
      setTogglingInvestigationStatus(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      DRAFT: {
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-700 dark:text-gray-300',
        icon: <Edit className="w-3 h-3" />,
      },
      SUBMITTED: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-400',
        icon: <FileCheck className="w-3 h-3" />,
      },
      UNDER_INVESTIGATION: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        icon: <Clock className="w-3 h-3" />,
      },
      RESOLVED: {
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-400',
        icon: <CheckCircle className="w-3 h-3" />,
      },
      CLOSED: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        icon: <CheckCircle className="w-3 h-3" />,
      },
    };

    const config = statusConfig[status] || statusConfig.DRAFT;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.icon}
        {status.replace('_', ' ')}
      </span>
    );
  };

  // Get OPEN/CLOSED indicator - based on isClosed field (controlled by QA/Food Safety)
  const getOpenClosedBadge = (isClosed: boolean = false) => {
    if (!isClosed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CircleDot className="w-2.5 h-2.5" />
          OPEN
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
        <Lock className="w-2.5 h-2.5" />
        CLOSED
      </span>
    );
  };

  // Show loading while checking privileges
  if (privilegesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Checking access permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  Foreign Material Incident Reports
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage and track foreign material incidents
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(isQualityControlManager || user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN') && (
                <Link
                  href="/fmir/privileges"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  <span>Manage Privileges</span>
                </Link>
              )}
              <button
                onClick={handleCreateFMIR}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                <span>New Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 dark:text-red-400 font-medium">Error</p>
              <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by report number, product, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
                >
                  <option value="">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="UNDER_INVESTIGATION">Under Investigation</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <button
                onClick={fetchReports}
                disabled={loading}
                className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          {loading ? (
            <div className="relative flex items-center justify-center py-20 overflow-hidden">
              {/* Subtle background animation */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-32 h-32 bg-primary-400/10 rounded-full blur-2xl animate-pulse" />
                <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-40 h-40 bg-orange-400/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '500ms' }} />
              </div>
              
              {/* Glassy card */}
              <div className="relative flex flex-col items-center gap-4 p-8 backdrop-blur-xl bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-xl border border-white/50 dark:border-gray-700/50">
                {/* Glowing loader */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary-500 via-orange-500 to-amber-500 blur-md opacity-50 animate-pulse" />
                  <div className="relative p-4 bg-gradient-to-br from-primary-500 via-primary-600 to-orange-500 rounded-xl shadow-lg">
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 rounded-full border-3 border-white/30" />
                      <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-white animate-spin" />
                      <div className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-white/60 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                    </div>
                  </div>
                </div>
                
                {/* Text */}
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-gray-700 dark:text-gray-200 font-semibold text-lg">Loading reports...</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
                    <span className="inline-block w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="inline-block w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="inline-block w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="ml-0.5">Hang on, Fetching your data</span>
                  </span>
                </div>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <AlertTriangle className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No FMIR reports found</p>
              <p className="text-sm mt-1">Create your first Foreign Material Incident Report</p>
              <button
                onClick={handleCreateFMIR}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Report
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 sm:p-5 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:shadow-md transition-all duration-200 cursor-pointer"
                  onClick={(e) => {
                    // Don't navigate if clicking on interactive elements
                    const target = e.target as HTMLElement;
                    const isInteractive = target.closest('button') || target.closest('a') || target.closest('input') || target.closest('[role="button"]');
                    if (!isInteractive) {
                      router.push(`/fmir/${report.id}`);
                    }
                  }}
                >
                  <div className="flex flex-col gap-4">
                    {/* Main row: Report info + Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Report Number - Own line */}
                        <Link
                          href={`/fmir/${report.id}`}
                          className="text-lg font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors block mb-2"
                        >
                          {report.reportNumber}
                        </Link>
                        
                        {/* Status badges and toggles - Below the name, wraps on mobile */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {getStatusBadge(report.status)}
                          {getOpenClosedBadge(report.isClosed || false)}
                          
                          {/* Closed Status Toggle - Requires fmir.close privilege */}
                          {canCloseFMIR && (
                            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                              <button
                                onClick={() => toggleClosedStatus(report.id, report.isClosed || false)}
                                disabled={togglingClosedStatus === report.id}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                                  report.isClosed 
                                    ? 'bg-amber-500' 
                                    : 'bg-gray-300 dark:bg-gray-500'
                                } ${togglingClosedStatus === report.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                title={report.isClosed ? 'Report is CLOSED - Toggle to reopen and allow editing' : 'Report is OPEN - Toggle to close and lock editing'}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                                    report.isClosed ? 'translate-x-4' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {report.isClosed ? 'REOPEN' : 'CLOSE'}
                              </span>
                              {togglingClosedStatus === report.id && (
                                <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                              )}
                            </div>
                          )}
                          
                          {/* Investigation Toggle - Requires fmir.toggle_investigation privilege, only when status is SUBMITTED */}
                          {canToggleInvestigation && report.status === 'SUBMITTED' && !report.isClosed && (
                            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                              <button
                                onClick={() => toggleInvestigationStatus(report.id, report.status)}
                                disabled={togglingInvestigationStatus === report.id}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 bg-gray-300 dark:bg-gray-500 ${togglingInvestigationStatus === report.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                title="Start Investigation - Toggle to enable editing and change status to Under Investigation"
                              >
                                <span
                                  className="inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform translate-x-0.5"
                                />
                              </button>
                              <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                                INVESTIGATION
                              </span>
                              {togglingInvestigationStatus === report.id && (
                                <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                              )}
                            </div>
                          )}
                          
                          {/* Visibility Toggle - Only visible to owner */}
                          {report.isOwner && (
                            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                              <button
                                onClick={() => toggleVisibility(report.id, report.isVisible || false)}
                                disabled={togglingVisibility === report.id}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                                  report.isVisible 
                                    ? 'bg-primary-600' 
                                    : 'bg-gray-300 dark:bg-gray-600'
                                } ${togglingVisibility === report.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                title={report.isVisible ? 'Visible to others - Click to hide' : 'Hidden from others - Click to make visible'}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                                    report.isVisible ? 'translate-x-4' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                {togglingVisibility === report.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : report.isVisible ? (
                                  <>
                                    <Eye className="w-3 h-3 text-primary-500" />
                                    <span className="text-primary-600 dark:text-primary-400">VISIBLE To Others</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3 h-3 text-gray-400" />
                                    <span>Hidden</span>
                                  </>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                          {report.foreignMaterialDescription || 'No description provided'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(report.incidentDate), 'MMM d, yyyy')}
                          </span>
                          {report.productName && (
                            <span className="inline-flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              {report.productName}
                            </span>
                          )}
                          {report.Facility && (
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5" />
                              {report.Facility.name}
                            </span>
                          )}
                          {report.Evidence && report.Evidence.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-primary-600 dark:text-primary-400">
                              <FileCheck className="w-3.5 h-3.5" />
                              {report.Evidence.length} attachment{report.Evidence.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {canViewFMIR ? (
                          <Link
                            href={`/fmir/${report.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-600 dark:to-gray-700 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-500 dark:hover:to-gray-600 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-600 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Link>
                        ) : (
                          <button
                            onClick={() => showAccessDenied('View Foreign Material Report', FMIR_PRIVILEGES.VIEW)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-not-allowed opacity-60 border border-gray-200 dark:border-gray-600"
                            title="You don't have permission to view reports"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        )}
                        {/* Edit button - Show when status is DRAFT or UNDER_INVESTIGATION (and not closed) */}
                        {(report.isOwner || report.Collaborators?.some(c => c.id === user?.id)) && !report.isClosed && report.status !== 'SUBMITTED' && (
                          <Link
                            href={`/fmir/new?edit=${report.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-200 bg-gradient-to-b from-primary-50 to-primary-100 dark:from-primary-800/50 dark:to-primary-900/50 hover:from-primary-100 hover:to-primary-200 dark:hover:from-primary-700/50 dark:hover:to-primary-800/50 rounded-lg shadow-sm hover:shadow-md border border-primary-200 dark:border-primary-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </Link>
                        )}
                        {/* Locked Edit button - Show when closed */}
                        {(report.isOwner || report.Collaborators?.some(c => c.id === user?.id)) && report.isClosed && (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-not-allowed opacity-60"
                            title="This FMIR is closed and cannot be edited"
                          >
                            <Lock className="w-4 h-4" />
                            Edit
                          </span>
                        )}
                        {/* Locked Edit button - Show when status is SUBMITTED (awaiting QA to start investigation) */}
                        {(report.isOwner || report.Collaborators?.some(c => c.id === user?.id)) && !report.isClosed && report.status === 'SUBMITTED' && (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-not-allowed opacity-60"
                            title="This FMIR is submitted and awaiting QA to start investigation before editing is allowed"
                          >
                            <Lock className="w-4 h-4" />
                            Edit
                          </span>
                        )}
                        {/* RCA Button - Show when status is UNDER_INVESTIGATION */}
                        {report.status === 'UNDER_INVESTIGATION' && !report.isClosed && (
                          report.linkedIncidentId ? (
                            // RCA already initiated - show green button that links to incident
                            <Link
                              href={`/incidents/${report.linkedIncidentId}`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-200 bg-gradient-to-b from-green-50 to-green-100 dark:from-green-800/50 dark:to-green-900/50 hover:from-green-100 hover:to-green-200 dark:hover:from-green-700/50 dark:hover:to-green-800/50 rounded-lg shadow-sm hover:shadow-md border border-green-200 dark:border-green-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                              title={`View RCA Investigation: ${report.linkedIncidentNumber}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                              RCA Initiated
                            </Link>
                          ) : (
                            // No RCA yet - show amber button to start RCA
                            <button
                              onClick={() => handleStartRCA(report.id)}
                              disabled={startingRCA === report.id}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-200 bg-gradient-to-b from-amber-50 to-amber-100 dark:from-amber-800/50 dark:to-amber-900/50 hover:from-amber-100 hover:to-amber-200 dark:hover:from-amber-700/50 dark:hover:to-amber-800/50 rounded-lg shadow-sm hover:shadow-md border border-amber-200 dark:border-amber-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-sm"
                              title="Start Root Cause Analysis for this FMIR"
                            >
                              {startingRCA === report.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <GitBranch className="w-4 h-4" />
                              )}
                              RCA
                            </button>
                          )
                        )}
                        {canDeleteReport(report) && (
                          <button
                            onClick={() => handleDelete(report.id)}
                            disabled={deleting === report.id}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-200 bg-gradient-to-b from-red-50 to-red-100 dark:from-red-800/50 dark:to-red-900/50 hover:from-red-100 hover:to-red-200 dark:hover:from-red-700/50 dark:hover:to-red-800/50 rounded-lg shadow-sm hover:shadow-md border border-red-200 dark:border-red-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-sm"
                            title={
                              canDeleteVisible
                                ? 'Delete visible report'
                                : user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN'
                                  ? 'Delete report'
                                  : 'Delete your report'
                            }
                          >
                            {deleting === report.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Team/Collaborators Row */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        {/* Label */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <Users className="w-3.5 h-3.5" />
                          <span>Team:</span>
                        </div>

                        {/* Owner avatar on the left */}
                        {report.CreatedBy && (
                          <div className="flex items-center">
                            {(() => {
                              const qaUserIds = new Set(qaFoodSafetyUsers.map(u => u.id));
                              const ownerItem = { ...report.CreatedBy, isOwner: true, isQAFoodSafety: qaUserIds.has(report.CreatedBy.id) };
                              
                              return (
                                <div className="relative group animate-fade-in-right cursor-pointer">
                                  {ownerItem.profilePicture ? (
                                    <img
                                      src={ownerItem.profilePicture}
                                      alt={`${ownerItem.firstName} ${ownerItem.lastName}`}
                                      className="w-12 h-12 rounded-full object-cover border-3 shadow-lg transition-all duration-300 border-amber-400 ring-2 ring-amber-200 dark:ring-amber-800 group-hover:ring-4 group-hover:ring-amber-300 dark:group-hover:ring-amber-700 group-hover:scale-125 group-hover:rotate-3 group-hover:shadow-2xl group-hover:brightness-110"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-3 shadow-lg transition-all duration-300 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-white border-amber-300 ring-2 ring-amber-200 dark:ring-amber-800 group-hover:ring-4 group-hover:ring-amber-300 dark:group-hover:ring-amber-700 group-hover:from-amber-300 group-hover:via-orange-400 group-hover:to-red-400 group-hover:scale-125 group-hover:rotate-3 group-hover:shadow-2xl animate-pulse-soft">
                                      {getInitials(ownerItem.firstName, ownerItem.lastName)}
                                    </div>
                                  )}
                                  
                                  {/* Owner crown badge */}
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg animate-bounce-in group-hover:scale-125 transition-transform duration-300">
                                    <Crown className="w-3 h-3 text-white animate-pulse" />
                                  </div>

                                  {/* Online status indicator */}
                                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-md animate-pulse-soft" />

                                  {/* Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-700 dark:to-gray-600 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 whitespace-nowrap pointer-events-none z-50 shadow-2xl border border-gray-700 dark:border-gray-500">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">{ownerItem.firstName} {ownerItem.lastName}</span>
                                      <span className="px-2 py-0.5 bg-amber-500/30 rounded-full text-amber-200 text-[10px] font-bold">OWNER</span>
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Separator between owner and collaborators - only show if visible or not owner */}
                        {report.Collaborators && report.Collaborators.length > 0 && (report.isVisible || !report.isOwner) && (
                          <div className="h-8 w-px bg-gray-200 dark:bg-gray-600 mx-2" />
                        )}

                        {/* Collaborators avatars with navigation - hidden when visibility is OFF for owner */}
                        {report.Collaborators && report.Collaborators.length > 0 && (report.isVisible || !report.isOwner) && (
                          <div className="flex items-center gap-1">
                            {/* Left arrow */}
                            {(collaboratorScrollIndex[report.id] || 0) > 0 && (
                              <button
                                onClick={() => scrollCollaborators(report.id, 'left', 4)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                            )}

                            {/* Collaborator avatars container */}
                            <div className="flex items-center gap-2">
                              {(() => {
                                const scrollIndex = collaboratorScrollIndex[report.id] || 0;
                                const maxVisible = 4;
                                const qaUserIds = new Set(qaFoodSafetyUsers.map(u => u.id));
                                const collaborators = (report.Collaborators || []).map(c => ({ ...c, isOwner: false, isQAFoodSafety: qaUserIds.has(c.id) }));
                                const visibleUsers = collaborators.slice(scrollIndex, scrollIndex + maxVisible);
                                const remainingCount = collaborators.length - scrollIndex - maxVisible;

                                return (
                                  <>
                                    {visibleUsers.map((userItem, idx) => (
                                      <div
                                        key={userItem.id}
                                        className="relative group animate-fade-in-right"
                                        style={{ 
                                          animationDelay: `${idx * 100}ms`
                                        }}
                                      >
                                        {/* Avatar - clickable for non-QA users when owner */}
                                        <div
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Toggle menu for non-QA collaborators when user is owner
                                            if (!userItem.isQAFoodSafety && report.isOwner) {
                                              if (showCollaboratorMenu?.reportId === report.id && showCollaboratorMenu?.collaboratorId === userItem.id) {
                                                setShowCollaboratorMenu(null);
                                              } else {
                                                setShowCollaboratorMenu({ reportId: report.id, collaboratorId: userItem.id });
                                              }
                                            }
                                          }}
                                          className={`${!userItem.isQAFoodSafety && report.isOwner ? 'cursor-pointer' : 'cursor-default'}`}
                                        >
                                          {userItem.profilePicture ? (
                                            <img
                                              src={userItem.profilePicture}
                                              alt={`${userItem.firstName} ${userItem.lastName}`}
                                              className={`w-12 h-12 rounded-full object-cover border-3 shadow-lg transition-all duration-300 ${
                                                userItem.isQAFoodSafety
                                                  ? 'border-green-400 ring-2 ring-green-200 dark:ring-green-800 group-hover:ring-4 group-hover:ring-green-300 dark:group-hover:ring-green-700'
                                                  : 'border-white dark:border-gray-800 group-hover:ring-4 group-hover:ring-primary-300 dark:group-hover:ring-primary-700'
                                              } group-hover:scale-110 group-hover:shadow-2xl`}
                                            />
                                          ) : (
                                            <div
                                              className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-3 shadow-lg transition-all duration-300 ${
                                                userItem.isQAFoodSafety
                                                  ? 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 text-white border-green-300 ring-2 ring-green-200 dark:ring-green-800 group-hover:ring-4 group-hover:ring-green-300 dark:group-hover:ring-green-700'
                                                  : 'bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 text-white border-white dark:border-gray-800 group-hover:ring-4 group-hover:ring-primary-300 dark:group-hover:ring-primary-700'
                                              } group-hover:scale-110 group-hover:shadow-2xl`}
                                            >
                                              {getInitials(userItem.firstName, userItem.lastName)}
                                            </div>
                                          )}
                                        </div>

                                        {/* QA/Food Safety badge */}
                                        {userItem.isQAFoodSafety && (
                                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg animate-bounce-in group-hover:scale-125 transition-transform duration-300" title="QA/Food Safety - Auto-added">
                                            <CheckCircle className="w-3 h-3 text-white" />
                                          </div>
                                        )}

                                        {/* Online status indicator - hide when removing */}
                                        {removingCollaborator !== userItem.id && (
                                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-md animate-pulse-soft" />
                                        )}

                                        {/* Removing overlay with spinner */}
                                        {removingCollaborator === userItem.id && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                                          </div>
                                        )}

                                        {/* Click-based action menu for non-QA collaborators (owner only) */}
                                        {showCollaboratorMenu?.reportId === report.id && showCollaboratorMenu?.collaboratorId === userItem.id && (
                                          <div data-collaborator-menu className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[180px]">
                                              {/* Header with user name */}
                                              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                                                <p className="font-semibold text-gray-900 dark:text-white text-sm">{userItem.firstName} {userItem.lastName}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Collaborator</p>
                                              </div>
                                              {/* Actions */}
                                              <div className="p-2">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveCollaborator(report.id, userItem.id);
                                                    setShowCollaboratorMenu(null);
                                                  }}
                                                  disabled={removingCollaborator === userItem.id}
                                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                                >
                                                  {removingCollaborator === userItem.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                  ) : (
                                                    <X className="w-4 h-4" />
                                                  )}
                                                  Remove from Report
                                                </button>
                                              </div>
                                            </div>
                                            {/* Arrow pointing down */}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-3 h-3 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700 rotate-45" />
                                          </div>
                                        )}

                                        {/* Hover tooltip for QA users (info only) */}
                                        {userItem.isQAFoodSafety && (
                                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-700 dark:to-gray-600 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 whitespace-nowrap pointer-events-none z-50 shadow-2xl border border-gray-700 dark:border-gray-500">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm">{userItem.firstName} {userItem.lastName}</span>
                                              <span className="px-2 py-0.5 bg-green-500/30 rounded-full text-green-200 text-[10px] font-bold">QA</span>
                                            </div>
                                            <div className="mt-1 text-green-300 text-xs">
                                              Auto-added (QA/Food Safety)
                                            </div>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
                                          </div>
                                        )}
                                      </div>
                                    ))}

                                  {/* Remaining count badge with enhanced styling */}
                                  {remainingCount > 0 && (
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-gray-200 border-3 border-white dark:border-gray-800 shadow-lg hover:scale-110 transition-all duration-300 cursor-pointer animate-fade-in-right" 
                                         style={{ animationDelay: `${visibleUsers.length * 100}ms` }}>
                                      <span className="animate-pulse-soft">+{remainingCount}</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* Right arrow */}
                          {(() => {
                            const scrollIndex = collaboratorScrollIndex[report.id] || 0;
                            const maxVisible = 4;
                            const totalCollaborators = report.Collaborators?.length || 0;
                            return scrollIndex + maxVisible < totalCollaborators;
                          })() && (
                            <button
                              onClick={() => scrollCollaborators(report.id, 'right', 4)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        )}
                      </div>

                      {/* Add collaborator button (owner only, and only when visibility is ON) */}
                      {report.isOwner && report.isVisible && (
                        <div className="relative" ref={showUserDropdown === report.id ? dropdownRef : null}>
                          <button
                            onClick={() => {
                              setShowUserDropdown(showUserDropdown === report.id ? null : report.id);
                              setUserSearchQuery('');
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-lg transition-colors border border-primary-200 dark:border-primary-800"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Add
                          </button>

                          {/* Dropdown */}
                          {showUserDropdown === report.id && (
                            <>
                              {/* Mobile: Full-screen overlay */}
                              <div className="sm:hidden fixed inset-0 bg-black/50 z-[99]" onClick={() => setShowUserDropdown(null)} />
                              
                              {/* Mobile: Bottom sheet style / Desktop: Dropdown */}
                              <div className="fixed sm:absolute inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-[100] overflow-hidden max-h-[70vh] sm:max-h-none">
                                {/* Header for mobile */}
                                <div className="sm:hidden flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                                  <h3 className="font-semibold text-gray-900 dark:text-white">Add Collaborator</h3>
                                  <button
                                    onClick={() => setShowUserDropdown(null)}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                  >
                                    <X className="w-5 h-5 text-gray-500" />
                                  </button>
                                </div>
                                
                                {/* Search input */}
                                <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                      type="text"
                                      placeholder="Search users..."
                                      value={userSearchQuery}
                                      onChange={(e) => setUserSearchQuery(e.target.value)}
                                      className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      autoFocus
                                    />
                                  </div>
                                </div>

                                {/* User list */}
                                <div className="max-h-60 sm:max-h-60 overflow-y-auto">
                                  {getAvailableUsers(report).length === 0 ? (
                                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                      No users available
                                    </div>
                                  ) : (
                                    getAvailableUsers(report).map((availableUser) => (
                                      <button
                                        key={availableUser.id}
                                        onClick={() => handleAddCollaborator(report.id, availableUser.id)}
                                        disabled={addingCollaborator === availableUser.id}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors text-left disabled:opacity-50"
                                      >
                                        {availableUser.profilePicture ? (
                                          <img
                                            src={availableUser.profilePicture}
                                            alt=""
                                            className="w-8 h-8 rounded-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-medium">
                                            {getInitials(availableUser.firstName, availableUser.lastName)}
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {availableUser.firstName} {availableUser.lastName}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {availableUser.email}
                                          </p>
                                        </div>
                                        {addingCollaborator === availableUser.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                                        ) : (
                                          <Plus className="w-4 h-4 text-gray-400" />
                                        )}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Submitted By Row - Show when report has been submitted */}
                    {report.submittedAt && report.SubmittedBy && (
                      <div className="flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            <span>Submitted by:</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {report.SubmittedBy.firstName} {report.SubmittedBy.lastName}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            on {format(new Date(report.submittedAt), 'MMM d, yyyy')} at {format(new Date(report.submittedAt), 'h:mm a')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FMIR Validation Modal */}
      {showValidationModal && validationResult && complianceAnalysis && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-900/20 dark:to-amber-900/20">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-xl">
                    <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      FMIR Cannot Be Locked
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Report <span className="font-semibold">{validationReportNumber}</span> has incomplete information
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowValidationModal(false)}
                  className="p-2 hover:bg-white/50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Compliance Score */}
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Compliance Score:</span>
                  <span className={`text-2xl font-bold ${
                    complianceAnalysis.complianceScore >= 80 ? 'text-green-600' :
                    complianceAnalysis.complianceScore >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {complianceAnalysis.complianceScore}%
                  </span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  complianceAnalysis.overallCompliance === 'COMPLIANT' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : complianceAnalysis.overallCompliance === 'NEEDS_IMPROVEMENT'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {complianceAnalysis.overallCompliance.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI Explanation */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-5 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">AI Compliance Analysis</h3>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                  {complianceAnalysis.aiExplanation}
                </div>
              </div>

              {/* Missing Fields */}
              {validationResult.missingFields.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-5 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-3">
                    <FileWarning className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <h3 className="font-semibold text-red-900 dark:text-red-300">
                      Missing Required Fields ({validationResult.missingFields.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {validationResult.missingFields.map((field, idx) => (
                      <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-red-100 dark:border-red-900">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center">
                            {field.section || '!'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {field.label}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                              {field.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence Status */}
              <div className={`rounded-xl p-5 border ${
                validationResult.hasEvidence 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {validationResult.hasEvidence ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  )}
                  <h3 className={`font-semibold ${
                    validationResult.hasEvidence 
                      ? 'text-green-900 dark:text-green-300' 
                      : 'text-red-900 dark:text-red-300'
                  }`}>
                    Evidence Attachments
                  </h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {complianceAnalysis.evidenceAnalysis.summary}
                </p>
                {complianceAnalysis.evidenceAnalysis.recommendations.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {complianceAnalysis.evidenceAnalysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Audit Readiness */}
              <div className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  Audit Readiness Assessment
                </h3>
                
                {complianceAnalysis.auditReadiness.concerns.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Concerns:</h4>
                    <ul className="space-y-1">
                      {complianceAnalysis.auditReadiness.concerns.map((concern, idx) => (
                        <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          {concern}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {complianceAnalysis.auditReadiness.strengths.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">Strengths:</h4>
                    <ul className="space-y-1">
                      {complianceAnalysis.auditReadiness.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Field Analysis (Collapsible) */}
              {complianceAnalysis.fieldAnalysis.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
                  <button
                    onClick={() => setExpandedSections(prev => ({ ...prev, fieldAnalysis: !prev.fieldAnalysis }))}
                    className="w-full p-4 flex items-center justify-between hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <h3 className="font-semibold text-amber-900 dark:text-amber-300">
                        Detailed Field Analysis ({complianceAnalysis.fieldAnalysis.length} issues)
                      </h3>
                    </div>
                    {expandedSections.fieldAnalysis ? (
                      <ChevronUp className="w-5 h-5 text-amber-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-amber-600" />
                    )}
                  </button>
                  
                  {expandedSections.fieldAnalysis && (
                    <div className="p-4 pt-0 space-y-3">
                      {complianceAnalysis.fieldAnalysis.map((item, idx) => (
                        <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-100 dark:border-amber-900">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                              Section {item.section}: {item.field}
                            </span>
                            {item.regulatoryReference && (
                              <button
                                onClick={() => fetchRegulationExplanation(
                                  item.regulatoryReference!,
                                  item.field,
                                  item.issue,
                                  item.recommendation
                                )}
                                className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 cursor-pointer transition-colors flex items-center gap-1"
                                title="Click to learn more about this regulation"
                              >
                                {item.regulatoryReference}
                                <Sparkles className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-red-600 dark:text-red-400 mb-1">{item.issue}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{item.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please complete all required fields and add evidence before locking this FMIR.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowValidationModal(false);
                    router.push(`/fmir/new?edit=${validationReportId}`);
                  }}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                >
                  Edit Report
                </button>
                <button
                  onClick={() => setShowValidationModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regulation Explanation Modal */}
      {showRegulationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                    <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Understanding This Regulation
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedRegulation?.reference}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRegulationModal(false)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {regulationLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 text-center">
                    Getting a clear explanation for you...
                  </p>
                </div>
              ) : regulationExplanation ? (
                <>
                  {/* Title */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      📋 {regulationExplanation.title}
                    </h3>
                  </div>

                  {/* Plain Explanation */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <span className="text-lg">💬</span> What This Means in Plain English
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                      {regulationExplanation.plainExplanation}
                    </p>
                  </div>

                  {/* Why It Matters */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                      <span className="text-lg">⚠️</span> Why This Matters
                    </h4>
                    <p className="text-amber-900 dark:text-amber-200 leading-relaxed">
                      {regulationExplanation.whyItMatters}
                    </p>
                  </div>

                  {/* Practical Example */}
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
                    <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
                      <span className="text-lg">🏭</span> Real-World Example
                    </h4>
                    <p className="text-green-900 dark:text-green-200 leading-relaxed">
                      {regulationExplanation.practicalExample}
                    </p>
                  </div>

                  {/* Key Takeaways */}
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                    <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-3 flex items-center gap-2">
                      <span className="text-lg">✅</span> Key Things to Remember
                    </h4>
                    <ul className="space-y-2">
                      {regulationExplanation.keyTakeaways.map((takeaway, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-purple-900 dark:text-purple-200">
                          <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
                          <span>{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <button
                onClick={() => setShowRegulationModal(false)}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Audit Loading Modal - Shown while AI is analyzing the report */}
      {showAuditLoadingModal && auditLoadingReport && (
        <div className="fixed inset-0 bg-blue-900/30 dark:bg-blue-950/40 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 md:p-6">
          <div className="w-full max-w-4xl h-[95vh] sm:h-[90vh] bg-gradient-to-br from-indigo-600/95 via-purple-600/95 to-pink-500/95 dark:from-indigo-900/95 dark:via-purple-900/95 dark:to-pink-800/95 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden relative animate-gradient-flow border border-white/20 flex flex-col">
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-r from-white/20 to-transparent rotate-12 animate-pulse" />
              <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-l from-white/15 to-transparent -rotate-12 animate-pulse" style={{ animationDelay: '0.5s' }} />
              {/* Floating particles */}
              <div className="absolute top-10 left-1/4 w-2 h-2 bg-white/30 rounded-full animate-float-particle" style={{ animationDelay: '0s' }} />
              <div className="absolute top-20 right-1/3 w-3 h-3 bg-white/20 rounded-full animate-float-particle" style={{ animationDelay: '1s' }} />
              <div className="absolute bottom-32 left-1/3 w-2 h-2 bg-white/25 rounded-full animate-float-particle" style={{ animationDelay: '2s' }} />
              <div className="absolute bottom-20 right-1/4 w-2 h-2 bg-white/30 rounded-full animate-float-particle" style={{ animationDelay: '3s' }} />
              {/* Scan line effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-20 animate-scan-line" />
            </div>
            
            <div className="relative p-4 sm:p-6 md:p-8 flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Header with AI Avatar and Personalized Greeting */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-6 mb-4 sm:mb-6 flex-shrink-0">
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center animate-rotating-glow">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 md:w-18 md:h-18 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 flex items-center justify-center shadow-xl">
                      <svg className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-2.517.427a10.05 10.05 0 01-3.34 0l-2.518-.428c-1.718-.293-2.299-2.379-1.067-3.61L11 15.6" />
                      </svg>
                    </div>
                  </div>
                  {/* Multiple pulsing rings */}
                  <div className="absolute inset-0 rounded-full border-2 border-white/40 animate-pulse-ring" />
                  <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
                  <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-pulse-ring" style={{ animationDelay: '1s' }} />
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">AI Internal Auditor</h2>
                  <p className="text-sm sm:text-base text-white/80">Quality Assurance Analysis</p>
                </div>
              </div>

              {/* Personalized Greeting Section - More compact */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 border border-white/20 flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl font-semibold text-white">
                      Hello {user?.firstName || 'Quality Assurance'} 👋
                    </h3>
                    <p className="text-sm text-white/80 mt-1">
                      I am your <span className="font-semibold text-cyan-300">{user?.organizationName || 'organization'}</span> Internal Auditor. Please wait while I review your FMIR report.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 p-2 sm:p-3 bg-white/10 rounded-lg flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                    <span className="text-xs sm:text-sm text-white/90">
                      Min. <span className="font-bold text-emerald-400">98%</span> required
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Content Grid - Responsive */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 flex-1 min-h-0 overflow-hidden">
                {/* Left Column - Dynamic Validation Steps */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 flex flex-col min-h-0">
                  <h4 className="text-sm sm:text-base font-semibold text-white/90 mb-4 flex items-center gap-2 flex-shrink-0">
                    <FileSearch className="w-5 h-5 text-cyan-400" />
                    Real-time Validation Progress
                    {auditValidationSteps.length > 0 && (
                      <span className="ml-auto text-xs text-white/60 font-normal">
                        {auditValidationSteps.filter(s => s.status === 'completed').length}/{auditValidationSteps.length} complete
                      </span>
                    )}
                  </h4>
                  <div className="space-y-2 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                    {auditValidationSteps.length === 0 ? (
                      /* Initial loading state when no steps received yet */
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                        <p className="text-white/80 text-sm">Initializing AI audit...</p>
                        <p className="text-white/50 text-xs mt-1">Connecting to audit engine</p>
                      </div>
                    ) : (
                      auditValidationSteps.map((step, index) => (
                        <div 
                          key={step.id} 
                          className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl transition-all duration-500 animate-slide-in-left ${
                            step.status === 'active' 
                              ? 'bg-white/20 border border-white/30 animate-step-progress' 
                              : step.status === 'completed'
                                ? 'bg-emerald-500/20 border border-emerald-400/30'
                                : 'bg-white/5 border border-white/10'
                          }`}
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                            step.status === 'active' 
                              ? 'bg-white/30' 
                              : step.status === 'completed'
                                ? 'bg-emerald-500'
                                : 'bg-white/10'
                          }`}>
                            {step.status === 'completed' ? (
                              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-checkmark" />
                            ) : step.status === 'active' ? (
                              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-spin" />
                            ) : (
                              <span className="text-white/50 text-sm font-medium">{index + 1}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${
                              step.status === 'active' ? 'text-white' : 
                              step.status === 'completed' ? 'text-emerald-300' : 'text-white/60'
                            }`}>
                              {step.label}
                            </p>
                            <p className={`text-xs mt-0.5 ${
                              step.status === 'active' ? 'text-white/80' : 'text-white/50'
                            }`}>
                              {step.description}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Column - Report Info & Insights */}
                <div className="flex flex-col gap-3 sm:gap-4 min-h-0 overflow-y-auto">
                  {/* Current Analysis Message */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {auditLoadingPhase === 0 && <FileSearch className="w-6 h-6 text-cyan-300 animate-bounce" />}
                        {auditLoadingPhase === 1 && <ShieldCheck className="w-6 h-6 text-emerald-300 animate-bounce" />}
                        {auditLoadingPhase === 2 && <CheckCircle className="w-6 h-6 text-yellow-300 animate-bounce" />}
                        {auditLoadingPhase === 3 && <Sparkles className="w-6 h-6 text-pink-300 animate-bounce" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm sm:text-base font-medium leading-relaxed min-h-[48px]">
                          {(() => {
                            const messages = [
                              { phase: 'check', text: `Analyzing foreign material: "${auditLoadingReport.foreignMaterialDescription?.substring(0, 60)}${(auditLoadingReport.foreignMaterialDescription?.length || 0) > 60 ? '...' : ''}"` },
                              { phase: 'check', text: auditLoadingReport.productName ? `Validating product documentation: ${auditLoadingReport.productName}` : 'Reviewing product information completeness...' },
                              { phase: 'check', text: auditLoadingReport.department ? `Checking ${auditLoadingReport.department} department compliance protocols...` : 'Verifying department-specific requirements...' },
                              { phase: 'check', text: 'Evaluating root cause analysis methodology and depth...' },
                              { phase: 'check', text: 'Assessing corrective action adequacy and implementation timeline...' },
                              { phase: 'check', text: 'Reviewing preventive measure effectiveness and sustainability...' },
                              { phase: 'evidence', text: `Analyzing ${auditLoadingReport.Evidence?.length || 0} evidence attachments for integrity and relevance...` },
                              { phase: 'regulation', text: 'Cross-referencing with FDA 21 CFR Part 117 requirements...' },
                              { phase: 'regulation', text: 'Verifying FSMA Preventive Controls compliance...' },
                              { phase: 'regulation', text: 'Checking GFSI certification requirements (SQF, BRC, FSSC 22000)...' },
                              { phase: 'quality', text: 'Computing answer quality scores across all sections...' },
                              { phase: 'quality', text: 'Generating detailed improvement recommendations...' },
                              { phase: 'final', text: 'Compiling comprehensive audit analysis report...' },
                              { phase: 'final', text: 'Almost done! Finalizing your quality assessment...' },
                            ];
                            return messages[auditLoadingMessageIndex % messages.length]?.text || 'Analyzing your report...';
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Report Info Card */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white/60 text-xs uppercase tracking-wider font-medium">Report Being Analyzed</span>
                      <span className="text-white text-sm font-mono bg-white/20 px-3 py-1 rounded-lg">#{auditLoadingReport.reportNumber}</span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3 text-white/90">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className="text-sm truncate">{auditLoadingReport.foreignMaterialDescription}</span>
                      </div>
                      {auditLoadingReport.productName && (
                        <div className="flex items-center gap-3 text-white/80">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-blue-400" />
                          </div>
                          <span className="text-sm truncate">{auditLoadingReport.productName}</span>
                        </div>
                      )}
                      {auditLoadingReport.department && (
                        <div className="flex items-center gap-3 text-white/80">
                          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                            <Building className="w-4 h-4 text-green-400" />
                          </div>
                          <span className="text-sm truncate">{auditLoadingReport.department}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rotating Insights Slideshow */}
                  <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 flex-1">
                    <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Audit Insights</h4>
                    <div className="relative overflow-hidden min-h-[60px]">
                      <div key={auditInsightIndex} className="animate-slide-in-left">
                        <p className="text-white/90 text-sm sm:text-base leading-relaxed">
                          {(() => {
                            const insights = [
                              { icon: "💡", text: "AI audits ensure consistent quality standards across all your facilities and shifts." },
                              { icon: "🔍", text: "Our AI analyzes thousands of data points in seconds for comprehensive compliance checking." },
                              { icon: "📊", text: "Reports with 98%+ scores demonstrate exemplary documentation and audit readiness." },
                              { icon: "🛡️", text: "Compliance with FDA regulations protects consumers, your employees, and your brand." },
                              { icon: "⚡", text: "AI-powered audits are 10x faster than traditional manual review processes." },
                              { icon: "🎯", text: "Our AI continuously learns from industry best practices and regulatory updates." },
                              { icon: "📋", text: "Every field in your report is checked against regulatory requirements and industry standards." },
                              { icon: "🏆", text: "High-scoring reports demonstrate your commitment to food safety excellence." },
                            ];
                            const insight = insights[auditInsightIndex % insights.length];
                            return <><span className="text-lg mr-2">{insight.icon}</span>{insight.text}</>;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Animated Progress Bar - Always visible at bottom */}
              <div className="mt-4 sm:mt-6 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-xs uppercase tracking-wider">Analysis Progress</span>
                  <span className="text-white/80 text-xs">
                    {auditValidationSteps.length > 0 
                      ? `${auditValidationSteps.filter(s => s.status === 'completed').length} of ${auditValidationSteps.length} steps complete`
                      : 'Initializing...'}
                  </span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  {auditValidationSteps.length > 0 ? (
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${Math.max(5, (auditValidationSteps.filter(s => s.status === 'completed').length / Math.max(auditValidationSteps.length, 1)) * 100)}%` 
                      }}
                    />
                  ) : (
                    <div className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 rounded-full animate-loading-bar" />
                  )}
                </div>
              </div>

              {/* Footer Fun Fact */}
              <div className="mt-3 pt-3 border-t border-white/10 text-center flex-shrink-0">
                <p className="text-white/50 text-xs sm:text-sm">
                  ⚡ AI-powered audits are 10x faster than manual review.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FMIR Success Modal - Shown when all validations pass OR when audit blocks closure */}
      {showSuccessModal && successAudit && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className={`
            w-full max-w-5xl overflow-hidden flex flex-col
            rounded-2xl sm:rounded-3xl shadow-2xl
            max-h-[92vh] sm:max-h-[90vh]
            ${/* Light theme: Glassy translucent effect */''}
            bg-white/80 dark:bg-gray-800/95
            backdrop-blur-xl backdrop-saturate-150
            border border-white/50 dark:border-gray-700/50
            ring-1 ring-black/5 dark:ring-white/5
          `}>
            {/* Header - Dynamic based on canBeClosed */}
            <div className={`p-4 sm:p-6 border-b border-white/30 dark:border-gray-700 relative overflow-hidden flex-shrink-0 ${
              successAudit.canBeClosed 
                ? 'bg-gradient-to-r from-emerald-50/90 via-green-50/90 to-teal-50/90 dark:from-emerald-900/40 dark:via-green-900/40 dark:to-teal-900/40'
                : 'bg-gradient-to-r from-red-50/90 via-orange-50/90 to-amber-50/90 dark:from-red-900/40 dark:via-orange-900/40 dark:to-amber-900/40'
            }`}>
              {/* Decoration - conditional - hidden on mobile */}
              {successAudit.canBeClosed ? (
                <div className="absolute inset-0 opacity-10 hidden sm:block">
                  <div className="absolute top-2 left-10 text-4xl">🎉</div>
                  <div className="absolute top-4 right-20 text-3xl">⭐</div>
                  <div className="absolute bottom-2 left-1/4 text-3xl">✨</div>
                  <div className="absolute bottom-4 right-1/3 text-2xl">🏆</div>
                </div>
              ) : (
                <div className="absolute inset-0 opacity-10 hidden sm:block">
                  <div className="absolute top-2 left-10 text-4xl">⚠️</div>
                  <div className="absolute top-4 right-20 text-3xl">📋</div>
                  <div className="absolute bottom-2 left-1/4 text-3xl">🔍</div>
                  <div className="absolute bottom-4 right-1/3 text-2xl">📝</div>
                </div>
              )}
              
              <div className="flex items-start justify-between relative gap-2">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-lg flex-shrink-0 ${
                    successAudit.canBeClosed 
                      ? 'bg-gradient-to-br from-emerald-400 to-green-600'
                      : 'bg-gradient-to-br from-red-400 to-orange-600'
                  }`}>
                    {successAudit.canBeClosed ? (
                      <Trophy className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
                    ) : (
                      <AlertCircle className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {successAudit.canBeClosed ? (
                        <>Congratulations! <span className="text-2xl sm:text-3xl">🎊</span></>
                      ) : (
                        <>Action Required <span className="text-2xl sm:text-3xl">⚠️</span></>
                      )}
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                      <span className={`font-semibold break-all ${successAudit.canBeClosed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {successReportNumber}
                      </span> 
                      {successAudit.canBeClosed ? (
                        <> is now <span className="font-bold text-green-600">CLOSED</span> and audit-ready</>
                      ) : (
                        <> <span className="font-bold text-red-600">cannot be closed</span> until issues are resolved</>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="p-2 hover:bg-white/50 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Audit Score - responsive */}
              <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2 sm:gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl px-3 sm:px-5 py-2 sm:py-3 shadow-sm">
                  <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Audit Score:</span>
                  <span className={`text-3xl font-bold ${
                    successAudit.auditScore >= 95 ? 'text-emerald-600' :
                    successAudit.auditScore >= 85 ? 'text-green-600' : 
                    successAudit.auditScore >= 75 ? 'text-teal-600' :
                    successAudit.auditScore >= 65 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {successAudit.auditScore}%
                  </span>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 ${
                  successAudit.overallVerdict === 'EXCELLENT' 
                    ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 dark:from-emerald-900/50 dark:to-green-900/50 dark:text-emerald-300'
                    : successAudit.overallVerdict === 'GOOD'
                    ? 'bg-gradient-to-r from-green-100 to-teal-100 text-green-700 dark:from-green-900/50 dark:to-teal-900/50 dark:text-green-300'
                    : successAudit.overallVerdict === 'SATISFACTORY'
                    ? 'bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-700 dark:from-teal-900/50 dark:to-cyan-900/50 dark:text-teal-300'
                    : successAudit.overallVerdict === 'NEEDS_IMPROVEMENT'
                    ? 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 dark:from-amber-900/50 dark:to-yellow-900/50 dark:text-amber-300'
                    : 'bg-gradient-to-r from-red-100 to-orange-100 text-red-700 dark:from-red-900/50 dark:to-orange-900/50 dark:text-red-300'
                }`}>
                  {successAudit.overallVerdict === 'EXCELLENT' && <Star className="w-4 h-4" />}
                  {successAudit.overallVerdict === 'GOOD' && <ThumbsUp className="w-4 h-4" />}
                  {successAudit.overallVerdict === 'SATISFACTORY' && <CheckCircle className="w-4 h-4" />}
                  {successAudit.overallVerdict === 'NEEDS_IMPROVEMENT' && <AlertCircle className="w-4 h-4" />}
                  {successAudit.overallVerdict === 'CANNOT_CLOSE' && <XCircle className="w-4 h-4" />}
                  {successAudit.overallVerdict === 'CANNOT_CLOSE' ? 'Cannot Close' : successAudit.overallVerdict.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 bg-white/50 dark:bg-gray-800/50">
              {/* BLOCKING REASONS - Only show if cannot be closed */}
              {!successAudit.canBeClosed && successAudit.blockingReasons && successAudit.blockingReasons.length > 0 && (
                <div className="bg-gradient-to-r from-red-50/90 to-orange-50/90 dark:from-red-900/30 dark:to-orange-900/30 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-red-300 dark:border-red-800">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-red-800 dark:text-red-300 mb-3 text-sm sm:text-base">
                        Issues Blocking Closure ({successAudit.blockingReasons.length})
                      </h3>
                      <div className="space-y-2">
                        {successAudit.blockingReasons.map((reason, idx) => (
                          <div key={idx} className="flex items-start gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg px-3 sm:px-4 py-2 sm:py-3 border border-red-200 dark:border-red-700">
                            <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs sm:text-sm text-red-800 dark:text-red-200">{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* IMMEDIATE ACTIONS - Show when there are actions required */}
              {successAudit.summary.immediateActions && successAudit.summary.immediateActions.length > 0 && !successAudit.canBeClosed && (
                <div className="bg-gradient-to-r from-amber-50/90 to-yellow-50/90 dark:from-amber-900/30 dark:to-yellow-900/30 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-amber-300 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-3 text-sm sm:text-base">
                        Required Actions Before Closure
                      </h3>
                      <ul className="space-y-2">
                        {successAudit.summary.immediateActions.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                            <Target className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Headline - Conditional styling */}
              <div className={`rounded-xl p-4 sm:p-5 border backdrop-blur-sm ${
                successAudit.canBeClosed 
                  ? 'bg-gradient-to-r from-emerald-50/90 to-teal-50/90 dark:from-emerald-900/30 dark:to-teal-900/30 border-emerald-200 dark:border-emerald-800'
                  : 'bg-gradient-to-r from-gray-50/90 to-slate-50/90 dark:from-gray-900/30 dark:to-slate-900/30 border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-start gap-3">
                  <Award className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5 ${
                    successAudit.canBeClosed ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                      {successAudit.summary.headline}
                    </p>
                    {successAudit.summary.keyStrengths.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
                        {successAudit.summary.keyStrengths.map((strength, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                            <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            {strength}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Critical Concerns */}
                    {successAudit.summary.criticalConcerns && successAudit.summary.criticalConcerns.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
                        {successAudit.summary.criticalConcerns.map((concern, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm bg-red-50/80 dark:bg-red-900/40 backdrop-blur-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700">
                            <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            {concern}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ANSWER QUALITY ASSESSMENT - New section */}
              {successAudit.answerQuality && successAudit.answerQuality.assessments.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Answer Quality Assessment
                        </h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          successAudit.answerQuality.overallScore >= 80 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                            : successAudit.answerQuality.overallScore >= 65
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                        }`}>
                          Overall: {successAudit.answerQuality.overallScore}%
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          successAudit.answerQuality.passesMinimumStandard
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                        }`}>
                          {successAudit.answerQuality.passesMinimumStandard ? '✓ Meets Standards' : '✗ Below Standards'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {successAudit.answerQuality.assessments.map((assessment, idx) => (
                      <div key={idx} className={`rounded-lg p-4 border ${
                        assessment.isAdequate 
                          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                      }`}>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            {assessment.isAdequate ? (
                              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            )}
                            <span className="font-semibold text-gray-900 dark:text-white">{assessment.field}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            assessment.qualityScore >= 80 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                              : assessment.qualityScore >= 65
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                          }`}>
                            {assessment.qualityScore}%
                          </span>
                        </div>
                        
                        {/* User's Answer */}
                        <div className="mb-3 px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 italic">
                          &quot;{assessment.answer.length > 200 ? assessment.answer.substring(0, 200) + '...' : assessment.answer}&quot;
                        </div>
                        
                        {/* Issues */}
                        {assessment.issues.length > 0 && (
                          <div className="mb-3">
                            <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">Issues:</span>
                            <ul className="mt-1 space-y-1">
                              {assessment.issues.map((issue, iIdx) => (
                                <li key={iIdx} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                                  <span className="text-red-500">•</span>
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Recommendations */}
                        {assessment.recommendations.length > 0 && (
                          <div className="mb-2">
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">Recommendations:</span>
                            <ul className="mt-1 space-y-1">
                              {assessment.recommendations.map((rec, rIdx) => (
                                <li key={rIdx} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Example Answer - How it should be written */}
                        {assessment.exampleAnswer && !assessment.isAdequate && (
                          <div className="mt-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase">Example - Here&apos;s how you could write this:</span>
                            </div>
                            <div className="px-3 py-2 bg-white dark:bg-gray-800 rounded border border-emerald-300 dark:border-emerald-700 text-sm text-gray-800 dark:text-gray-200 italic leading-relaxed">
                              &quot;{assessment.exampleAnswer}&quot;
                            </div>
                            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              You can adapt this example to fit your specific situation
                            </p>
                          </div>
                        )}
                        
                        {/* Regulatory Gap */}
                        {assessment.regulatoryGap && (
                          <div className="mt-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-800 dark:text-red-200 flex items-start gap-2">
                            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span><strong>Regulatory Gap:</strong> {assessment.regulatoryGap}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Report Summary Section */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  Report Summary
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Incident Overview</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{successAudit.reportSummary.incidentOverview}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Foreign Material</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{successAudit.reportSummary.foreignMaterial}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Cause Analysis</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{successAudit.reportSummary.causeAnalysis}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Corrective Actions</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{successAudit.reportSummary.correctiveActions}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Verification</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{successAudit.reportSummary.verification}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Final Disposition</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{successAudit.reportSummary.disposition}</p>
                  </div>
                  <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Prevention Measures</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{successAudit.reportSummary.prevention}</p>
                  </div>
                </div>
              </div>

              {/* AI Auditor Narrative - The main feedback section */}
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-900/20 dark:via-indigo-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg">Marcus, Your AI Auditor</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-medium">
                        25+ Years Experience
                      </span>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                        {successAudit.auditorNarrative}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Field-by-Field Validation (Collapsible) */}
              {successAudit.fieldValidation && successAudit.fieldValidation.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => setExpandedFieldDetails(!expandedFieldDetails)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Detailed Field Review ({successAudit.fieldValidation.length} fields analyzed)
                      </h3>
                    </div>
                    {expandedFieldDetails ? (
                      <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                  
                  {expandedFieldDetails && (
                    <div className="p-4 pt-0 space-y-3 border-t border-gray-100 dark:border-gray-700">
                      {successAudit.fieldValidation.map((field, idx) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">
                                {field.section}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white text-sm">
                                {field.field}
                              </span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                              field.assessment === 'excellent' 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                : field.assessment === 'good'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                : field.assessment === 'acceptable'
                                ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                            }`}>
                              {field.assessment === 'excellent' && <Star className="w-3 h-3" />}
                              {field.assessment === 'good' && <ThumbsUp className="w-3 h-3" />}
                              {field.assessment === 'acceptable' && <CheckCircle className="w-3 h-3" />}
                              {field.assessment === 'needs_attention' && <AlertCircle className="w-3 h-3" />}
                              {field.assessment.replace('_', ' ').charAt(0).toUpperCase() + field.assessment.replace('_', ' ').slice(1)}
                            </span>
                          </div>
                          
                          {field.value && (
                            <div className="mb-2 px-2 py-1.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 italic">
                              &quot;{field.value.length > 150 ? field.value.substring(0, 150) + '...' : field.value}&quot;
                            </div>
                          )}
                          
                          <p className="text-sm text-gray-700 dark:text-gray-300">{field.feedback}</p>
                          
                          {field.suggestion && (
                            <div className="mt-2 flex items-start gap-2 text-sm">
                              <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                              <span className="text-amber-700 dark:text-amber-300">{field.suggestion}</span>
                            </div>
                          )}
                          
                          {/* Example Answer - Only shown for fields that need attention */}
                          {field.exampleAnswer && (field.assessment === 'needs_attention' || field.assessment === 'inadequate') && (
                            <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <div className="flex items-center gap-2 mb-2">
                                <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase">Example Answer:</span>
                              </div>
                              <div className="px-3 py-2 bg-white dark:bg-gray-800 rounded border border-emerald-300 dark:border-emerald-700 text-sm text-gray-800 dark:text-gray-200 italic leading-relaxed">
                                &quot;{field.exampleAnswer}&quot;
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Closing Statement - Conditional styling */}
              <div className={`rounded-xl p-5 border ${
                successAudit.canBeClosed 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
                  : 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    successAudit.canBeClosed 
                      ? 'bg-green-100 dark:bg-green-900/50'
                      : 'bg-amber-100 dark:bg-amber-900/50'
                  }`}>
                    {successAudit.canBeClosed ? (
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <p className={`font-medium ${
                    successAudit.canBeClosed 
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-amber-800 dark:text-amber-200'
                  }`}>
                    {successAudit.closingStatement}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer - Conditional based on canBeClosed - Glassy effect */}
            <div className={`p-3 sm:p-4 border-t flex flex-col gap-3 backdrop-blur-sm ${
              successAudit.canBeClosed 
                ? 'border-white/30 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60'
                : 'border-amber-200/50 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/30'
            }`}>
              {/* QA Override Section - Only show when cannot be closed */}
              {!successAudit.canBeClosed && (
                <div className="bg-gradient-to-r from-purple-50/90 to-indigo-50/90 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                  {!showOverrideConfirm ? (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-purple-800 dark:text-purple-200 text-sm">QA Override Available</h4>
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                            You can accept the current score of <span className="font-bold">{successAudit.auditScore}%</span> as the passing threshold and close this report anyway.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowOverrideConfirm(true)}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        <Unlock className="w-4 h-4" />
                        Override & Close
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-amber-800 dark:text-amber-200 text-sm">Confirm Override</h4>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            You are about to close this FMIR with a score of <span className="font-bold">{successAudit.auditScore}%</span>.
                            This action will be logged and the report will be marked as QA-overridden for audit trail purposes.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <button
                          onClick={() => setShowOverrideConfirm(false)}
                          disabled={isOverriding}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleOverrideAndClose}
                          disabled={isOverriding}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow hover:shadow-lg transition-all flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isOverriding ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Closing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Confirm Override & Close
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Standard footer buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {successAudit.canBeClosed ? (
                    <>
                      <Lock className="w-4 h-4 flex-shrink-0" />
                      <span>This FMIR is now locked and saved for audit records.</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-amber-700 dark:text-amber-300">Please address the issues above and try closing again.</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className={`w-full sm:w-auto px-5 sm:px-6 py-2.5 font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 justify-center ${
                    successAudit.canBeClosed 
                      ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                  }`}
                >
                  {successAudit.canBeClosed ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Done
                    </>
                  ) : (
                    <>
                      <ArrowLeft className="w-5 h-5" />
                      Go Back to Edit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className={`${toastType === 'error' ? 'bg-red-600' : 'bg-blue-600'} text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md`}>
            {toastType === 'error' ? (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className={`ml-2 ${toastType === 'error' ? 'hover:bg-red-700' : 'hover:bg-blue-700'} rounded p-1 transition-colors`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Access Denied Modal */}
      {accessDeniedModal}
    </div>
  );
}

export default function FMIRListPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <FMIRListContent />
    </ProtectedRoute>
  );
}
