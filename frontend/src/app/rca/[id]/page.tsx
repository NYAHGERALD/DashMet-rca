'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardList, Loader2, Pencil } from 'lucide-react';
import api from '@/lib/api';
import LoadingState from '@/components/ui/LoadingState';
import { formatDateTime } from '@/lib/dateUtils';
import FiveWhysBuilder from '@/components/rca/FiveWhysBuilder';
import FishboneBuilder from '@/components/rca/FishboneBuilder';
import TimelinePanel from '@/components/rca/TimelinePanel';
import EvidencePanel from '@/components/rca/EvidencePanel';
import CommentPanel from '@/components/rca/CommentPanel';
import { ChatSidebar } from '@/components/team';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/lib/websocket';
import { usePrivileges, INCIDENTS_PRIVILEGES, RCA_PRIVILEGES, CAPA_PRIVILEGES } from '@/lib/usePrivileges';
import { useAccessDeniedModal, handlePrivilegeError } from '@/components/modals/AccessDeniedModal';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import IncidentFormModal from '@/components/incidents/IncidentFormModal';

interface Participant {
  id: string;
  userId: string;
  role: 'OWNER' | 'LEAD' | 'MEMBER' | 'OBSERVER';
  canEdit: boolean;
  canChat: boolean;
  isActive?: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isOnline?: boolean;
  };
}

interface RCAAnalysis {
  id: string;
  method: 'FIVE_WHYS' | 'FISHBONE';
  status: string;
  aiRecommendedMethod: string | null;
  aiRecommendationReason: string | null;
  rootCauseStatement: string | null;
  fiveWhysData: any;
  fishboneData: any;
  isValidated: boolean;
  validatedAt: string | null;
  incidentId: string;
  createdAt: string;
  updatedAt: string;
  incident: {
    id: string;
    incidentNumber: string;
    description: string;
    type: string;
    status: string;
    severity: string | null;
    reportedAt?: string;
    occurredAt?: string;
    isTeamIncident?: boolean;
    visibility?: 'PRIVATE' | 'TEAM' | 'PUBLIC';
    category: { name: string };
    facility: { name: string };
    department?: { name: string };
    area?: { name: string };
    line?: { name: string };
    shift?: { name: string };
    evidence: any[];
    createdBy: {
      id: string;
      firstName: string;
      lastName: string;
    };
    participants?: Participant[];
    // AI analysis data from incident
    aiSummary?: string;
    aiAnalysisData?: {
      keyFindings?: string[];
      investigationGuidance?: string[];
      contributingFactors?: string[];
      recommendedRCAMethodology?: {
        primary: 'FIVE_WHYS' | 'FISHBONE';
        reason: string;
        confidence: number;
        alternativeMethod?: 'FIVE_WHYS' | 'FISHBONE';
        alternativeReason?: string;
      };
    };
  };
  analyst: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  comments: any[];
  evidence: any[];
  capActions: any[];
  versionHistory: any[];
}

/**
 * Extract the Foreign Material Description from FMIR-formatted description
 * In RCA Fishbone, the Problem Statement (Effect) should be the specific issue:
 * For FMIR reports, this is the "FOREIGN MATERIAL DESCRIPTION" section content.
 */
function extractProblemFromFMIR(description: string | undefined): string {
  if (!description) return '';
  
  // Check if this is an FMIR-formatted description
  const isFMIR = description.includes('─') || description.includes('FOREIGN MATERIAL INCIDENT REPORT');
  
  if (!isFMIR) {
    return description;
  }
  
  // Split by lines to properly parse the structure
  const lines = description.split('\n');
  
  let inFMDSection = false;
  let fmdContent: string[] = [];
  let skipNextSeparator = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip separator lines
    if (line.match(/^─+$/)) {
      if (inFMDSection && skipNextSeparator) {
        skipNextSeparator = false;
        continue;
      }
      continue;
    }
    
    // Check if this is the FOREIGN MATERIAL DESCRIPTION header
    if (line.toUpperCase().includes('FOREIGN MATERIAL DESCRIPTION')) {
      inFMDSection = true;
      skipNextSeparator = true; // Skip the separator line that follows the header
      continue;
    }
    
    // Check if we hit the next section (end of FMD content)
    if (inFMDSection) {
      const sectionHeaders = ['CAUSE IDENTIFICATION', 'CORRECTIVE ACTION', 'VERIFICATION', 'EVIDENCE', 'GENERAL INFORMATION', 'INVESTIGATION'];
      const isNextSection = sectionHeaders.some(h => line.toUpperCase().includes(h));
      if (isNextSection) {
        break; // Stop collecting content
      }
      
      // Collect the content
      if (line.length > 0) {
        fmdContent.push(line);
      }
    }
  }
  
  if (fmdContent.length > 0) {
    return fmdContent.join(' ').trim();
  }
  
  // Fallback: return original description if we can't find the FMD section
  return description;
}

interface AIRecommendation {
  recommendedMethod: string;
  reason: string;
  confidence: number;
  alternativeMethod?: string;
  alternativeReason?: string;
  factors: {
    complexity: string;
    recurrence: boolean;
    severity: string | null;
    hasMultipleCauses: boolean;
  };
  // Include AI insights from incident
  incidentAiInsights?: {
    keyFindings?: string[];
    investigationGuidance?: string[];
    contributingFactors?: string[];
    recommendedRCAMethodology?: {
      primary: 'FIVE_WHYS' | 'FISHBONE';
      reason: string;
      confidence: number;
    };
  };
}

type RCAWorkspaceTab = 'record' | 'analysis' | 'diagram' | 'actions' | 'controls';
type RCAMethod = 'FIVE_WHYS' | 'FISHBONE';
type RCAMethodSwitchState = {
  from: RCAMethod;
  to: RCAMethod;
  activeStep: number;
  progress: number;
};
type CAPAGenerationStep = 'idle' | 'validating' | 'generating' | 'complete' | 'error';

const formatRCAMethodLabel = (method: RCAMethod) => method === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone';
const methodSwitchSteps = ['Saving selection', 'Refreshing analysis', 'Opening workspace'];
const capaGenerationSteps = ['Validate RCA', 'Create CAPA records', 'Ready for CAPA Board'];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const countValidItems = (items: any[] | undefined, textKeys: string[]) => (
  Array.isArray(items)
    ? items.filter((item) => textKeys.some((key) => typeof item?.[key] === 'string' && item[key].trim())).length
    : 0
);

const countActionPlans = (actionPlans: any) => (
  countValidItems(actionPlans?.immediate, ['action']) +
  countValidItems(actionPlans?.shortTerm, ['action']) +
  countValidItems(actionPlans?.longTerm, ['action'])
);

const getCorrectiveActionCount = (analysis: RCAAnalysis | null) => (
  analysis?.method === 'FIVE_WHYS'
    ? countActionPlans(analysis.fiveWhysData?.actionPlans)
    : countActionPlans(analysis?.fishboneData?.actionPlans)
);

const getPreventiveControlCount = (analysis: RCAAnalysis | null) => {
  const controls = analysis?.method === 'FIVE_WHYS'
    ? analysis?.fiveWhysData?.preventiveControls
    : analysis?.fishboneData?.preventiveControls;

  return countValidItems(controls, ['control', 'description']);
};

const getCAPARootCauseStatement = (analysis: RCAAnalysis | null) => {
  const statement = analysis?.rootCauseStatement ||
    analysis?.fiveWhysData?.rootCause ||
    analysis?.fishboneData?.rootCauseText ||
    '';

  return typeof statement === 'string' ? statement.trim() : '';
};

export default function RCAWorkspacePageWrapper() {
  return (
    <ProtectedRoute>
      <RCAWorkspaceContent />
    </ProtectedRoute>
  );
}

function RCAWorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const rcaId = params.id as string;
  const { user } = useAuth();
  const { 
    connect, 
    onlineUsers, 
    onParticipantsUpdated, 
    onParticipantRoleUpdated, 
    isConnected, 
    joinIncident, 
    leaveIncident, 
    onRCADataUpdated,
    onRCAMethodChanged,
    onRCAValidated,
    onRCAReopened,
    onRCAAIGenerationStarted,
    onRCAAIGenerationComplete
  } = useWebSocket();

  // Privilege-based access control
  const { hasPrivilege } = usePrivileges();
  const canEditIncident = hasPrivilege(INCIDENTS_PRIVILEGES.EDIT);
  const canEditRCA = hasPrivilege(RCA_PRIVILEGES.EDIT);
  const canUseAI = hasPrivilege(RCA_PRIVILEGES.AI_FIVE_WHYS) || hasPrivilege(RCA_PRIVILEGES.AI_FISHBONE);
  const canCreateCAPA = hasPrivilege(CAPA_PRIVILEGES.CREATE);
  const { showAccessDenied, modal: accessDeniedModal } = useAccessDeniedModal();

  // Connect to WebSocket when user is available
  useEffect(() => {
    if (user?.id && user?.organizationId) {
      connect(user.id, user.organizationId);
    }
  }, [user?.id, user?.organizationId, connect]);

  const [rca, setRca] = useState<RCAAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'evidence' | 'timeline' | 'comments'>('evidence');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [methodSwitch, setMethodSwitch] = useState<RCAMethodSwitchState | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [manualSaveRequest, setManualSaveRequest] = useState(0);
  const [generatingCAPA, setGeneratingCAPA] = useState(false);
  const [capaGenerated, setCapaGenerated] = useState(false);
  const [capaGenerationModalOpen, setCapaGenerationModalOpen] = useState(false);
  const [capaGenerationStep, setCapaGenerationStep] = useState<CAPAGenerationStep>('idle');
  const [generatedCapaCount, setGeneratedCapaCount] = useState(0);
  const [capaGenerationMessage, setCapaGenerationMessage] = useState('');
  const [capaGenerationError, setCapaGenerationError] = useState('');
  const [workspaceTab, setWorkspaceTab] = useState<RCAWorkspaceTab>('record');
  const [incidentEditModalOpen, setIncidentEditModalOpen] = useState(false);
  const [methodologyModalOpen, setMethodologyModalOpen] = useState(false);
  const [selectedRcaMethod, setSelectedRcaMethod] = useState<RCAMethod | null>(null);
  const [analyzingMethodology, setAnalyzingMethodology] = useState(false);
  const [methodologyRecommendation, setMethodologyRecommendation] = useState<AIRecommendation | null>(null);
  const methodologyModalRef = useRef<HTMLDivElement | null>(null);
  const methodologyDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);
  const [methodologyModalPosition, setMethodologyModalPosition] = useState({ left: 0, top: 0 });
  const [isMethodologyModalReady, setIsMethodologyModalReady] = useState(false);
  const [isMethodologyModalDragging, setIsMethodologyModalDragging] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedPreference = window.localStorage.getItem('dashmet-rca-auto-save');
    if (storedPreference !== null) {
      setAutoSaveEnabled(storedPreference === 'true');
    }
  }, []);

  useEffect(() => {
    if (rca?.method !== 'FISHBONE' && workspaceTab === 'diagram') {
      setWorkspaceTab('analysis');
    }
  }, [rca?.method, workspaceTab]);

  useEffect(() => {
    if (rca?.status === 'NOT_STARTED' && workspaceTab !== 'record') {
      setWorkspaceTab('record');
    }
  }, [rca?.status, workspaceTab]);

  const formatLabel = (value?: string | null) => value ? value.replace(/_/g, ' ') : 'Not set';

  const getIncidentStatusBadgeClass = (status?: string | null) => {
    switch (status) {
      case 'SUBMITTED':
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getSeverityBadgeClass = (severity?: string | null) => {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200';
      case 'LOW':
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Check if current user is the incident owner
  const isOwner = Boolean(user?.id && rca?.incident?.createdBy?.id === user.id);
  
  // Check if current user is the RCA analyst
  const isAnalyst = Boolean(user?.id && rca?.analyst?.id === user.id);
  const canOpenIncidentEdit = Boolean(
    canEditIncident &&
    rca?.incident?.id &&
    (isOwner || user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN')
  );
  
  // Check if current user is an active participant
  const isActiveParticipant = Boolean(
    user?.id && rca?.incident?.participants?.some(p => 
      p.user.id === user.id && p.isActive !== false
    )
  );
  
  // Determine if user can access chat
  // - TEAM incidents: owner, analyst, or active participants, or same org
  // - PRIVATE incidents: only owner or analyst
  // - PUBLIC incidents: only owner, analyst, and active participants (not all org members)
  const canAccessChat = Boolean(
    user?.id && (
      isOwner ||
      isAnalyst ||
      isActiveParticipant ||
      // Only allow all org members for TEAM visibility
      (rca?.incident?.visibility === 'TEAM' && user.organizationId)
    )
  );

  // Legacy isParticipant check for other features (viewing, WebSocket join, etc.)
  const isParticipant = Boolean(
    user?.id && (
      rca?.incident?.participants?.some(p => p.user.id === user.id) || 
      rca?.analyst?.id === user.id ||
      rca?.incident?.createdBy?.id === user.id ||
      user.organizationId // Allow any user in same organization to view
    )
  );

  const fetchRCA = useCallback(async () => {
    try {
      const response = await api.get(`/rca/${rcaId}`);
      setRca(response.data.data);
      
      // Fetch AI recommendation
      try {
        const recResponse = await api.get(`/rca/${rcaId}/recommendation`);
        setRecommendation(recResponse.data.data);
      } catch (recError) {
        console.log('Could not fetch recommendation:', recError);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load RCA analysis');
    } finally {
      setLoading(false);
    }
  }, [rcaId]);

  useEffect(() => {
    fetchRCA();
  }, [fetchRCA]);

  // Join incident room for WebSocket events when RCA is loaded
  useEffect(() => {
    if (isConnected && rca?.incident?.id && isParticipant) {
      joinIncident(rca.incident.id);
      return () => {
        leaveIncident(rca.incident.id);
      };
    }
  }, [isConnected, rca?.incident?.id, isParticipant, joinIncident, leaveIncident]);

  // Listen for participant updates and refetch RCA
  useEffect(() => {
    if (!rca?.incident?.id) return;
    
    const unsubscribe = onParticipantsUpdated((data) => {
      if (data.incidentId === rca.incident.id) {
        // Refetch RCA to get updated participants list
        fetchRCA();
      }
    });
    return unsubscribe;
  }, [rca?.incident?.id, onParticipantsUpdated, fetchRCA]);

  // Listen for participant role updates (real-time)
  useEffect(() => {
    if (!rca?.incident?.id) return;
    
    const unsubscribe = onParticipantRoleUpdated((data) => {
      if (data.incidentId === rca.incident.id) {
        // Update the participant role in local state immediately
        setRca(prev => {
          if (!prev || !prev.incident?.participants) return prev;
          return {
            ...prev,
            incident: {
              ...prev.incident,
              participants: prev.incident.participants.map(p => 
                p.userId === data.userId
                  ? { ...p, role: data.role as Participant['role'], canEdit: data.canEdit, canChat: data.canChat }
                  : p
              )
            }
          };
        });
      }
    });
    return unsubscribe;
  }, [rca?.incident?.id, onParticipantRoleUpdated]);

  // Listen for RCA data updates from other team members (real-time sync)
  useEffect(() => {
    if (!rcaId) return;
    
    const unsubscribe = onRCADataUpdated((data) => {
      // Only update if this is for the current RCA and from another user
      if (data.rcaId === rcaId && data.updatedBy?.id !== user?.id) {
        console.log('🔄 RCA data updated by team member:', data.updatedBy?.firstName, data.updatedBy?.lastName);
        // Update the local state with the new data
        setRca(prev => {
          if (!prev) return prev;
          if (data.type === 'fishbone') {
            return {
              ...prev,
              fishboneData: data.data.fishboneData,
              status: data.data.status,
              rootCauseStatement: data.data.rootCauseStatement,
            };
          } else if (data.type === 'five-whys') {
            return {
              ...prev,
              fiveWhysData: data.data.fiveWhysData,
              status: data.data.status,
              rootCauseStatement: data.data.rootCauseStatement,
            };
          }
          return prev;
        });
      }
    });
    return unsubscribe;
  }, [rcaId, user?.id, onRCADataUpdated]);

  // Listen for RCA method changes from other team members (real-time sync)
  useEffect(() => {
    if (!rcaId) return;
    
    const unsubscribe = onRCAMethodChanged((data) => {
      if (data.rcaId === rcaId && data.updatedBy?.id !== user?.id) {
        console.log('🔄 RCA method changed by team member:', data.updatedBy?.firstName, data.updatedBy?.lastName, 'to', data.method);
        setRca(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            method: data.method as 'FIVE_WHYS' | 'FISHBONE',
          };
        });
      }
    });
    return unsubscribe;
  }, [rcaId, user?.id, onRCAMethodChanged]);

  // Listen for RCA validation from other team members (real-time sync)
  useEffect(() => {
    if (!rcaId) return;
    
    const unsubscribe = onRCAValidated((data) => {
      if (data.rcaId === rcaId && data.validatedBy?.id !== user?.id) {
        console.log('🔄 RCA validated by team member:', data.validatedBy?.firstName, data.validatedBy?.lastName);
        setRca(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            isValidated: data.isValidated,
            rootCauseStatement: data.rootCauseStatement,
            status: 'VALIDATED',
          };
        });
      }
    });
    return unsubscribe;
  }, [rcaId, user?.id, onRCAValidated]);

  // Listen for RCA reopen from other team members (real-time sync)
  useEffect(() => {
    if (!rcaId) return;
    
    const unsubscribe = onRCAReopened((data) => {
      if (data.rcaId === rcaId && data.reopenedBy?.id !== user?.id) {
        console.log('🔄 RCA reopened by team member:', data.reopenedBy?.firstName, data.reopenedBy?.lastName);
        setRca(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            isValidated: false,
            status: 'IN_PROGRESS',
          };
        });
      }
    });
    return unsubscribe;
  }, [rcaId, user?.id, onRCAReopened]);

  // Listen for AI generation events from other team members (real-time sync)
  useEffect(() => {
    if (!rcaId) return;
    
    const unsubStarted = onRCAAIGenerationStarted((data) => {
      if (data.rcaId === rcaId && data.startedBy?.id !== user?.id) {
        console.log('🤖 AI generation started by:', data.startedBy?.firstName, data.startedBy?.lastName);
        // Could show a toast/notification that AI is being generated
      }
    });

    const unsubComplete = onRCAAIGenerationComplete((data) => {
      if (data.rcaId === rcaId && data.generatedBy?.id !== user?.id) {
        console.log('🤖 AI generation completed by:', data.generatedBy?.firstName, data.generatedBy?.lastName);
        // If autoSaved, refetch the RCA to get the new data
        if (data.autoSaved) {
          fetchRCA();
        }
      }
    });

    return () => {
      unsubStarted();
      unsubComplete();
    };
  }, [rcaId, user?.id, onRCAAIGenerationStarted, onRCAAIGenerationComplete, fetchRCA]);

  const handleMethodChange = async (method: RCAMethod) => {
    if (rca?.method === method) {
      return;
    }

    const fromMethod = rca?.method || method;

    try {
      setError('');
      setSaving(true);
      setMethodSwitch({ from: fromMethod, to: method, activeStep: 0, progress: 8 });
      await wait(200);
      setMethodSwitch({ from: fromMethod, to: method, activeStep: 0, progress: 28 });
      await api.patch(`/rca/${rcaId}/method`, { method });
      setMethodSwitch({ from: fromMethod, to: method, activeStep: 1, progress: 52 });
      await wait(250);
      await fetchRCA();
      setMethodSwitch({ from: fromMethod, to: method, activeStep: 2, progress: 78 });
      await wait(300);
      setMethodSwitch({ from: fromMethod, to: method, activeStep: methodSwitchSteps.length, progress: 100 });
      await wait(550);
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Change Method');
    } finally {
      setSaving(false);
      setMethodSwitch(null);
    }
  };

  const normalizeMethod = (method?: string | null): RCAMethod => (
    method === 'FIVE_WHYS' ? 'FIVE_WHYS' : 'FISHBONE'
  );

  const getBestRecommendedMethod = (): RCAMethod => normalizeMethod(
    methodologyRecommendation?.recommendedMethod ||
    recommendation?.recommendedMethod ||
    rca?.incident?.aiAnalysisData?.recommendedRCAMethodology?.primary ||
    rca?.aiRecommendedMethod ||
    rca?.method
  );

  const getConfidencePercent = (confidence?: number | null) => {
    const value = confidence ?? 0;
    return Math.round(value <= 1 ? value * 100 : value);
  };

  const getDisplayedRecommendation = () => (
    methodologyRecommendation ||
    recommendation ||
    (rca?.incident?.aiAnalysisData?.recommendedRCAMethodology ? {
      recommendedMethod: rca.incident.aiAnalysisData.recommendedRCAMethodology.primary,
      reason: rca.incident.aiAnalysisData.recommendedRCAMethodology.reason || 'Based on the AI incident analysis.',
      confidence: rca.incident.aiAnalysisData.recommendedRCAMethodology.confidence,
      factors: {
        complexity: 'medium',
        recurrence: false,
        severity: rca.incident.severity,
        hasMultipleCauses: false,
      },
    } : null)
  );

  const handleOpenMethodologyModal = () => {
    if (!canEditRCA) {
      showAccessDenied();
      return;
    }

    setSelectedRcaMethod(null);
    setMethodologyRecommendation(null);
    setMethodologyModalOpen(true);
  };

  useEffect(() => {
    if (!methodologyModalOpen) return;

    const centerMethodologyModal = () => {
      const rect = methodologyModalRef.current?.getBoundingClientRect();
      const width = rect?.width || Math.min(512, window.innerWidth - 32);
      const height = rect?.height || Math.min(640, window.innerHeight - 32);

      setMethodologyModalPosition({
        left: Math.max(12, (window.innerWidth - width) / 2),
        top: Math.max(12, (window.innerHeight - height) / 2),
      });
      setIsMethodologyModalReady(true);
    };

    setIsMethodologyModalReady(false);
    requestAnimationFrame(centerMethodologyModal);
    window.addEventListener('resize', centerMethodologyModal);

    return () => {
      window.removeEventListener('resize', centerMethodologyModal);
      methodologyDragRef.current = null;
      setIsMethodologyModalDragging(false);
    };
  }, [methodologyModalOpen]);

  const clampMethodologyModalPosition = useCallback((left: number, top: number) => {
    const rect = methodologyModalRef.current?.getBoundingClientRect();
    const width = rect?.width || 0;
    const height = rect?.height || 0;
    const margin = 12;

    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin)),
      top: Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - height - margin)),
    };
  }, []);

  const handleMethodologyModalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMethodologyModalReady || event.button !== 0) return;
    if (analyzingMethodology) return;
    if ((event.target as HTMLElement).closest('button')) return;

    methodologyDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: methodologyModalPosition.left,
      originTop: methodologyModalPosition.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsMethodologyModalDragging(true);
  };

  const handleMethodologyModalPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = methodologyDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const nextLeft = dragState.originLeft + event.clientX - dragState.startX;
    const nextTop = dragState.originTop + event.clientY - dragState.startY;
    setMethodologyModalPosition(clampMethodologyModalPosition(nextLeft, nextTop));
  };

  const handleMethodologyModalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = methodologyDragRef.current;
    if (dragState?.pointerId === event.pointerId) {
      methodologyDragRef.current = null;
      setIsMethodologyModalDragging(false);
    }
  };

  const handleAnalyzeMethodology = async () => {
    if (!rca?.incident?.id) return;

    setAnalyzingMethodology(true);
    setError('');

    try {
      const response = await api.post(`/rca/incidents/${rca.incident.id}/analyze-methodology`);
      const nextRecommendation = response.data?.data?.recommendation;

      if (nextRecommendation) {
        setMethodologyRecommendation(nextRecommendation);
        setSelectedRcaMethod(normalizeMethod(nextRecommendation.recommendedMethod));
      }
    } catch (err: any) {
      handlePrivilegeError(err, showAccessDenied, setError, 'Analyze Methodology');
    } finally {
      setAnalyzingMethodology(false);
    }
  };

  const handleStartRCA = async () => {
    if (!canEditRCA) {
      showAccessDenied();
      return;
    }
    if (!selectedRcaMethod) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.patch(`/rca/${rcaId}/method`, {
        method: selectedRcaMethod,
        start: true,
      });
      await fetchRCA();
      setWorkspaceTab('analysis');
      setMethodologyModalOpen(false);
    } catch (err: any) {
      handlePrivilegeError(err, showAccessDenied, setError, 'Create RCA');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFiveWhys = async (data: any) => {
    if (!canEditRCA) {
      showAccessDenied();
      return;
    }
    try {
      setSaving(true);
      await api.patch(`/rca/${rcaId}/five-whys`, {
        fiveWhysData: data,
        changeReason: 'Updated 5 Whys analysis',
      });
      await fetchRCA();
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Save 5 Whys');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFishbone = async (data: any) => {
    if (!canEditRCA) {
      showAccessDenied();
      return;
    }
    try {
      setSaving(true);
      await api.patch(`/rca/${rcaId}/fishbone`, {
        fishboneData: data,
        changeReason: 'Updated Fishbone diagram',
      });
      await fetchRCA();
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Save Fishbone');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenFishboneWhiteboard = async (data: any) => {
    if (!canEditRCA) {
      showAccessDenied();
      return;
    }

    const response = await api.post(`/rca/${rcaId}/fishbone/whiteboard`, {
      fishboneData: data,
    });
    const boardId = response.data?.data?.board?.id;
    if (!boardId) {
      throw new Error('Fishbone whiteboard was not returned by the server');
    }

    const returnTo = `/rca/${rcaId}#rca-analysis-builder`;
    const params = new URLSearchParams({
      returnTo,
      returnLabel: 'Back to RCA Fishbone',
    });
    const whiteboardPath = `/whiteboard/${boardId}?${params.toString()}`;
    if (typeof window !== 'undefined') {
      window.location.assign(whiteboardPath);
      return;
    }

    router.push(whiteboardPath);
  };

  const handleAutoSaveToggle = (enabled: boolean) => {
    setAutoSaveEnabled(enabled);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('dashmet-rca-auto-save', String(enabled));
    }
  };

  const handleManualSaveRequest = () => {
    if (!canEditRCA) {
      showAccessDenied();
      return;
    }
    if (workspaceTab === 'record') {
      return;
    }
    setManualSaveRequest((current) => current + 1);
  };

  const handleValidate = async (rootCauseStatement: string) => {
    if (!canEditRCA) {
      showAccessDenied();
      return;
    }
    try {
      setSaving(true);
      await api.post(`/rca/${rcaId}/validate`, { rootCauseStatement });
      await fetchRCA();
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Validate RCA');
    } finally {
      setSaving(false);
    }
  };

  const handleReopenRCA = async () => {
    if (!canEditRCA) {
      showAccessDenied();
      return;
    }
    try {
      setSaving(true);
      await api.post(`/rca/${rcaId}/reopen`, { reason: 'Re-opened for corrections' });
      await fetchRCA();
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Reopen RCA');
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async (content: string) => {
    try {
      await api.post(`/rca/${rcaId}/comments`, { content });
      await fetchRCA();
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Add Comment');
    }
  };

  const handleGenerateCAPA = async () => {
    if (!canCreateCAPA) {
      showAccessDenied('Generate CAPA Board', CAPA_PRIVILEGES.CREATE);
      return;
    }
    if (!rca) return;

    if (getCorrectiveActionCount(rca) === 0 || getPreventiveControlCount(rca) === 0) {
      setError('Add at least one corrective action and one preventive control before generating the CAPA Board.');
      return;
    }

    if (rca.capActions?.length > 0) {
      setGeneratedCapaCount(rca.capActions.length);
      setCapaGenerationMessage('This RCA already has CAPA Board actions. Open the CAPA Board to review and manage them.');
      setCapaGenerationError('');
      setCapaGenerationStep('complete');
      setCapaGenerationModalOpen(true);
      return;
    }

    try {
      setGeneratingCAPA(true);
      setError('');
      setCapaGenerationError('');
      setGeneratedCapaCount(0);
      setCapaGenerationMessage('');
      setCapaGenerationModalOpen(true);

      if (!rca.isValidated) {
        const rootCauseStatement = getCAPARootCauseStatement(rca);

        if (!rootCauseStatement) {
          throw new Error('Add a root cause statement before generating the CAPA Board.');
        }

        setCapaGenerationStep('validating');
        await wait(250);
        await api.post(`/rca/${rcaId}/validate`, { rootCauseStatement });
      }

      setCapaGenerationStep('generating');
      await wait(300);
      const response = await api.post(`/capa/generate-from-rca/${rcaId}`);
      const createdCount = response.data?.data?.created ?? response.data?.data?.actions?.length ?? 0;

      setCapaGenerated(true);
      setGeneratedCapaCount(createdCount);
      setCapaGenerationMessage(
        response.data?.data?.message ||
        `Successfully created ${createdCount} CAPA action${createdCount === 1 ? '' : 's'} from this RCA.`
      );
      await fetchRCA();
      setCapaGenerationStep('complete');
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to generate the CAPA Board';
      setCapaGenerationStep('error');
      setCapaGenerationError(errorMessage);
      const handledPrivilegeError = handlePrivilegeError(err, showAccessDenied, undefined, 'Generate CAPA Board');
      if (!handledPrivilegeError) {
        setError(errorMessage);
      }
    } finally {
      setGeneratingCAPA(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading RCA analysis..." icon="search" color="blue" />;
  }

  if (!rca) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">RCA Not Found</h2>
        </div>
      </div>
    );
  }

  // Safety check: ensure incident data exists
  if (!rca.incident) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Incident Data Not Available</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">The incident associated with this RCA could not be loaded.</p>
        </div>
      </div>
    );
  }

  const rcaWorkspaceStatus = rca.isValidated
    ? 'Validated'
    : rca.status === 'NOT_STARTED'
      ? 'RCA NOT STARTED'
      : (rca.status || 'In Progress').replace(/_/g, ' ');
  const isRcaNotStarted = rca.status === 'NOT_STARTED';
  const normalizedFishboneData = (() => {
    if (rca.fishboneData) {
      const currentProblem = rca.fishboneData.problem || '';
      if (currentProblem.includes('FOREIGN MATERIAL INCIDENT REPORT') || currentProblem.includes('─')) {
        return {
          ...rca.fishboneData,
          problem: extractProblemFromFMIR(currentProblem)
        };
      }
      return rca.fishboneData;
    }

    return {
      problem: extractProblemFromFMIR(rca.incident?.description) || '',
      categories: []
    };
  })();
  const causeCount = normalizedFishboneData.categories?.reduce(
    (total: number, category: any) => total + (category.causes?.length || 0),
    0
  ) || 0;
  const correctiveActionCount = getCorrectiveActionCount(rca);
  const preventiveControlCount = getPreventiveControlCount(rca);
  const existingCapaActionCount = rca.capActions?.length || 0;
  const hasCapaSourceItems = correctiveActionCount > 0 && preventiveControlCount > 0;
  const hasGeneratedCapaBoard = capaGenerated || existingCapaActionCount > 0;
  const showCapaBoardAction = hasCapaSourceItems || hasGeneratedCapaBoard;
  const capaGenerationProgress = capaGenerationStep === 'complete'
    ? 100
    : capaGenerationStep === 'generating'
      ? 72
      : capaGenerationStep === 'validating'
        ? 34
        : capaGenerationStep === 'error'
          ? 100
          : 8;
  const capaGenerationStepIndex = capaGenerationStep === 'complete'
    ? capaGenerationSteps.length - 1
    : capaGenerationStep === 'generating'
      ? 1
      : 0;
  const isCapaGenerationBusy = capaGenerationStep === 'validating' || capaGenerationStep === 'generating';
  const fiveWhysCompletedCount = rca.fiveWhysData?.steps?.filter((step: any) => step.answer?.trim()).length || 0;
  const fiveWhysStepCount = rca.fiveWhysData?.steps?.length || 0;
  const workspaceTitleByTab = {
    record: 'Incident Record',
    analysis: 'Cause Analysis',
    diagram: 'Fishbone Diagram',
    actions: 'Corrective Actions',
    controls: 'Preventive Controls'
  } as const;
  const workspaceTabs = [
    {
      id: 'record' as const,
      label: 'Incident Record',
      statusLabel: formatLabel(rca.incident.status),
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 6.414V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'analysis' as const,
      label: 'Cause Analysis',
      count: rca.method === 'FIVE_WHYS' ? fiveWhysCompletedCount : causeCount,
      countLabel: rca.method === 'FIVE_WHYS' && fiveWhysStepCount > 0
        ? `${fiveWhysCompletedCount}/${fiveWhysStepCount}`
        : undefined,
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      id: 'diagram' as const,
      label: 'Fishbone Diagram',
      icon: <span className="text-base sm:text-lg">🐟</span>
    },
    {
      id: 'actions' as const,
      label: 'Corrective Actions',
      count: correctiveActionCount,
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'controls' as const,
      label: 'Preventive Controls',
      count: preventiveControlCount,
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    }
  ];
  const visibleWorkspaceTabs = isRcaNotStarted
    ? workspaceTabs.filter((tab) => tab.id === 'record')
    : rca.method === 'FISHBONE'
      ? workspaceTabs
      : workspaceTabs.filter((tab) => tab.id !== 'diagram');
  const activeBuilderTab = workspaceTab === 'record' ? 'analysis' : workspaceTab;
  const fiveWhysActiveTab = activeBuilderTab === 'diagram' ? 'analysis' : activeBuilderTab;
  const saveControlsVisible = !isRcaNotStarted && !rca.isValidated && canEditRCA;
  const manualSaveAvailable = workspaceTab !== 'record';
  const displayedRecommendation = methodologyRecommendation;
  const recommendedMethod = displayedRecommendation
    ? normalizeMethod(displayedRecommendation.recommendedMethod)
    : null;
  const incidentVisibility = rca.incident.visibility;
  const incidentListReturnTarget = incidentVisibility === 'PUBLIC'
    ? { href: '/incidents?filter=public', label: 'Back to Public Incidents' }
    : incidentVisibility === 'TEAM' || rca.incident.isTeamIncident
      ? { href: '/incidents?filter=team', label: 'Back to Team Incidents' }
      : { href: '/incidents?filter=my', label: 'Back to My Incidents' };

  return (
    <div className="relative min-h-full">
      {methodSwitch && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rca-method-switch-title"
          aria-describedby="rca-method-switch-description"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-6 text-center shadow-2xl shadow-slate-900/25 dark:border-slate-700/80 dark:bg-slate-900/95">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400" />
            <div className="absolute -left-16 -top-16 h-36 w-36 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute -bottom-20 -right-14 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />

            <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-cyan-50 shadow-inner dark:from-blue-950/50 dark:to-slate-800">
              <span className="absolute h-24 w-24 animate-ping rounded-full border border-blue-400/25" />
              <span className="absolute h-20 w-20 animate-spin rounded-full border-4 border-transparent border-r-cyan-400 border-t-blue-600" />
              <span className="absolute h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-500/30" />
              <svg className="relative h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>

            <h2 id="rca-method-switch-title" className="relative text-lg font-semibold text-slate-950 dark:text-white">
              Switching Methodology
            </h2>
            <p id="rca-method-switch-description" className="relative mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300" aria-live="polite">
              DashMet is preparing your {formatRCAMethodLabel(methodSwitch.to)} workspace and syncing the updated RCA structure.
            </p>

            <div className="relative mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-800/70">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">From</span>
                <span className="mt-1 block text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {formatRCAMethodLabel(methodSwitch.from)}
                </span>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left dark:border-blue-700/80 dark:bg-blue-950/40">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-blue-500">To</span>
                <span className="mt-1 block text-sm font-semibold text-blue-800 dark:text-blue-100">
                  {formatRCAMethodLabel(methodSwitch.to)}
                </span>
              </div>
            </div>

            <div className="relative mt-6 space-y-3 text-left">
              {methodSwitchSteps.map((step, index) => {
                const isComplete = methodSwitch.activeStep > index;
                const isActive = methodSwitch.activeStep === index;

                return (
                  <div
                    key={step}
                    className={`flex items-center gap-3 text-sm transition-colors duration-300 ${
                      isComplete
                        ? 'text-slate-800 dark:text-slate-100'
                        : isActive
                          ? 'text-blue-700 dark:text-blue-200'
                          : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ${
                      isComplete
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200'
                        : isActive
                          ? 'bg-blue-100 text-blue-700 ring-4 ring-blue-100 dark:bg-blue-900/40 dark:text-blue-200 dark:ring-blue-950'
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    }`}>
                      {isComplete ? (
                        <svg className="h-3.5 w-3.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isActive ? (
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-current" />
                      )}
                    </span>
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>

            <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-400 transition-all duration-500 ease-out"
                style={{ width: `${methodSwitch.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {capaGenerationModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="capa-generation-title"
          aria-describedby="capa-generation-description"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                    capaGenerationStep === 'complete'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200'
                      : capaGenerationStep === 'error'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                  }`}>
                    {capaGenerationStep === 'complete' ? (
                      <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                    ) : capaGenerationStep === 'error' ? (
                      <AlertCircle className="h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <h2 id="capa-generation-title" className="text-base font-semibold text-slate-950 dark:text-white">
                      {capaGenerationStep === 'complete'
                        ? 'CAPA Board generated'
                        : capaGenerationStep === 'error'
                          ? 'CAPA Board generation stopped'
                          : 'Generating CAPA Board'}
                    </h2>
                    <p id="capa-generation-description" className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {capaGenerationStep === 'complete'
                        ? 'Your RCA actions are now available in the CAPA Board section.'
                        : capaGenerationStep === 'error'
                          ? capaGenerationError
                          : 'DashMet is converting the RCA corrective actions and preventive controls into CAPA Board records.'}
                    </p>
                  </div>
                </div>
                {!isCapaGenerationBusy && (
                  <button
                    type="button"
                    onClick={() => setCapaGenerationModalOpen(false)}
                    className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>

            <div className="px-5 py-5">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    capaGenerationStep === 'error' ? 'bg-red-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${capaGenerationProgress}%` }}
                />
              </div>

              <div className="mt-5 space-y-3">
                {capaGenerationSteps.map((step, index) => {
                  const isComplete = capaGenerationStep === 'complete' || capaGenerationStepIndex > index;
                  const isActive = isCapaGenerationBusy && capaGenerationStepIndex === index;

                  return (
                    <div
                      key={step}
                      className={`flex items-center gap-3 text-sm ${
                        isComplete
                          ? 'text-slate-900 dark:text-slate-100'
                          : isActive
                            ? 'text-blue-700 dark:text-blue-200'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${
                        isComplete
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200'
                          : isActive
                            ? 'bg-blue-100 text-blue-700 ring-4 ring-blue-100 dark:bg-blue-900/40 dark:text-blue-200 dark:ring-blue-950'
                            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                      }`}>
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        ) : isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-current" />
                        )}
                      </span>
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>

              {capaGenerationStep === 'complete' && (
                <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    {capaGenerationMessage || `Created ${generatedCapaCount} CAPA action${generatedCapaCount === 1 ? '' : 's'}.`}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-green-800 dark:text-green-200">
                    To get there later, open the CAPA section from the sidebar and choose CAPA Board. You can review owners, due dates, status, and effectiveness tracking from that board.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              {capaGenerationStep === 'error' && (
                <button
                  type="button"
                  onClick={() => setCapaGenerationModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  Stay here
                </button>
              )}
              {capaGenerationStep === 'complete' ? (
                <button
                  type="button"
                  onClick={() => router.push('/capa')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  View CAPA Board
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateCAPA}
                  disabled={isCapaGenerationBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {capaGenerationStep === 'error' ? 'Try Again' : 'Working...'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {methodologyModalOpen && (
        <div
          className="fixed inset-0 z-[100] overflow-hidden bg-transparent pointer-events-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rca-methodology-title"
        >
          <div
            ref={methodologyModalRef}
            style={isMethodologyModalReady ? {
              left: methodologyModalPosition.left,
              top: methodologyModalPosition.top,
              width: 'min(32rem, calc(100vw - 1.5rem))',
              maxHeight: 'calc(100dvh - 1.5rem)',
            } : {
              left: '50%',
              top: '50%',
              width: 'min(32rem, calc(100vw - 1.5rem))',
              maxHeight: 'calc(100dvh - 1.5rem)',
              transform: 'translate(-50%, -50%)',
            }}
            className={`pointer-events-auto fixed flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900 ${
              isMethodologyModalDragging ? 'select-none' : ''
            }`}
            aria-busy={analyzingMethodology}
          >
            <div
              className={`flex shrink-0 items-start justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700 ${
                analyzingMethodology
                  ? 'cursor-wait'
                  : isMethodologyModalDragging
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
              }`}
              onPointerDown={handleMethodologyModalPointerDown}
              onPointerMove={handleMethodologyModalPointerMove}
              onPointerUp={handleMethodologyModalPointerUp}
              onPointerCancel={handleMethodologyModalPointerUp}
              style={{ touchAction: 'none' }}
            >
              <div>
                <h2 id="rca-methodology-title" className="text-base font-semibold text-slate-950 dark:text-white">
                  Create Root Cause Analysis
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Analyze the incident or choose a method manually before RCA work begins.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMethodologyModalOpen(false)}
                disabled={analyzingMethodology}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Close methodology selection"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <button
                type="button"
                onClick={handleAnalyzeMethodology}
                disabled={analyzingMethodology}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-left transition-colors hover:bg-blue-100 disabled:cursor-wait disabled:opacity-70 dark:border-blue-800 dark:bg-blue-950/40 dark:hover:bg-blue-950/60"
              >
                <div className="flex items-center gap-3">
                  {analyzingMethodology && (
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-200">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
                        />
                      </svg>
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      {analyzingMethodology ? 'Analyzing incident context...' : 'Analyze with AI'}
                    </p>
                    <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                      Review the incident details and suggest a method.
                    </p>
                  </div>
                </div>
              </button>

              {displayedRecommendation && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                        Recommended: {recommendedMethod ? formatRCAMethodLabel(recommendedMethod) : 'Review complete'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-200">
                        {displayedRecommendation.reason}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-200">
                      {getConfidencePercent(displayedRecommendation.confidence)}%
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {displayedRecommendation.factors?.complexity || 'medium'} complexity
                    </span>
                    {displayedRecommendation.factors?.recurrence && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        Recurring issue
                      </span>
                    )}
                    {displayedRecommendation.factors?.hasMultipleCauses && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        Multiple causes
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Choose methodology
                  <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
                    manually
                  </span>
                </p>
                {(['FISHBONE', 'FIVE_WHYS'] as RCAMethod[]).map((method) => {
                  const isSelected = selectedRcaMethod === method;
                  const isRecommended = recommendedMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSelectedRcaMethod(method)}
                      disabled={analyzingMethodology}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40'
                          : analyzingMethodology
                            ? 'border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-900'
                          : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/30'
                      } disabled:cursor-wait`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {method === 'FISHBONE' ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M7 8l-3 4 3 4m10-8 3 4-3 4M9 12l2-3m-2 3 2 3m4-6-2 3m2 3-2-3" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093M12 17h.01" />
                            </svg>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {formatRCAMethodLabel(method)}
                            </span>
                            {isRecommended && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-200">
                                Recommended
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                            {method === 'FISHBONE'
                              ? 'Explore multiple cause categories visually.'
                              : 'Use iterative questions for a direct cause chain.'}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMethodologyModalOpen(false)}
                disabled={analyzingMethodology}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartRCA}
                disabled={saving || analyzingMethodology || !selectedRcaMethod}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? 'Creating...' : 'Create RCA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button
                type="button"
                onClick={() => router.push(incidentListReturnTarget.href)}
                aria-label={incidentListReturnTarget.label}
                title={incidentListReturnTarget.label}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/30 dark:hover:text-blue-200 sm:h-10 sm:w-10"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {workspaceTitleByTab[workspaceTab]} - {rca.incident?.incidentNumber || 'Unknown'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  {rca.incident?.category?.name || 'Unknown'} | {rca.incident?.facility?.name || 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {showCapaBoardAction && (
                hasGeneratedCapaBoard ? (
                  <button
                    type="button"
                    onClick={() => router.push('/capa')}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 shadow-sm transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200 dark:hover:bg-green-900/50 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                    title="Open the CAPA Board"
                  >
                    <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">View CAPA Board</span>
                    <span className="sm:hidden">CAPA Board</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateCAPA}
                    disabled={generatingCAPA}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70 dark:border-blue-700 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                    title={canCreateCAPA ? 'Generate CAPA Board from this RCA' : 'Requires CAPA create access'}
                  >
                    {generatingCAPA ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" aria-hidden="true" />
                    ) : (
                      <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">
                      {generatingCAPA ? 'Generating CAPA Board' : 'Generate CAPA Board'}
                    </span>
                    <span className="sm:hidden">CAPA</span>
                  </button>
                )
              )}
              {canOpenIncidentEdit && (
                <button
                  type="button"
                  onClick={() => setIncidentEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 shadow-sm transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                  title="Edit incident details"
                >
                  <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Edit Incident Details</span>
                  <span className="sm:hidden">Edit</span>
                </button>
              )}
              {saveControlsVisible && (
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 sm:px-3 sm:py-1.5">
                  <span>Auto save</span>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Automatic save"
                    aria-checked={autoSaveEnabled}
                    onClick={() => handleAutoSaveToggle(!autoSaveEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                      autoSaveEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        autoSaveEnabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              )}
              {saveControlsVisible && !autoSaveEnabled && (
                <button
                  type="button"
                  onClick={handleManualSaveRequest}
                  disabled={saving || !manualSaveAvailable}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
                  title={manualSaveAvailable ? 'Save the current RCA progress' : 'Open a cause analysis tab to save progress'}
                >
                  {saving ? 'Saving...' : 'Save Progress'}
                </button>
              )}
              <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${
                rca.isValidated
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              }`}>
                {rcaWorkspaceStatus}
              </span>
              {saving && (
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Saving...
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
            <nav className="flex min-w-max space-x-1" aria-label="Incident workspace tabs">
              {visibleWorkspaceTabs.map((tab) => {
                const isActive = workspaceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWorkspaceTab(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center space-x-1 whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-medium transition-colors sm:space-x-2 sm:px-6 sm:py-3 sm:text-sm ${
                      isActive
                        ? 'bg-white text-blue-600 border-t-2 border-x border-blue-500 -mb-px dark:bg-gray-800 dark:text-blue-400'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {'statusLabel' in tab && tab.statusLabel && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getIncidentStatusBadgeClass(rca.incident.status)}`}>
                        {tab.statusLabel}
                      </span>
                    )}
                    {typeof tab.count === 'number' && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                        {'countLabel' in tab && tab.countLabel ? tab.countLabel : tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-6">
            {error}
            <button onClick={() => setError('')} className="ml-4 text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        {/* Full Width Main Panel */}
        <div className="space-y-4 sm:space-y-6">
          {workspaceTab === 'record' ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
              <div className="space-y-4 lg:col-span-2">
                <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 sm:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
                        Incident Details
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                        {rca.incident.description}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center self-start whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase leading-none sm:text-[11px] ${getIncidentStatusBadgeClass(rca.incident.status)}`}>
                      {formatLabel(rca.incident.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4 dark:border-gray-700 sm:grid-cols-3 xl:grid-cols-5">
                    <div>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">Type</span>
                      <p className="mt-1 text-sm font-medium uppercase text-gray-900 dark:text-white">
                        {formatLabel(rca.incident.type)}
                      </p>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">Severity</span>
                      <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getSeverityBadgeClass(rca.incident.severity)}`}>
                        {formatLabel(rca.incident.severity)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">Category</span>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                        {rca.incident.category?.name || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">Reported By</span>
                      <p className="mt-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                        {rca.incident.createdBy?.firstName} {rca.incident.createdBy?.lastName}
                      </p>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">Reported</span>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                        {rca.incident.reportedAt ? formatDateTime(rca.incident.reportedAt) : 'Not set'}
                      </p>
                    </div>
                  </div>

                  {rca.incident.aiSummary && (
                    <div className="mt-5 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/30">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Insights from Incident Analysis
                      </div>
                      <p className="text-sm leading-6 text-blue-800 dark:text-blue-200">
                        {rca.incident.aiSummary}
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 sm:p-6">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
                    Operational Details
                  </h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      ['Facility', rca.incident.facility?.name],
                      ['Department', rca.incident.department?.name],
                      ['Area', rca.incident.area?.name],
                      ['Line', rca.incident.line?.name],
                      ['Shift', rca.incident.shift?.name],
                      ['Occurred At', rca.incident.occurredAt ? formatDateTime(rca.incident.occurredAt) : undefined],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{label}</span>
                        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                          {value || 'Not set'}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="space-y-4">
                <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 sm:p-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Visibility</h3>
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatLabel(rca.incident.visibility)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      This incident record is shown here without leaving the RCA workspace.
                    </p>
                  </div>
                </section>

                <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 sm:p-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">People</h3>
                  <div className="mt-4">
                    <span className="block text-xs text-gray-500 dark:text-gray-400">Reported By</span>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      {rca.incident.createdBy?.firstName} {rca.incident.createdBy?.lastName}
                    </p>
                  </div>
                  {rca.analyst && (
                    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                      <span className="block text-xs text-gray-500 dark:text-gray-400">RCA Analyst</span>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                        {rca.analyst.firstName} {rca.analyst.lastName}
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 sm:p-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Root Cause Analysis</h3>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {rca.method === 'FISHBONE' ? 'Fishbone' : '5 Whys'}
                    </span>
                    {isRcaNotStarted ? (
                      <button
                        type="button"
                        onClick={handleOpenMethodologyModal}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                      >
                        Create RCA
                      </button>
                    ) : (
                      <span className={`rounded px-2 py-1 text-xs font-medium ${
                        rca.isValidated
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                      }`}>
                        {rcaWorkspaceStatus}
                      </span>
                    )}
                  </div>
                </section>
              </aside>
            </div>
          ) : (
            <>
            {/* Analysis Builder */}
            <div id="rca-analysis-builder" className="bg-white dark:bg-gray-800 rounded-lg shadow scroll-mt-24">
              {rca.method === 'FIVE_WHYS' ? (
                <FiveWhysBuilder
                  rcaId={rca.id}
                  data={rca.fiveWhysData || { steps: [] }}
                  isValidated={rca.isValidated}
                  activeTab={fiveWhysActiveTab}
                  onTabChange={setWorkspaceTab}
                  hideInternalTabs
                  sectionTitle={fiveWhysActiveTab === 'analysis' ? '5 Whys Analysis' : workspaceTitleByTab[fiveWhysActiveTab]}
                  currentMethod={rca.method}
                  savingMethod={saving}
                  autoSaveEnabled={autoSaveEnabled}
                  saveRequestToken={manualSaveRequest}
                  showLocalSaveControls={false}
                  onChangeMethod={handleMethodChange}
                  onSave={handleSaveFiveWhys}
                  onValidate={handleValidate}
                />
              ) : (
                <FishboneBuilder
                  rcaId={rca.id}
                  incidentId={rca.incident?.id || rca.incidentId}
                  currentUserId={user?.id}
                  data={normalizedFishboneData}
                  isValidated={rca.isValidated}
                  activeTab={workspaceTab}
                  onTabChange={setWorkspaceTab}
                  hideInternalTabs
                  sectionTitle={workspaceTitleByTab[workspaceTab]}
                  onSave={handleSaveFishbone}
                  onOpenWhiteboard={handleOpenFishboneWhiteboard}
                  currentMethod={rca.method}
                  savingMethod={saving}
                  autoSaveEnabled={autoSaveEnabled}
                  saveRequestToken={manualSaveRequest}
                  showLocalSaveControls={false}
                  onChangeMethod={handleMethodChange}
                  onValidate={handleValidate}
                  onReopen={isAnalyst ? handleReopenRCA : undefined}
                />
              )}
            </div>

            </>
          )}
          </div>
        </div>

      {/* Sliding Sidebar - Right Side */}
      {/* Sidebar Toggle Tab (visible when sidebar is closed) */}
      <div
        className={`fixed top-1/3 right-0 z-40 transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="group flex items-center bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-2 py-4 rounded-l-lg shadow-lg transition-all duration-200 hover:px-3"
          title="Open Evidence, Timeline & Comments"
        >
          <div className="flex flex-col items-center space-y-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs font-medium writing-vertical-lr rotate-180" style={{ writingMode: 'vertical-lr' }}>
              Details
            </span>
          </div>
        </button>
      </div>

      {/* Sidebar Overlay (click to close) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sliding Sidebar Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 md:w-[420px] bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <h3 className="font-semibold flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Investigation Details</span>
          </h3>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Collapse sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Sidebar Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {(['evidence', 'timeline', 'comments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                sidebarTab === tab
                  ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center justify-center space-x-1.5">
                {tab === 'evidence' && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
                {tab === 'timeline' && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {tab === 'comments' && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                )}
                <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              </span>
              {sidebarTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          ))}
        </div>

        {/* Sidebar Content */}
        <div className="h-[calc(100%-108px)] overflow-y-auto p-4">
          {sidebarTab === 'evidence' && (
            <EvidencePanel
              incidentEvidence={rca.incident?.evidence || []}
              rcaEvidence={rca.evidence}
            />
          )}
          {sidebarTab === 'timeline' && rca.incident?.id && (
            <TimelinePanel incidentId={rca.incident.id} />
          )}
          {sidebarTab === 'comments' && (
            <CommentPanel
              comments={rca.comments}
              onAddComment={handleAddComment}
            />
          )}
        </div>

        {/* Collapse Button at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>Collapse Sidebar</span>
          </button>
        </div>
      </div>

      {/* Team Collaboration Chat Panel - Show only for owner, analyst, or active participants */}
      {rca && rca.incident && user && canAccessChat && (
        <ChatSidebar
          incidentId={rca.incident?.id || ''}
          incidentTitle={`RCA: ${rca.incident?.category?.name || rca.incident?.incidentNumber || 'Unknown'}`}
          currentUserId={user.id}
          organizationId={user.organizationId}
          isParticipant={canAccessChat}
          participants={(rca.incident?.participants || []).map(p => ({
            ...p,
            user: {
              ...p.user,
              isOnline: onlineUsers?.has(p.user.id) || false,
            }
          }))}
          onParticipantsChange={(newParticipants) => {
            setRca(prev => prev ? {
              ...prev,
              incident: {
                ...prev.incident,
                participants: newParticipants as Participant[]
              }
            } : null);
          }}
          isTeamIncident={rca.incident?.isTeamIncident || false}
          onVisibilityChange={(newVisibility) => {
            setRca(prev => prev ? {
              ...prev,
              incident: {
                ...prev.incident,
                visibility: newVisibility,
                isTeamIncident: newVisibility === 'TEAM',
              }
            } : null);
          }}
          visibility={rca.incident.visibility}
          versionHistory={rca.versionHistory || []}
        />
      )}

      {incidentEditModalOpen && rca.incident?.id && (
        <div className="absolute inset-0 z-[60] pointer-events-none">
          <Suspense fallback={
            <div className="absolute inset-0 flex items-center justify-center bg-transparent p-3">
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200">
                Loading incident details...
              </div>
            </div>
          }>
            <IncidentFormModal
              embedded
              editIncidentId={rca.incident.id}
              onClose={() => {
                setIncidentEditModalOpen(false);
                fetchRCA();
              }}
            />
          </Suspense>
        </div>
      )}

      {/* Access Denied Modal */}
      {accessDeniedModal}
    </div>
  );
}
