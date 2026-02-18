'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import { formatDateTime, formatDate } from '@/lib/dateUtils';
import { useAuth } from '@/components/providers/AuthProvider';
import { ChatSidebar } from '@/components/team';
import { useWebSocket } from '@/lib/websocket';
import AIAnalysisModal from '@/components/AIAnalysisModal';
import { usePrivileges, INCIDENTS_PRIVILEGES, RCA_PRIVILEGES } from '@/lib/usePrivileges';
import AccessDeniedModal, { useAccessDeniedModal, handlePrivilegeError } from '@/components/modals/AccessDeniedModal';

interface Participant {
  id: string;
  userId: string;
  role: 'OWNER' | 'LEAD' | 'MEMBER' | 'OBSERVER';
  canEdit: boolean;
  canChat: boolean;
  isActive?: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
    isOnline?: boolean;
    profilePicture?: string | null;
  };
  User_IncidentParticipant_userIdToUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
    isOnline?: boolean;
    profilePicture?: string | null;
  };
}

interface Incident {
  id: string;
  incidentNumber: string;
  type: string;
  status: string;
  severity: string | null;
  description: string;
  aiSummary: string | null;
  customTitle: string | null;
  productName: string | null;
  lotNumber: string | null;
  machineId: string | null;
  occurredAt: string;
  reportedAt: string;
  dueDate: string | null;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  isTeamIncident?: boolean;
  investigationSubmittedAt: string | null;
  // AI Analysis data for RCA recommendations
  aiAnalysisData?: {
    evidenceSummary?: string;
    keyFindings?: string[];
    investigationGuidance?: string[];
    recommendedRCAMethodology?: {
      primary: string;
      reason: string;
      confidence: number;
      alternativeMethod?: string;
      alternativeReason?: string;
    };
    attachmentAnalysis?: any[];
    generatedAt?: string;
  } | null;
  Category: { id: string; name: string };
  Facility: { id: string; name: string };
  Department?: { id: string; name: string };
  Area?: { id: string; name: string };
  Line?: { id: string; name: string };
  Shift?: { id: string; name: string };
  User_Incident_createdByIdToUser: { id: string; firstName: string; lastName: string; email: string };
  User_Incident_assignedToIdToUser?: { id: string; firstName: string; lastName: string; email: string };
  Evidence: any[];
  RCAAnalysis?: any[];
  Comment: any[];
  IncidentParticipant?: Participant[];
  
  // ============ WORKPLACE SAFETY - INCIDENT REPORT FIELDS ============
  // Basic Incident Info
  incidentDate?: string;
  incidentTime?: string;
  dateOfInjury?: string;
  timeOfInjury?: string;
  
  // Employee Information
  employeeName?: string;
  employeeIdNumber?: string;
  employeeEmail?: string;
  employeePhone?: string;
  employeeHomeAddress?: string;
  employeeGender?: string;
  employeeLanguage?: string;
  employeeLastSSN4?: string;
  needsInterpreter?: boolean;
  interpreterAssisting?: boolean;
  ownedJobTitle?: string;
  jobAssignmentAtInjury?: string;
  positionAtTimeOfIncident?: string;
  departmentWhereInjury?: string;
  
  // Employment Status
  wasClockedIn?: boolean;
  wasPerformingOtherDuties?: boolean;
  otherDutiesExplanation?: string;
  employedElsewhere?: boolean;
  workedForOtherLast6Months?: boolean;
  otherEmployerNames?: string;
  additionalEmployers?: string;
  additionalEmployerHours?: string;
  additionalEmployerStartDate?: string;
  
  // Injury Details
  injuryType?: string;
  injuryTypeDescription?: string;
  bodyPartsAffected?: string[];
  bodyPartsAffectedNA?: boolean;
  otherBodyPartDetail?: string;
  allBodyPartsInjured?: string;
  injuryLocation?: string;
  specificInjuryLocation?: string;
  injuryDescriptionDetailed?: string;
  injuryCausedByWork?: string;
  injuryWorkRelation?: string;
  injuryDevelopedOverTime?: boolean;
  injuryDevelopmentPattern?: string;
  injuryDevelopmentType?: string;
  
  // Task & Activity
  taskBeingPerformed?: string;
  isRoutineTask?: boolean;
  taskRoutineType?: string;
  exposureDuration?: string;
  taskFrequency?: string;
  weightOrForce?: string;
  weightOrForceUnit?: string;
  
  // Environmental Conditions
  environmentalConditions?: string[];
  environmentalConditionsNA?: boolean;
  
  // Controls & Safety Equipment
  ppeRequired?: boolean;
  ppeWorn?: boolean;
  machineSafeguardsInPlace?: string;
  lotoRequired?: string;
  sopAvailable?: boolean;
  sopFollowed?: boolean;
  wasEmployeeInstructedInSOP?: boolean;
  wasProperProcedureFollowed?: boolean;
  wasViolationOfSafetyRules?: boolean;
  
  // Immediate Response
  firstAidProvided?: boolean;
  medicalTreatmentRequired?: boolean;
  supervisorNotified?: boolean;
  areaSecured?: string;
  reportedToMedicalDept?: boolean;
  supervisorActions?: string;
  
  // Witness Information
  injuryWitnessed?: boolean;
  wasInjuryWitnessed?: boolean;
  witnessNames?: string;
  witnessNamesList?: string;
  wereCoworkersPresent?: boolean;
  
  // Initial Cause Analysis
  directCause?: string;
  contributingFactors?: { people?: string[]; process?: string[]; equipment?: string[]; environment?: string[] };
  contributingFactorTypes?: string[];
  contributingActsConditions?: string;
  unsafeActOrCondition?: string;
  previousSimilarIncidents?: boolean;
  previousSimilarConditionReported?: boolean;
  previousSimilarConditionDetails?: string;
  
  // Prior Medical History
  hadPhysicalRestrictions?: boolean;
  knownRestrictions?: string;
  priorSurgeryPerformed?: boolean;
  priorSurgeryDescription?: string;
  
  // ============ WORKPLACE SAFETY - INVESTIGATION FIELDS ============
  // Investigation Status
  investigationSubmittedById?: string;
  
  // OSHA Classification
  isOshaRecordable?: boolean;
  isLostTime?: boolean;
  caseClassification?: string;
  oshaCaseNumber?: string;
  
  // Detailed Investigation
  incidentDescriptionDetailed?: string;
  investigationBodyParts?: string[];
  investigationInjuryType?: string;
  injuryMechanism?: string;
  
  // Site Investigation
  wasIncidentSiteViewed?: boolean;
  siteViewDate?: string;
  siteViewTime?: string;
  isAreaUnderSurveillance?: boolean;
  wasSurveillanceAvailable?: boolean;
  didSiteRevealCause?: boolean;
  siteRevealExplanation?: string;
  wasInjuryConsistentWithSite?: boolean;
  inconsistencyExplanation?: string;
  werePhotosVideosTaken?: boolean;
  
  // Interviews
  wereInterviewsDocumented?: boolean;
  interviewedNames?: string;
  
  // Leader Assessment
  leaderActsConditionsOpinion?: string;
  preventionRecommendations?: string;
  correctiveActionTypes?: string[];
  incidentPattern?: string;
  
  // Medical Information (Investigation)
  medicalProvidersInvolved?: string;
  treatingDoctors?: string;
  notifiedIndividuals?: string;
  
  // Work Time Impact
  didLeaveWork?: boolean;
  dateTimeLeftWork?: string;
  didReturnToWork?: boolean;
  dateTimeReturnedToWork?: string;
  dateIncidentReported?: string;
  dateInjuryKnownWorkRelated?: string;
  
  // ============ FMIR LINKED DATA ============
  fmirReportId?: string | null;
  FMIRReport?: {
    id: string;
    reportNumber: string;
    status: string;
    productName?: string;
    productItemNumber?: string;
    productCodeBatchLot?: string;
    foreignMaterialDescription?: string;
    foreignMaterialSize?: string;
    foreignMaterialHardness?: string;
    causeIdentification?: string;
    possibleSource?: string;
    howWhyOccurred?: string;
    correctiveAction?: string;
    verificationActions?: string;
    incidentDate?: string;
    incidentTime?: string;
    department?: string;
    createdAt: string;
    submittedAt?: string;
    Facility?: { id: string; name: string };
    FMIREvidence?: Array<{
      id: string;
      fileName: string;
      type: string;
      filePath: string;
      fileSize?: number;
      mimeType: string;
      description?: string;
      uploadedAt: string;
    }>;
    FMIRAIValidation?: {
      id: string;
      complianceScore: number;
      overallCompliance: string;
      summary?: string;
      aiExplanation?: string;
      fieldAnalysis?: any;
      evidenceAnalysis?: any;
      causeAnalysis?: any;
      correctiveActionAnalysis?: any;
      productHoldAnalysis?: any;
    } | null;
    User_ForeignMaterialIncident_createdByIdToUser?: { id: string; firstName: string; lastName: string; email: string };
  } | null;
}

// Helper function to parse and render FMIR-formatted descriptions
// Removes decorative unicode lines and parses sections for cleaner rendering
const parseFormattedDescription = (description: string) => {
  // Remove decorative unicode box-drawing characters - comprehensive list
  const cleanedDescription = description
    .replace(/[═─━│┃┄┅┆┇┈┉┊┋╌╍╎╏┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬╭╮╯╰▀▄█▌▐░▒▓■□▪▫●○◘◙♦♣♠♥—–―_]+/g, '') // Remove all box-drawing and decorative characters
    .replace(/[\u2500-\u257F]+/g, '') // Remove box drawing block (U+2500 to U+257F)
    .replace(/[\u2580-\u259F]+/g, '') // Remove block elements
    .replace(/\s*=+\s*/g, ' ') // Replace equals signs used as dividers with space
    .replace(/\s*-{3,}\s*/g, ' ') // Replace dashes used as dividers with space
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .replace(/^\s*$/gm, '') // Remove empty lines
    .trim();
  
  // Parse sections if they exist (GENERAL INFORMATION, FOREIGN MATERIAL DESCRIPTION, etc.)
  const sectionRegex = /^([A-Z][A-Z\s&]+)$/gm;
  const lines = cleanedDescription.split('\n');
  const sections: { title: string; content: string }[] = [];
  let currentSection: { title: string; content: string[] } | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (sectionRegex.test(trimmedLine)) {
      sectionRegex.lastIndex = 0; // Reset regex
      if (currentSection) {
        sections.push({ 
          title: currentSection.title, 
          content: currentSection.content.join('\n').trim() 
        });
      }
      currentSection = { title: trimmedLine, content: [] };
    } else if (currentSection) {
      currentSection.content.push(line);
    } else if (trimmedLine) {
      // Content before any section
      if (!currentSection) {
        currentSection = { title: '', content: [line] };
      }
    }
  }
  
  if (currentSection) {
    sections.push({ 
      title: currentSection.title, 
      content: currentSection.content.join('\n').trim() 
    });
  }
  
  return { cleanedDescription, sections };
};

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const incidentId = params.id as string;

  // Privilege-based access control - include version for real-time updates
  const { hasPrivilege, loading: privilegesLoading, version: privilegeVersion } = usePrivileges();
  const canViewIncident = hasPrivilege(INCIDENTS_PRIVILEGES.VIEW);
  const canEditIncident = hasPrivilege(INCIDENTS_PRIVILEGES.EDIT);
  const canDeleteEvidence = hasPrivilege(INCIDENTS_PRIVILEGES.EDIT); // Editing includes evidence management
  const canCreateRCA = hasPrivilege(RCA_PRIVILEGES.CREATE);
  const canUseAIAnalysis = hasPrivilege(INCIDENTS_PRIVILEGES.AI_ANALYSIS);
  const { modal: accessDeniedModal, showAccessDenied } = useAccessDeniedModal();
  
  // Check if user lacks VIEW privilege (inline check to prevent flash)
  const shouldShowAccessDenied = !privilegesLoading && !canViewIncident;

  // WebSocket for team collaboration
  const { connect, isConnected, joinIncident, leaveIncident, onlineUsers, onParticipantsUpdated, onParticipantRoleUpdated, onInvitationDeclined, onVisibilityChanged, onRCACreated, onRCAMethodologyAnalysisStarted, onRCAMethodologyAnalysisComplete, onRCAModalState, emitRCAModalState, onIncidentEvidenceAdded } = useWebSocket();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStartRCA, setShowStartRCA] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'FIVE_WHYS' | 'FISHBONE'>('FIVE_WHYS');
  const [rcaVisibility, setRcaVisibility] = useState<'PRIVATE' | 'TEAM' | 'PUBLIC'>('PRIVATE');
  const [startingRCA, setStartingRCA] = useState(false);
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState<string | null>(null);
  const [regeneratingAI, setRegeneratingAI] = useState(false);
  
  // AI Methodology Analysis State
  const [analyzingMethodology, setAnalyzingMethodology] = useState(false);
  const [methodologyRecommendation, setMethodologyRecommendation] = useState<{
    recommendedMethod: 'FIVE_WHYS' | 'FISHBONE';
    reason: string;
    confidence: number;
    alternativeMethod?: 'FIVE_WHYS' | 'FISHBONE';
    alternativeReason?: string;
    factors: {
      complexity: 'low' | 'medium' | 'high';
      recurrence: boolean;
      hasMultipleCauses: boolean;
      evidenceQuality: string;
    };
    analyzedBy?: { id: string; firstName: string; lastName: string };
    analyzedAt?: string;
  } | null>(null);
  
  // Team members viewing the Start RCA modal
  const [teamViewingModal, setTeamViewingModal] = useState<{ id: string; name: string; action: string }[]>([]);
  
  // AI Regeneration Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalStage, setAiModalStage] = useState<'preparing' | 'uploading' | 'analyzing' | 'generating' | 'finalizing' | 'complete'>('preparing');
  const [currentAnalyzingAttachment, setCurrentAnalyzingAttachment] = useState(0);
  
  // Invitation declined notification state
  const [declinedNotification, setDeclinedNotification] = useState<{
    show: boolean;
    userName: string;
    visibilityChanged: boolean;
  } | null>(null);
  
  // Team validation modal state - shown when switching to Team with no members
  const [showTeamValidationModal, setShowTeamValidationModal] = useState(false);
  
  // Chat sidebar control state - for opening Team tab directly
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [chatSidebarTab, setChatSidebarTab] = useState<'chat' | 'archived' | 'team'>('chat');
  const [pendingTeamVisibility, setPendingTeamVisibility] = useState(false); // Track if Team visibility is pending member addition
  
  // Workplace Safety tab state
  const [activeWsTab, setActiveWsTab] = useState<'incident' | 'investigation'>('incident');
  
  // FMIR Evidence media URLs - store blob URLs for authenticated file access
  const [fmirEvidenceUrls, setFmirEvidenceUrls] = useState<Record<string, string>>({});
  const [loadingFmirEvidence, setLoadingFmirEvidence] = useState(false);
  
  // Incident Evidence media URLs - store blob URLs for authenticated file access
  const [incidentEvidenceUrls, setIncidentEvidenceUrls] = useState<Record<string, string>>({});
  const [loadingIncidentEvidence, setLoadingIncidentEvidence] = useState(false);

  // Check if current user is the incident owner
  const isOwner = Boolean(user?.id && incident?.User_Incident_createdByIdToUser?.id === user.id);
  
  // Check if current user is an active participant
  const isActiveParticipant = Boolean(
    user?.id && incident?.IncidentParticipant?.some(p => 
      (p.userId === user.id || p.User_IncidentParticipant_userIdToUser?.id === user.id) && p.isActive !== false
    )
  );
  
  // Check if current user can participate in chat
  // - TEAM incidents: owner, assignee, or active participants
  // - PRIVATE incidents: only owner
  // - PUBLIC incidents: only owner and active participants (not all org members)
  const canAccessChat = Boolean(
    user?.id && (
      isOwner ||
      incident?.User_Incident_assignedToIdToUser?.id === user.id ||
      isActiveParticipant ||
      // Only allow all org members for TEAM visibility
      (incident?.visibility === 'TEAM' && user.organizationId)
    )
  );
  
  // Legacy isParticipant check for other features (viewing, etc.)
  const isParticipant = Boolean(
    user?.id && (
      incident?.User_Incident_createdByIdToUser?.id === user.id ||
      incident?.User_Incident_assignedToIdToUser?.id === user.id ||
      incident?.IncidentParticipant?.some(p => p.userId === user.id || p.User_IncidentParticipant_userIdToUser?.id === user.id) ||
      user.organizationId // Allow any user in same organization to view
    )
  );

  // Connect to WebSocket when user is available
  useEffect(() => {
    if (user?.id && user?.organizationId) {
      connect(user.id, user.organizationId);
    }
  }, [user?.id, user?.organizationId, connect]);

  // Join incident room when there are participants or team mode is active
  useEffect(() => {
    if (isConnected && isParticipant && (incident?.isTeamIncident || (incident?.IncidentParticipant && incident.IncidentParticipant.length > 0))) {
      joinIncident(incidentId);
      return () => {
        leaveIncident(incidentId);
      };
    }
  }, [isConnected, isParticipant, incident?.isTeamIncident, incident?.IncidentParticipant, incidentId, joinIncident, leaveIncident]);

  // Listen for participant updates and refetch incident
  useEffect(() => {
    const unsubscribe = onParticipantsUpdated((data) => {
      if (data.incidentId === incidentId) {
        // Refetch incident to get updated participants list
        fetchIncident();
      }
    });
    return unsubscribe;
  }, [incidentId, onParticipantsUpdated]);

  // Listen for participant role updates (real-time)
  useEffect(() => {
    const unsubscribe = onParticipantRoleUpdated((data) => {
      if (data.incidentId === incidentId) {
        // Update the participant role in local state immediately
        setIncident(prev => {
          if (!prev || !prev.IncidentParticipant) return prev;
          return {
            ...prev,
            IncidentParticipant: prev.IncidentParticipant.map(p => 
              p.userId === data.userId
                ? { ...p, role: data.role as Participant['role'], canEdit: data.canEdit, canChat: data.canChat }
                : p
            )
          };
        });
      }
    });
    return unsubscribe;
  }, [incidentId, onParticipantRoleUpdated]);

  // Listen for invitation declined events (direct notification to owner)
  useEffect(() => {
    const unsubscribe = onInvitationDeclined((data) => {
      if (data.incidentId === incidentId && isOwner) {
        const userName = `${data.declinedBy.firstName} ${data.declinedBy.lastName}`;
        setDeclinedNotification({
          show: true,
          userName,
          visibilityChanged: false, // Will be updated by visibility change event
        });
        // Refetch to get updated state
        fetchIncident();
      }
    });
    return unsubscribe;
  }, [incidentId, isOwner, onInvitationDeclined]);

  // Listen for visibility changed events
  useEffect(() => {
    const unsubscribe = onVisibilityChanged((data) => {
      if (data.incidentId === incidentId) {
        // Update local incident state immediately
        setIncident((prev) => {
          if (!prev) return null;

          const nextVisibility: Incident['visibility'] =
            data.visibility === 'PRIVATE' || data.visibility === 'TEAM' || data.visibility === 'PUBLIC'
              ? data.visibility
              : prev.visibility;

          return {
            ...prev,
            visibility: nextVisibility,
            isTeamIncident: nextVisibility === 'TEAM',
          };
        });
        
        // If this is due to all invitations declined, show notification
        if (data.reason === 'all_invitations_declined' && isOwner && data.declinedBy) {
          const userName = `${data.declinedBy.firstName} ${data.declinedBy.lastName}`;
          setDeclinedNotification({
            show: true,
            userName,
            visibilityChanged: true,
          });
        }
        
        // Refetch to ensure state is consistent
        fetchIncident();
      }
    });
    return unsubscribe;
  }, [incidentId, isOwner, onVisibilityChanged]);

  // Listen for RCA created events (real-time notification for team members)
  useEffect(() => {
    const unsubscribe = onRCACreated((data) => {
      if (data.incidentId === incidentId) {
        // Refetch incident to get updated RCA status
        fetchIncident();
      }
    });
    return unsubscribe;
  }, [incidentId, onRCACreated]);

  // Listen for RCA modal state changes (real-time team sync)
  useEffect(() => {
    const unsubscribe = onRCAModalState((data) => {
      if (data.incidentId === incidentId && data.userId !== user?.id) {
        // Update team viewing modal list
        setTeamViewingModal(prev => {
          const existing = prev.find(t => t.id === data.userId);
          if (data.action === 'closed') {
            return prev.filter(t => t.id !== data.userId);
          }
          if (existing) {
            return prev.map(t => t.id === data.userId ? { ...t, action: data.action } : t);
          }
          return [...prev, { id: data.userId, name: data.userName, action: data.action }];
        });

        // Sync method selection
        if (data.action === 'method-selected' && data.selectedMethod) {
          setSelectedMethod(data.selectedMethod as 'FIVE_WHYS' | 'FISHBONE');
        }
        
        // Sync visibility selection
        if (data.action === 'visibility-changed' && data.visibility) {
          setRcaVisibility(data.visibility as 'PRIVATE' | 'TEAM' | 'PUBLIC');
        }
        
        // Open modal if someone else opened it
        if (data.action === 'opened' && !showStartRCA) {
          setShowStartRCA(true);
        }
      }
    });
    return unsubscribe;
  }, [incidentId, user?.id, onRCAModalState, showStartRCA]);

  // Listen for RCA methodology analysis started
  useEffect(() => {
    const unsubscribe = onRCAMethodologyAnalysisStarted((data) => {
      if (data.incidentId === incidentId && data.analyzedBy?.id !== user?.id) {
        setAnalyzingMethodology(true);
        setTeamViewingModal(prev => {
          const existing = prev.find(t => t.id === data.analyzedBy.id);
          if (existing) {
            return prev.map(t => t.id === data.analyzedBy.id ? { ...t, action: 'analyzing' } : t);
          }
          return [...prev, { id: data.analyzedBy.id, name: `${data.analyzedBy.firstName} ${data.analyzedBy.lastName}`, action: 'analyzing' }];
        });
      }
    });
    return unsubscribe;
  }, [incidentId, user?.id, onRCAMethodologyAnalysisStarted]);

  // Listen for RCA methodology analysis complete
  useEffect(() => {
    const unsubscribe = onRCAMethodologyAnalysisComplete((data) => {
      if (data.incidentId === incidentId) {
        setAnalyzingMethodology(false);
        if (data.recommendation) {
          setMethodologyRecommendation(data.recommendation);
          // Auto-select the recommended method
          if (data.recommendation.recommendedMethod) {
            setSelectedMethod(data.recommendation.recommendedMethod);
          }
        }
      }
    });
    return unsubscribe;
  }, [incidentId, onRCAMethodologyAnalysisComplete]);

  // Listen for incident evidence added (when chat attachment is uploaded)
  useEffect(() => {
    const unsubscribe = onIncidentEvidenceAdded((data) => {
      if (data.incidentId === incidentId) {
        console.log('📎 Evidence added via chat, updating incident:', data);
        // Add the new evidence to the incident's Evidence array
        setIncident(prev => {
          if (!prev) return prev;
          const newEvidence = {
            id: data.evidence.id,
            type: data.evidence.type,
            fileName: data.evidence.fileName,
            filePath: data.evidence.filePath,
            mimeType: data.evidence.mimeType,
            uploadedById: data.evidence.uploadedById,
            uploadedAt: data.timestamp,
          };
          // Check if evidence already exists (avoid duplicates)
          if (prev.Evidence.some(e => e.id === newEvidence.id)) {
            return prev;
          }
          return {
            ...prev,
            Evidence: [...prev.Evidence, newEvidence],
          };
        });
      }
    });
    return unsubscribe;
  }, [incidentId, onIncidentEvidenceAdded]);

  useEffect(() => {
    fetchIncident();
  }, [incidentId]);

  const fetchIncident = async () => {
    try {
      const response = await api.get(`/incidents/${incidentId}`);
      setIncident(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load incident');
    } finally {
      setLoading(false);
    }
  };

  // Load FMIR evidence media with authentication (Firebase Storage files need to be fetched via backend)
  const loadFmirEvidenceMedia = useCallback(async (fmirId: string, evidenceId: string, type: string) => {
    if (type !== 'PHOTO' && type !== 'VIDEO') return;
    if (fmirEvidenceUrls[evidenceId]) return; // Already loaded
    
    try {
      const response = await api.get(`/fmir/${fmirId}/evidence/${evidenceId}/download`, {
        responseType: 'blob',
      });
      
      const blobUrl = URL.createObjectURL(response.data);
      setFmirEvidenceUrls(prev => ({ ...prev, [evidenceId]: blobUrl }));
    } catch (err) {
      console.error('Error loading FMIR evidence media:', err);
    }
  }, [fmirEvidenceUrls]);

  // Load FMIR evidence media when incident with FMIR data is loaded
  useEffect(() => {
    if (incident?.FMIRReport?.FMIREvidence && incident.FMIRReport.FMIREvidence.length > 0) {
      setLoadingFmirEvidence(true);
      const fmirId = incident.FMIRReport.id;
      
      // Load all image/video evidence
      const mediaEvidence = incident.FMIRReport.FMIREvidence.filter(
        (e) => e.mimeType?.startsWith('image/') || e.mimeType?.startsWith('video/')
      );
      
      Promise.all(
        mediaEvidence.map((e) => loadFmirEvidenceMedia(fmirId, e.id, e.type))
      ).finally(() => {
        setLoadingFmirEvidence(false);
      });
    }

    // Cleanup blob URLs when component unmounts
    return () => {
      Object.values(fmirEvidenceUrls).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [incident?.FMIRReport?.id, incident?.FMIRReport?.FMIREvidence]);

  // Handle FMIR evidence download
  const handleFmirEvidenceDownload = async (fmirId: string, evidenceId: string, fileName: string) => {
    try {
      const response = await api.get(`/fmir/${fmirId}/evidence/${evidenceId}/download`, {
        responseType: 'blob',
      });
      
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading FMIR evidence:', err);
    }
  };

  // Load Incident evidence media with authentication (Firebase Storage files need to be fetched via backend)
  const loadIncidentEvidenceMedia = useCallback(async (incidentId: string, evidenceId: string, mimeType: string, fileName: string) => {
    // Only load images and videos
    const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
    const isVideo = mimeType?.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(fileName);
    if (!isImage && !isVideo) return;
    if (incidentEvidenceUrls[evidenceId]) return; // Already loaded
    
    try {
      const response = await api.get(`/incidents/${incidentId}/evidence/${evidenceId}/download`, {
        responseType: 'blob',
      });
      
      const blobUrl = URL.createObjectURL(response.data);
      setIncidentEvidenceUrls(prev => ({ ...prev, [evidenceId]: blobUrl }));
    } catch (err) {
      console.error('Error loading incident evidence media:', err);
    }
  }, [incidentEvidenceUrls]);

  // Load Incident evidence media when incident with evidence is loaded
  useEffect(() => {
    if (incident?.Evidence && incident.Evidence.length > 0) {
      setLoadingIncidentEvidence(true);
      const incidentId = incident.id;
      
      // Load all image/video evidence
      const mediaEvidence = incident.Evidence.filter((e: any) => {
        const isImage = e.mimeType?.startsWith('image/') || e.fileType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(e.fileName);
        const isVideo = e.mimeType?.startsWith('video/') || e.fileType?.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(e.fileName);
        return isImage || isVideo;
      });
      
      Promise.all(
        mediaEvidence.map((e: any) => loadIncidentEvidenceMedia(incidentId, e.id, e.mimeType || e.fileType || '', e.fileName))
      ).finally(() => {
        setLoadingIncidentEvidence(false);
      });
    }

    // Cleanup blob URLs when component unmounts
    return () => {
      Object.values(incidentEvidenceUrls).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [incident?.id, incident?.Evidence]);

  // Handle Incident evidence download
  const handleIncidentEvidenceDownload = async (incidentId: string, evidenceId: string, fileName: string) => {
    try {
      const response = await api.get(`/incidents/${incidentId}/evidence/${evidenceId}/download`, {
        responseType: 'blob',
      });
      
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading incident evidence:', err);
    }
  };

  // Regenerate AI insights for the incident
  const handleRegenerateAIInsights = async () => {
    if (!incident || regeneratingAI) return;
    
    setRegeneratingAI(true);
    setError('');
    setAiModalOpen(true);
    setAiModalStage('preparing');
    setCurrentAnalyzingAttachment(0);
    
    try {
      // Calculate number of analyzable attachments
      const evidenceCount = incident.Evidence?.length || 0;
      const analyzableEvidence = incident.Evidence?.filter(
        (e: any) => e.mimeType?.startsWith('image/') || e.mimeType?.startsWith('video/')
      ) || [];
      
      // Simulate progress stages
      await new Promise(resolve => setTimeout(resolve, 500));
      setAiModalStage('uploading');
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (analyzableEvidence.length > 0) {
        setAiModalStage('analyzing');
        
        // Simulate attachment analysis progress
        const analyzeInterval = setInterval(() => {
          setCurrentAnalyzingAttachment(prev => {
            if (prev < analyzableEvidence.length) return prev + 1;
            return prev;
          });
        }, 3000);
        
        // Use longer timeout for attachment analysis (3 minutes per image + 2 minute buffer)
        const timeoutMs = Math.max(300000, analyzableEvidence.length * 90000 + 120000);
        
        try {
          await new Promise(resolve => setTimeout(resolve, 1500));
          setAiModalStage('generating');
          
          const response = await api.post(`/incidents/${incidentId}/regenerate-ai-insights`, {}, { timeout: timeoutMs });
          clearInterval(analyzeInterval);
          
          setAiModalStage('finalizing');
          await new Promise(resolve => setTimeout(resolve, 800));
          
          setAiModalStage('complete');
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          setIncident(response.data.data);
        } catch (err) {
          clearInterval(analyzeInterval);
          throw err;
        }
      } else {
        // No attachments - faster process
        setAiModalStage('generating');
        
        const response = await api.post(`/incidents/${incidentId}/regenerate-ai-insights`, {}, { timeout: 120000 });
        
        setAiModalStage('finalizing');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setAiModalStage('complete');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setIncident(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to regenerate AI insights:', err);
      // Check if this is a privilege error (403)
      if (!handlePrivilegeError(err, showAccessDenied, undefined, 'AI Analysis')) {
        // Not a privilege error - show appropriate message
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          setError('AI analysis timed out. This can happen with many or complex images. Please try again.');
        } else {
          setError(err.response?.data?.error || 'Failed to regenerate AI insights. Please try again.');
        }
      }
    } finally {
      setRegeneratingAI(false);
      setAiModalOpen(false);
      setAiModalStage('preparing');
      setCurrentAnalyzingAttachment(0);
    }
  };

  // Check if incident has team members (non-owner participants)
  const getActiveTeamMembers = () => {
    if (!incident) return [];
    return incident.IncidentParticipant?.filter(
      p => p.isActive && p.userId !== incident.User_Incident_createdByIdToUser.id
    ) || [];
  };

  // Handle AI methodology analysis - thorough analysis to recommend best RCA method
  const handleAnalyzeMethodology = async () => {
    if (!incident) return;
    
    setAnalyzingMethodology(true);
    setMethodologyRecommendation(null);
    
    // Emit WebSocket event for team sync
    emitRCAModalState(incidentId, 'analyzing');
    
    try {
      const response = await api.post(`/rca/incidents/${incidentId}/analyze-methodology`);
      
      if (response.data.success && response.data.data.recommendation) {
        const rec = response.data.data.recommendation;
        setMethodologyRecommendation(rec);
        // Auto-select the recommended method
        setSelectedMethod(rec.recommendedMethod);
        // Emit method selection for team sync
        emitRCAModalState(incidentId, 'method-selected', { selectedMethod: rec.recommendedMethod });
      }
    } catch (err: any) {
      console.error('Failed to analyze methodology:', err);
      handlePrivilegeError(err, showAccessDenied, setError, 'Analyze Methodology');
    } finally {
      setAnalyzingMethodology(false);
    }
  };

  const handleStartRCA = async () => {
    if (!selectedMethod) return;

    // Validate Team visibility selection if trying to start with Team but no members
    if (rcaVisibility === 'TEAM') {
      const activeTeamMembers = getActiveTeamMembers();
      if (activeTeamMembers.length === 0) {
        // Close the Start RCA modal and show team validation modal
        setShowStartRCA(false);
        setShowTeamValidationModal(true);
        return;
      }
    }

    setStartingRCA(true);
    try {
      // Update visibility first if it changed
      if (incident && rcaVisibility !== incident.visibility) {
        await api.patch(`/incidents/${incidentId}/visibility`, {
          visibility: rcaVisibility,
        });
        // Update local state
        setIncident(prev => prev ? { ...prev, visibility: rcaVisibility, isTeamIncident: rcaVisibility === 'TEAM' } : null);
      }
      
      const response = await api.post(`/rca/incidents/${incidentId}`, {
        method: selectedMethod,
      });
      router.push(`/rca/${response.data.data.id}`);
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Start RCA');
      setStartingRCA(false);
    }
  };

  // Handle visibility change request - validates Team selection
  const handleVisibilityRequest = (newVisibility: 'PRIVATE' | 'TEAM' | 'PUBLIC') => {
    if (!incident || incident.visibility === newVisibility) return;
    
    // If switching TO Team visibility, check if there are team members
    if (newVisibility === 'TEAM') {
      const activeTeamMembers = getActiveTeamMembers();
      if (activeTeamMembers.length === 0) {
        // Show validation modal instead of changing visibility
        setShowTeamValidationModal(true);
        return;
      }
    }
    
    // Otherwise proceed with visibility change
    handleChangeVisibility(newVisibility);
  };

  // Handle visibility change
  const handleChangeVisibility = async (newVisibility: 'PRIVATE' | 'TEAM' | 'PUBLIC', confirmArchive = false) => {
    if (!incident || incident.visibility === newVisibility) return;
    
    // Count non-owner participants
    const activeParticipants = incident.IncidentParticipant?.filter(
      p => p.isActive && p.userId !== incident.User_Incident_createdByIdToUser.id
    ) || [];
    
    // Frontend validation for Team → Private: must remove all members first
    if (incident.visibility === 'TEAM' && newVisibility === 'PRIVATE' && activeParticipants.length > 0) {
      setError('Cannot switch to Private while team members are still assigned. Please remove all team members first using the Team tab in the chat sidebar.');
      return;
    }
    
    // Frontend validation for Team → Public: must remove all members first
    if (incident.visibility === 'TEAM' && newVisibility === 'PUBLIC' && activeParticipants.length > 0) {
      setError('This incident has active team members. To make it public, all team members must be removed first.');
      return;
    }
    
    setChangingVisibility(true);
    try {
      const response = await api.patch(`/incidents/${incidentId}/visibility`, {
        visibility: newVisibility,
        confirmArchive,
      });
      setIncident({ 
        ...incident, 
        visibility: response.data.data.visibility,
        isTeamIncident: response.data.data.isTeamIncident ?? (newVisibility === 'TEAM')
      });
      setError(''); // Clear any previous errors
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;
      
      // Handle specific error codes
      if (errorCode === 'TEAM_MEMBERS_EXIST') {
        setError(errorMessage || 'Please remove all team members first.');
      } else if (errorCode === 'CHAT_ARCHIVE_REQUIRED' && err.response?.data?.requiresConfirmation) {
        // Ask for confirmation to archive chat
        const chatCount = err.response?.data?.data?.chatMessageCount || 0;
        const confirmed = window.confirm(
          `Switching from Team to Public will archive ${chatCount} chat message(s).\n\n` +
          `Archived messages will still be accessible in the Archive tab but won't be part of the active chat.\n\n` +
          `Do you want to continue?`
        );
        if (confirmed) {
          // Retry with confirmation
          setChangingVisibility(false);
          handleChangeVisibility(newVisibility, true);
          return;
        }
      } else {
        setError(errorMessage || 'Failed to update visibility setting');
      }
    } finally {
      setChangingVisibility(false);
    }
  };

  // Delete evidence
  const handleDeleteEvidence = async (evidenceId: string, fileName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone and the file will be permanently removed.`
    );
    
    if (!confirmed) return;
    
    setDeletingEvidenceId(evidenceId);
    try {
      await api.delete(`/incidents/${incidentId}/evidence/${evidenceId}`);
      // Remove from local state
      setIncident(prev => prev ? {
        ...prev,
        Evidence: prev.Evidence.filter((ev: any) => ev.id !== evidenceId)
      } : null);
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Delete Evidence');
    } finally {
      setDeletingEvidenceId(null);
    }
  };
  
  // Public incidents are read-only for everyone except the creator
  const isPublicReadOnly = incident?.visibility === 'PUBLIC' && !isOwner;
  
  // Check if user can edit this incident
  const canEdit = isOwner || (
    incident?.visibility === 'TEAM' && 
    incident?.IncidentParticipant?.some(p => p.userId === user?.id && p.canEdit)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'UNDER_REVIEW':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'RCA_IN_PROGRESS':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'RCA_COMPLETE':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      case 'CAPA_IN_PROGRESS':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'CLOSED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'LOW':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Show loading while data or privileges are loading
  if (loading || privilegesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-blue-200 dark:border-blue-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading incident details...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // Show access denied modal if user lacks VIEW privilege
  if (shouldShowAccessDenied) {
    return (
      <>
        <AccessDeniedModal
          isOpen={shouldShowAccessDenied}
          onClose={() => {
            router.push('/incidents');
          }}
          featureName="View Incident Report"
          requiredPrivilege={INCIDENTS_PRIVILEGES.VIEW}
        />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900" />
      </>
    );
  }

  if (!incident) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error?.includes('permission') ? 'Access Restricted' : 'Incident Not Found'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {error?.includes('permission') 
              ? 'You do not have permission to view this incident. The visibility may have changed.'
              : 'This incident could not be loaded. It may have been deleted or you may not have access.'}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="w-full px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/incidents"
              className="w-full px-6 py-3 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
            >
              View All Incidents
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // For Workplace Safety incidents, both Incident Report AND Investigation must be submitted
  const isWorkplaceSafety = incident.type === 'WORKPLACE_SAFETY';
  const incidentReportSubmitted = ['SUBMITTED', 'UNDER_REVIEW', 'RCA_IN_PROGRESS', 'RCA_COMPLETE', 'CAPA_IN_PROGRESS', 'CLOSED'].includes(incident.status);
  const investigationSubmitted = isWorkplaceSafety ? !!incident.investigationSubmittedAt : true;
  
  // Use RCAAnalysis from API (capitalized) with optional chaining
  const rcaAnalyses = incident.RCAAnalysis || [];
  const canStartRCA = incidentReportSubmitted && 
    investigationSubmitted &&
    rcaAnalyses.length === 0;
  const hasActiveRCA = rcaAnalyses.some((rca: any) => !rca.isValidated);
  const hasValidatedRCA = rcaAnalyses.some((rca: any) => rca.isValidated);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Access Denied Modal */}
      {accessDeniedModal}
      
      {/* AI Analysis Modal for Regeneration */}
      <AIAnalysisModal
        isOpen={aiModalOpen}
        stage={aiModalStage}
        attachmentCount={incident?.Evidence?.filter((e: any) => e.mimeType?.startsWith('image/') || e.mimeType?.startsWith('video/')).length || 0}
        currentAttachment={currentAnalyzingAttachment}
      />
      
      {/* Invitation Declined Notification Modal */}
      {declinedNotification?.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 relative animate-in fade-in duration-200">
            {/* Close button */}
            <button
              onClick={() => setDeclinedNotification(null)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <span className="text-3xl">👥</span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Invitation Declined
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                <span className="font-semibold">{declinedNotification.userName}</span> declined your invitation to join this incident.
              </p>
              
              {declinedNotification.visibilityChanged && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <span className="font-semibold">Visibility Updated:</span> This incident has been automatically switched to <span className="font-semibold">Private</span> as there are no remaining team members.
                  </p>
                </div>
              )}
              
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                To continue working on this incident, you may:
              </p>
              
              <div className="space-y-2 text-left mb-6">
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Add another team member</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Keep the incident private and continue working</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Change to public (read-only for others)</span>
                </div>
              </div>
              
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                You can switch back to a Team Incident at any time by adding team members.
              </p>
              
              <button
                onClick={() => setDeclinedNotification(null)}
                className="w-full px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors"
              >
                Got it, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="w-full px-2 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <Link
                href="/dashboard"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {incident.incidentNumber}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  {incident.Category?.name} • {incident.Facility?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-3 flex-shrink-0">
              {/* Edit button for draft incidents - disabled for public read-only */}
              {incident.status === 'DRAFT' && isOwner && !isPublicReadOnly && (
                <Link
                  href={`/incidents/new?edit=${incident.id}`}
                  className="hidden sm:inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="hidden xs:inline">Edit Draft</span>
                </Link>
              )}
              {/* Complete Investigation button for Workplace Safety with pending investigation - disabled for public read-only */}
              {isWorkplaceSafety && incidentReportSubmitted && !investigationSubmitted && isOwner && !isPublicReadOnly && (
                <Link
                  href={`/incidents/new?edit=${incident.id}&section=investigation`}
                  className="hidden sm:inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-amber-300 dark:border-amber-600 rounded-md shadow-sm text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="hidden xs:inline">Complete Investigation</span>
                </Link>
              )}
              <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(incident.status)}`}>
                {incident.status.replace('_', ' ')}
              </span>
              {incident.severity && (
                <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${getSeverityColor(incident.severity)}`}>
                  {incident.severity}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 focus:outline-none"
              aria-label="Close error message"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Public Read-Only Banner */}
        {isPublicReadOnly && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <span className="text-xl">🌐</span>
            <div>
              <span className="font-medium">Public Incident (Read-Only)</span>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                This incident is publicly visible to all users in your organization. Only the creator can make edits.
              </p>
            </div>
          </div>
        )}

        {/* Visibility Badge Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Visibility:</span>
            <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${
              incident.visibility === 'PRIVATE' 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                : incident.visibility === 'TEAM'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
            }`}>
              {incident.visibility === 'PRIVATE' && '🔐'}
              {incident.visibility === 'TEAM' && '👥'}
              {incident.visibility === 'PUBLIC' && '🌐'}
              {incident.visibility === 'PRIVATE' ? 'Private' : incident.visibility === 'TEAM' ? 'Team' : 'Public'}
            </span>
            {incident.isTeamIncident && incident.IncidentParticipant && incident.IncidentParticipant.length > 0 && (
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                • {incident.IncidentParticipant.length} team member{incident.IncidentParticipant.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {/* Visibility change controls - only for owner */}
          {isOwner && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mr-1 sm:mr-2">Change:</span>
              <button
                onClick={() => handleVisibilityRequest('PRIVATE')}
                disabled={changingVisibility || incident.visibility === 'PRIVATE'}
                className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                  incident.visibility === 'PRIVATE'
                    ? 'bg-blue-500 text-white cursor-default'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                } disabled:opacity-50`}
              >
                🔐 <span className="hidden xs:inline">Private</span>
              </button>
              <button
                onClick={() => handleVisibilityRequest('TEAM')}
                disabled={changingVisibility || incident.visibility === 'TEAM'}
                className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                  incident.visibility === 'TEAM'
                    ? 'bg-purple-500 text-white cursor-default'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                } disabled:opacity-50`}
              >
                👥 <span className="hidden xs:inline">Team</span>
              </button>
              <button
                onClick={() => handleVisibilityRequest('PUBLIC')}
                disabled={changingVisibility || incident.visibility === 'PUBLIC'}
                className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                  incident.visibility === 'PUBLIC'
                    ? 'bg-green-500 text-white cursor-default'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                } disabled:opacity-50`}
              >
                🌐 <span className="hidden xs:inline">Public</span>
              </button>
              {changingVisibility && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2"></div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Workplace Safety Tabs */}
            {isWorkplaceSafety && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                {/* Tab Navigation */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="flex -mb-px">
                    <button
                      onClick={() => setActiveWsTab('incident')}
                      className={`flex-1 py-2 sm:py-4 px-2 sm:px-6 text-center border-b-2 font-medium text-xs sm:text-sm transition-colors ${
                        activeWsTab === 'incident'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <span className="text-sm sm:text-lg">📋</span>
                        <span className="text-xs sm:text-sm">Incident Report</span>
                        {incidentReportSubmitted && (
                          <span className="hidden xs:inline ml-1 px-1 sm:px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-[10px] sm:text-xs rounded">
                            Submitted
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveWsTab('investigation')}
                      className={`flex-1 py-2 sm:py-4 px-2 sm:px-6 text-center border-b-2 font-medium text-xs sm:text-sm transition-colors ${
                        activeWsTab === 'investigation'
                          ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/20'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <span className="text-sm sm:text-lg">🔍</span>
                        <span className="text-xs sm:text-sm">Investigation</span>
                        {investigationSubmitted ? (
                          <span className="hidden xs:inline ml-1 px-1 sm:px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-[10px] sm:text-xs rounded">
                            Completed
                          </span>
                        ) : (
                          <span className="hidden xs:inline ml-1 px-1 sm:px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[10px] sm:text-xs rounded">
                            Pending
                          </span>
                        )}
                      </div>
                    </button>
                  </nav>
                </div>
              </div>
            )}

            {/* Description Card - Always visible */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 overflow-hidden">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                Incident Details
              </h2>
              
              {/* Render parsed description with sections */}
              {(() => {
                const { sections } = parseFormattedDescription(incident.description);
                
                if (sections.length > 0 && sections.some(s => s.title)) {
                  // Has formatted sections - render as cards
                  return (
                    <div className="space-y-3 sm:space-y-4">
                      {sections.map((section, index) => (
                        <div key={index}>
                          {section.title && (
                            <h3 className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1.5 sm:mb-2 flex items-center">
                              <span className="w-1 h-4 sm:h-5 bg-blue-500 rounded-full mr-2"></span>
                              {section.title}
                            </h3>
                          )}
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-0 sm:pl-3 break-words">
                            {section.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                }
                
                // Plain description without sections
                return (
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                    {incident.description}
                  </p>
                );
              })()}
              
              {/* Type, Severity, Category, Reporter Info */}
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Type</span>
                    <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white uppercase">{incident.type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Severity</span>
                    <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{incident.severity || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Category</span>
                    <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{incident.Category?.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Reported By</span>
                    <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                      {incident.User_Incident_createdByIdToUser?.firstName} {incident.User_Incident_createdByIdToUser?.lastName}
                    </p>
                  </div>
                </div>
              </div>
              
              {incident.aiSummary && (
                <div className="mt-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">AI Insights from Incident Analysis</span>
                    </div>
                    {isOwner && (
                      <button
                        onClick={handleRegenerateAIInsights}
                        disabled={regeneratingAI}
                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Regenerate AI insights including key findings, recommendations, and RCA methodology"
                      >
                        {regeneratingAI ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Regenerating...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Regenerate AI</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">{incident.aiSummary}</p>
                  
                  {/* Show prompt to generate full insights if aiAnalysisData is missing */}
                  {!incident.aiAnalysisData && isOwner && (
                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                      <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start sm:items-center gap-1.5">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Click &quot;Regenerate AI&quot; to generate full AI insights including key findings, investigation guidance, and RCA methodology recommendations.</span>
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Show regenerate option when no AI data exists */}
              {!incident.aiSummary && !incident.aiAnalysisData && isOwner && (
                <div className="mt-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span className="text-xs sm:text-sm">No AI insights available</span>
                    </div>
                    <button
                      onClick={handleRegenerateAIInsights}
                      disabled={regeneratingAI}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {regeneratingAI ? (
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
                          <span>Generate AI Insights</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* FMIR Report Card - Displayed when incident is linked to an FMIR */}
            {incident.FMIRReport && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg shadow p-3 sm:p-6 border border-amber-200 dark:border-amber-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-amber-100 dark:bg-amber-800 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h2 className="text-sm sm:text-lg font-semibold text-amber-900 dark:text-amber-100">
                      Foreign Material Incident Report
                    </h2>
                  </div>
                  <Link
                    href={`/fmir/${incident.FMIRReport.id}`}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 flex items-center gap-1 bg-amber-100 dark:bg-amber-900/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md self-start sm:self-auto"
                  >
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span className="hidden xs:inline">View Full FMIR</span>
                    <span className="xs:hidden">View</span>
                  </Link>
                </div>

                {/* FMIR Quick Info */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-2 sm:p-3">
                    <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium mb-0.5 sm:mb-1">Report Number</p>
                    <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-100 truncate">{incident.FMIRReport.reportNumber}</p>
                  </div>
                  {incident.FMIRReport.productName && (
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-2 sm:p-3">
                      <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium mb-0.5 sm:mb-1">Product</p>
                      <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-100 truncate">{incident.FMIRReport.productName}</p>
                    </div>
                  )}
                  {incident.FMIRReport.productCodeBatchLot && (
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-2 sm:p-3">
                      <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium mb-0.5 sm:mb-1">Batch/Lot</p>
                      <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-100 truncate">{incident.FMIRReport.productCodeBatchLot}</p>
                    </div>
                  )}
                  {incident.FMIRReport.department && (
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-2 sm:p-3">
                      <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium mb-0.5 sm:mb-1">Department</p>
                      <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-100 truncate">{incident.FMIRReport.department}</p>
                    </div>
                  )}
                </div>

                {/* Foreign Material Details */}
                {incident.FMIRReport.foreignMaterialDescription && (
                  <div className="mb-3 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Foreign Material Description
                    </h3>
                    <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 leading-relaxed bg-white/30 dark:bg-gray-800/30 p-2 sm:p-3 rounded-lg">
                      {incident.FMIRReport.foreignMaterialDescription}
                      {incident.FMIRReport.foreignMaterialSize && (
                        <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs text-amber-600 dark:text-amber-400">(Size: {incident.FMIRReport.foreignMaterialSize})</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Cause & Source */}
                {(incident.FMIRReport.possibleSource || incident.FMIRReport.howWhyOccurred) && (
                  <div className="mb-3 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Cause Identification
                    </h3>
                    <div className="bg-white/30 dark:bg-gray-800/30 p-2 sm:p-3 rounded-lg space-y-1.5 sm:space-y-2">
                      {incident.FMIRReport.possibleSource && (
                        <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                          <span className="font-medium">Possible Source:</span> {incident.FMIRReport.possibleSource}
                        </p>
                      )}
                      {incident.FMIRReport.howWhyOccurred && (
                        <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                          <span className="font-medium">How/Why:</span> {incident.FMIRReport.howWhyOccurred}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Corrective Action */}
                {incident.FMIRReport.correctiveAction && (
                  <div className="mb-3 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Corrective Action Taken
                    </h3>
                    <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 leading-relaxed bg-white/30 dark:bg-gray-800/30 p-2 sm:p-3 rounded-lg">
                      {incident.FMIRReport.correctiveAction}
                    </p>
                  </div>
                )}

                {/* FMIR AI Validation Summary */}
                {incident.FMIRReport.FMIRAIValidation && (
                  <div className="mb-3 sm:mb-4 p-2 sm:p-4 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border border-amber-300 dark:border-amber-700">
                    <h3 className="text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1.5 sm:mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>AI Compliance Validation</span>
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${
                        incident.FMIRReport.FMIRAIValidation.overallCompliance === 'COMPLIANT' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                          : incident.FMIRReport.FMIRAIValidation.overallCompliance === 'PARTIALLY_COMPLIANT'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {incident.FMIRReport.FMIRAIValidation.complianceScore}% - {incident.FMIRReport.FMIRAIValidation.overallCompliance?.replace('_', ' ')}
                      </span>
                    </h3>
                    {incident.FMIRReport.FMIRAIValidation.summary && (
                      <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                        {incident.FMIRReport.FMIRAIValidation.summary}
                      </p>
                    )}
                  </div>
                )}

                {/* FMIR Evidence Gallery */}
                {incident.FMIRReport.FMIREvidence && incident.FMIRReport.FMIREvidence.length > 0 && (
                  <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-amber-200 dark:border-amber-800">
                    <h3 className="text-sm sm:text-base font-semibold text-amber-900 dark:text-amber-100 mb-3 sm:mb-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Evidence Attachments</span>
                      <span className="px-1.5 sm:px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[10px] sm:text-xs font-medium rounded-full">
                        {incident.FMIRReport.FMIREvidence.length} file{incident.FMIRReport.FMIREvidence.length !== 1 ? 's' : ''}
                      </span>
                      {loadingFmirEvidence && (
                        <span className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          <span className="hidden xs:inline">Loading images...</span>
                        </span>
                      )}
                    </h3>
                    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                      {incident.FMIRReport.FMIREvidence.map((evidence: any, index: number) => {
                        const isImage = evidence.mimeType?.startsWith('image/');
                        const isVideo = evidence.mimeType?.startsWith('video/');
                        const mediaUrl = fmirEvidenceUrls[evidence.id];
                        
                        return (
                          <div
                            key={evidence.id}
                            className="group relative bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-amber-200 dark:border-amber-700 hover:border-amber-400 dark:hover:border-amber-500"
                          >
                            {/* Image/Video Preview */}
                            {isImage ? (
                              <div 
                                className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer"
                                onClick={() => {
                                  if (mediaUrl) {
                                    window.open(mediaUrl, '_blank');
                                  } else {
                                    handleFmirEvidenceDownload(incident.FMIRReport!.id, evidence.id, evidence.fileName);
                                  }
                                }}
                              >
                                {mediaUrl ? (
                                  <img
                                    src={mediaUrl}
                                    alt={evidence.fileName}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <svg className="animate-spin w-8 h-8 text-amber-500" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                    </svg>
                                  </div>
                                )}
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                                  <span className="text-white text-sm font-medium flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    View Full Size
                                  </span>
                                </div>
                                {/* Evidence number badge */}
                                <div className="absolute top-2 left-2 px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded-md shadow">
                                  #{index + 1}
                                </div>
                              </div>
                            ) : isVideo ? (
                              <div 
                                className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer"
                                onClick={() => {
                                  if (mediaUrl) {
                                    window.open(mediaUrl, '_blank');
                                  } else {
                                    handleFmirEvidenceDownload(incident.FMIRReport!.id, evidence.id, evidence.fileName);
                                  }
                                }}
                              >
                                {mediaUrl ? (
                                  <video
                                    src={mediaUrl}
                                    className="w-full h-full object-cover"
                                    controls={false}
                                    muted
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <svg className="animate-spin w-8 h-8 text-amber-500" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                    </svg>
                                  </div>
                                )}
                                {/* Video play icon overlay */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                                  <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-amber-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z"/>
                                    </svg>
                                  </div>
                                </div>
                                {/* Evidence number badge */}
                                <div className="absolute top-2 left-2 px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded-md shadow">
                                  #{index + 1}
                                </div>
                              </div>
                            ) : (
                              /* Non-image/video file placeholder */
                              <div 
                                className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center cursor-pointer"
                                onClick={() => handleFmirEvidenceDownload(incident.FMIRReport!.id, evidence.id, evidence.fileName)}
                              >
                                <div className="text-center">
                                  <svg className="w-12 h-12 text-amber-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">
                                    {evidence.fileName?.split('.').pop() || 'FILE'}
                                  </span>
                                </div>
                                {/* Evidence number badge */}
                                <div className="absolute top-2 left-2 px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded-md shadow">
                                  #{index + 1}
                                </div>
                              </div>
                            )}
                            
                            {/* File info footer */}
                            <div className="p-3 bg-white dark:bg-gray-800">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                {evidence.fileName}
                              </p>
                              {evidence.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                  {evidence.description}
                                </p>
                              )}
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {evidence.fileSize ? `${(evidence.fileSize / 1024).toFixed(1)} KB` : evidence.type || 'File'}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFmirEvidenceDownload(incident.FMIRReport!.id, evidence.id, evidence.fileName);
                                  }}
                                  className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  Download
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Insights Card - Key Findings & Investigation Guidance */}
            {incident.aiAnalysisData && ((incident.aiAnalysisData.keyFindings?.length ?? 0) > 0 || (incident.aiAnalysisData.investigationGuidance?.length ?? 0) > 0 || incident.aiAnalysisData.evidenceSummary) && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg shadow p-3 sm:p-6 border border-emerald-200 dark:border-emerald-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h2 className="text-sm sm:text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                      AI Insights
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {incident.aiAnalysisData.generatedAt && (
                      <span className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400">
                        Generated: {formatDateTime(incident.aiAnalysisData.generatedAt)}
                      </span>
                    )}
                    {isOwner && (
                      <button
                        onClick={handleRegenerateAIInsights}
                        disabled={regeneratingAI}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 flex items-center gap-1 disabled:opacity-50"
                        title="Regenerate AI insights"
                      >
                        {regeneratingAI ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Regenerating...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Regenerate</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Evidence Summary */}
                {incident.aiAnalysisData.evidenceSummary && (
                  <div className="mb-3 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Evidence Summary
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
                      {incident.aiAnalysisData.evidenceSummary}
                    </p>
                  </div>
                )}

                {/* Key Findings */}
                {incident.aiAnalysisData.keyFindings && incident.aiAnalysisData.keyFindings.length > 0 && (
                  <div className="mb-3 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Key Findings ({incident.aiAnalysisData.keyFindings.length})
                    </h3>
                    <ul className="space-y-1.5 sm:space-y-2">
                      {incident.aiAnalysisData.keyFindings.map((finding, index) => (
                        <li key={index} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
                          <span className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 bg-emerald-200 dark:bg-emerald-700 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-medium text-emerald-800 dark:text-emerald-200">
                            {index + 1}
                          </span>
                          <span className="leading-relaxed">{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Investigation Guidance */}
                {incident.aiAnalysisData.investigationGuidance && incident.aiAnalysisData.investigationGuidance.length > 0 && (
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Investigation Guidance ({incident.aiAnalysisData.investigationGuidance.length})
                    </h3>
                    <ul className="space-y-1.5 sm:space-y-2">
                      {incident.aiAnalysisData.investigationGuidance.map((guidance, index) => (
                        <li key={index} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
                          <span className="flex-shrink-0 mt-0.5">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                          <span className="leading-relaxed">{guidance}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* AI Recommended RCA Methodology Card */}
            {incident.aiAnalysisData?.recommendedRCAMethodology && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg shadow p-3 sm:p-6 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center space-x-2 mb-3 sm:mb-4">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h2 className="text-sm sm:text-lg font-semibold text-purple-900 dark:text-purple-100">
                    Recommended RCA Methodology
                  </h2>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                  {/* Method Icon */}
                  <div className="flex-shrink-0 self-start">
                    {incident.aiAnalysisData.recommendedRCAMethodology.primary === 'FISHBONE' ? (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-800 rounded-lg flex items-center justify-center">
                        <span className="text-xl sm:text-2xl">🐟</span>
                      </div>
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-800 rounded-lg flex items-center justify-center">
                        <span className="text-xl sm:text-2xl">❓</span>
                      </div>
                    )}
                  </div>

                  {/* Method Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                      <h3 className="text-sm sm:text-lg font-bold text-purple-900 dark:text-purple-100">
                        {incident.aiAnalysisData.recommendedRCAMethodology.primary === 'FISHBONE' 
                          ? 'Fishbone (Ishikawa) Diagram' 
                          : '5 Whys Analysis'}
                      </h3>
                      <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-purple-200 dark:bg-purple-700 text-purple-800 dark:text-purple-200 rounded-full">
                        {incident.aiAnalysisData.recommendedRCAMethodology.confidence}% confidence
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                      {incident.aiAnalysisData.recommendedRCAMethodology.reason}
                    </p>

                    {/* Alternative Method */}
                    {incident.aiAnalysisData.recommendedRCAMethodology.alternativeMethod && (
                      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-purple-200 dark:border-purple-700">
                        <p className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 mb-0.5 sm:mb-1">Alternative Method:</p>
                        <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300">
                          <span className="font-medium">
                            {incident.aiAnalysisData.recommendedRCAMethodology.alternativeMethod === 'FISHBONE' 
                              ? 'Fishbone Diagram' 
                              : '5 Whys'}
                          </span>
                          {incident.aiAnalysisData.recommendedRCAMethodology.alternativeReason && (
                            <span className="text-purple-600 dark:text-purple-400">
                              {' — '}{incident.aiAnalysisData.recommendedRCAMethodology.alternativeReason}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hint to Start RCA */}
                {!hasActiveRCA && !hasValidatedRCA && canStartRCA && (
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-purple-200 dark:border-purple-700">
                    <p className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 flex items-start sm:items-center gap-1">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Click &quot;Start RCA&quot; below to begin Root Cause Analysis with this recommended method</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Details Grid - Show on incident tab or for non-workplace safety */}
            {(!isWorkplaceSafety || activeWsTab === 'incident') && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6">
              <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                Details
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Type</span>
                  <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{incident.type.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Category</span>
                  <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{incident.Category?.name}</p>
                </div>
                <div>
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Facility</span>
                  <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{incident.Facility?.name}</p>
                </div>
                {incident.Department && (
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Department</span>
                    <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{incident.Department.name}</p>
                  </div>
                )}
                {incident.Area && (
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Area</span>
                    <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{incident.Area.name}</p>
                  </div>
                )}
                {incident.Line && (
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Line</span>
                    <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{incident.Line.name}</p>
                  </div>
                )}
                {incident.Shift && (
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Shift</span>
                    <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{incident.Shift.name}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Occurred At</span>
                  <p className="text-xs sm:text-sm text-gray-900 dark:text-white">
                    {formatDateTime(incident.occurredAt)}
                  </p>
                </div>
                {incident.productName && (
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Product</span>
                    <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{incident.productName}</p>
                  </div>
                )}
                {incident.lotNumber && (
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Lot Number</span>
                    <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{incident.lotNumber}</p>
                  </div>
                )}
                {incident.machineId && (
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Machine ID</span>
                    <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{incident.machineId}</p>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* ==================== WORKPLACE SAFETY - INCIDENT REPORT TAB ==================== */}
            {/* Section 1: Employee Information */}
            {isWorkplaceSafety && activeWsTab === 'incident' && (incident.employeeName || incident.employeeIdNumber || incident.employeeEmail || incident.employeePhone || incident.employeeHomeAddress || incident.employeeGender || incident.employeeLanguage || incident.employeeLastSSN4 || incident.ownedJobTitle || incident.jobAssignmentAtInjury || incident.positionAtTimeOfIncident || incident.departmentWhereInjury || incident.needsInterpreter !== null || incident.interpreterAssisting !== null) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border-l-4 border-blue-500">
                <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <span className="text-base sm:text-xl">👤</span> Employee Information
                </h2>
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                  {incident.employeeName && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 sm:p-3">
                      <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Employee Name</span>
                      <p className="text-xs sm:text-sm text-gray-900 dark:text-white font-medium mt-0.5 sm:mt-1">{incident.employeeName}</p>
                    </div>
                  )}
                  {incident.employeeIdNumber && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 sm:p-3">
                      <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Employee ID</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.employeeIdNumber}</p>
                    </div>
                  )}
                  {incident.employeeLastSSN4 && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last 4 SSN</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">***-**-{incident.employeeLastSSN4}</p>
                    </div>
                  )}
                  {incident.employeeEmail && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.employeeEmail}</p>
                    </div>
                  )}
                  {incident.employeePhone && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phone</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.employeePhone}</p>
                    </div>
                  )}
                  {incident.employeeGender && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Gender</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.employeeGender}</p>
                    </div>
                  )}
                  {incident.employeeLanguage && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Primary Language</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.employeeLanguage}</p>
                    </div>
                  )}
                  {incident.needsInterpreter !== null && incident.needsInterpreter !== undefined && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Needs Interpreter</span>
                      <p className={`font-medium mt-1 ${incident.needsInterpreter ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {incident.needsInterpreter ? 'Yes' : 'No'}
                      </p>
                    </div>
                  )}
                  {incident.interpreterAssisting !== null && incident.interpreterAssisting !== undefined && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Interpreter Assisting</span>
                      <p className={`font-medium mt-1 ${incident.interpreterAssisting ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {incident.interpreterAssisting ? 'Yes' : 'No'}
                      </p>
                    </div>
                  )}
                  {incident.employeeHomeAddress && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 md:col-span-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Home Address</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.employeeHomeAddress}</p>
                    </div>
                  )}
                  {incident.ownedJobTitle && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Job Title</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.ownedJobTitle}</p>
                    </div>
                  )}
                  {incident.jobAssignmentAtInjury && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Job Assignment at Injury</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.jobAssignmentAtInjury}</p>
                    </div>
                  )}
                  {incident.positionAtTimeOfIncident && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Position at Time of Incident</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.positionAtTimeOfIncident}</p>
                    </div>
                  )}
                  {incident.departmentWhereInjury && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Department Where Injury Occurred</span>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.departmentWhereInjury}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 2: Employment Status */}
            {isWorkplaceSafety && activeWsTab === 'incident' && (incident.wasClockedIn !== null || incident.wasPerformingOtherDuties !== null || incident.otherDutiesExplanation || incident.employedElsewhere !== null || incident.workedForOtherLast6Months !== null || incident.otherEmployerNames || incident.additionalEmployers || incident.additionalEmployerHours || incident.additionalEmployerStartDate) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-indigo-500">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">💼</span> Employment Status
                </h2>
                <div className="space-y-4">
                  {/* Status indicators */}
                  <div className="flex flex-wrap gap-4">
                    {incident.wasClockedIn !== null && incident.wasClockedIn !== undefined && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <span className={`w-3 h-3 rounded-full ${incident.wasClockedIn ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {incident.wasClockedIn ? 'Was Clocked In' : 'Was NOT Clocked In'}
                        </span>
                      </div>
                    )}
                    {incident.wasPerformingOtherDuties !== null && incident.wasPerformingOtherDuties !== undefined && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <span className={`w-3 h-3 rounded-full ${incident.wasPerformingOtherDuties ? 'bg-amber-500' : 'bg-gray-400'}`}></span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {incident.wasPerformingOtherDuties ? 'Was Performing Other Duties' : 'Performing Regular Duties'}
                        </span>
                      </div>
                    )}
                    {incident.employedElsewhere !== null && incident.employedElsewhere !== undefined && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <span className={`w-3 h-3 rounded-full ${incident.employedElsewhere ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {incident.employedElsewhere ? 'Employed Elsewhere' : 'No Other Employment'}
                        </span>
                      </div>
                    )}
                    {incident.workedForOtherLast6Months !== null && incident.workedForOtherLast6Months !== undefined && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <span className={`w-3 h-3 rounded-full ${incident.workedForOtherLast6Months ? 'bg-purple-500' : 'bg-gray-400'}`}></span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {incident.workedForOtherLast6Months ? 'Worked for Other Employer (Last 6 Months)' : 'No Other Work (Last 6 Months)'}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {incident.otherDutiesExplanation && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 md:col-span-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Other Duties Explanation</span>
                        <p className="text-gray-900 dark:text-white mt-1">{incident.otherDutiesExplanation}</p>
                      </div>
                    )}
                    {incident.otherEmployerNames && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Other Employer Names</span>
                        <p className="text-gray-900 dark:text-white mt-1">{incident.otherEmployerNames}</p>
                      </div>
                    )}
                    {incident.additionalEmployers && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Additional Employers</span>
                        <p className="text-gray-900 dark:text-white mt-1">{incident.additionalEmployers}</p>
                      </div>
                    )}
                    {incident.additionalEmployerHours && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Additional Employer Hours</span>
                        <p className="text-gray-900 dark:text-white mt-1">{incident.additionalEmployerHours}</p>
                      </div>
                    )}
                    {incident.additionalEmployerStartDate && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Additional Employer Start Date</span>
                        <p className="text-gray-900 dark:text-white mt-1">{formatDate(incident.additionalEmployerStartDate)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Injury Details */}
            {isWorkplaceSafety && activeWsTab === 'incident' && (incident.injuryType || incident.injuryTypeDescription || (incident.bodyPartsAffected && incident.bodyPartsAffected.length > 0) || incident.bodyPartsAffectedNA || incident.otherBodyPartDetail || incident.allBodyPartsInjured || incident.injuryLocation || incident.specificInjuryLocation || incident.injuryDescriptionDetailed || incident.injuryCausedByWork || incident.injuryWorkRelation || incident.injuryDevelopedOverTime !== null || incident.injuryDevelopmentPattern || incident.injuryDevelopmentType) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🩹</span> Injury Details
                </h2>
                <div className="space-y-4">
                  {/* Injury Type Badge */}
                  {incident.injuryType && (
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex px-4 py-2 rounded-lg text-sm font-bold ${
                        incident.injuryType === 'LOST_TIME' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' :
                        incident.injuryType === 'RECORDABLE' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200' :
                        incident.injuryType === 'FIRST_AID' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                      }`}>
                        {incident.injuryType.replace(/_/g, ' ')}
                      </span>
                      {incident.injuryTypeDescription && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">— {incident.injuryTypeDescription}</span>
                      )}
                    </div>
                  )}
                  
                  {/* Body Parts */}
                  {incident.bodyPartsAffected && incident.bodyPartsAffected.length > 0 && !incident.bodyPartsAffectedNA && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Body Parts Affected</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {incident.bodyPartsAffected.map((part, i) => (
                          <span key={i} className="inline-flex px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-medium">
                            {part}
                          </span>
                        ))}
                      </div>
                      {incident.bodyPartsAffected.includes('OTHER') && incident.otherBodyPartDetail && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                          <span className="font-medium">Other: </span>{incident.otherBodyPartDetail}
                        </p>
                      )}
                      {incident.allBodyPartsInjured && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                          <span className="font-medium">All Body Parts Description: </span>{incident.allBodyPartsInjured}
                        </p>
                      )}
                    </div>
                  )}
                  {incident.bodyPartsAffectedNA && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Body Parts Affected</span>
                      <p className="text-gray-600 dark:text-gray-400 mt-1 italic">Not Applicable</p>
                    </div>
                  )}

                  {/* Injury Location */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {incident.injuryLocation && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Injury Location</span>
                        <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.injuryLocation}</p>
                      </div>
                    )}
                    {incident.specificInjuryLocation && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Specific Location</span>
                        <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.specificInjuryLocation}</p>
                      </div>
                    )}
                  </div>

                  {/* Detailed Description */}
                  {incident.injuryDescriptionDetailed && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Detailed Injury Description</span>
                      <p className="text-gray-900 dark:text-white mt-2 whitespace-pre-wrap">{incident.injuryDescriptionDetailed}</p>
                    </div>
                  )}

                  {/* Work Relation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {incident.injuryCausedByWork && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Injury Caused by Work</span>
                        <p className={`font-medium mt-1 ${incident.injuryCausedByWork === 'YES' ? 'text-red-600 dark:text-red-400' : incident.injuryCausedByWork === 'NO' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {incident.injuryCausedByWork}
                        </p>
                      </div>
                    )}
                    {incident.injuryWorkRelation && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Injury Work Relation</span>
                        <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.injuryWorkRelation}</p>
                      </div>
                    )}
                  </div>

                  {/* Injury Development */}
                  {(incident.injuryDevelopedOverTime !== null || incident.injuryDevelopmentPattern || incident.injuryDevelopmentType) && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-700">
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">Injury Development</span>
                      <div className="mt-2 space-y-2">
                        {incident.injuryDevelopedOverTime !== null && incident.injuryDevelopedOverTime !== undefined && (
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            <span className="font-medium">Developed Over Time: </span>
                            {incident.injuryDevelopedOverTime ? 'Yes' : 'No'}
                          </p>
                        )}
                        {incident.injuryDevelopmentType && (
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            <span className="font-medium">Development Type: </span>{incident.injuryDevelopmentType}
                          </p>
                        )}
                        {incident.injuryDevelopmentPattern && (
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            <span className="font-medium">Pattern: </span>{incident.injuryDevelopmentPattern}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 4: Task & Activity Information */}
            {isWorkplaceSafety && activeWsTab === 'incident' && (incident.taskBeingPerformed || incident.isRoutineTask !== null || incident.taskRoutineType || incident.exposureDuration || incident.taskFrequency || incident.weightOrForce) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-amber-500">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">⚙️</span> Task & Activity Information
                </h2>
                <div className="space-y-4">
                  {incident.taskBeingPerformed && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Task Being Performed</span>
                      <p className="text-gray-900 dark:text-white mt-2 font-medium">{incident.taskBeingPerformed}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {incident.isRoutineTask !== null && incident.isRoutineTask !== undefined && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block">Task Type</span>
                        <p className={`font-bold mt-1 ${incident.isRoutineTask ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {incident.isRoutineTask ? 'Routine' : 'Non-Routine'}
                        </p>
                        {incident.taskRoutineType && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{incident.taskRoutineType}</p>
                        )}
                      </div>
                    )}
                    {incident.exposureDuration && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block">Exposure Duration</span>
                        <p className="text-gray-900 dark:text-white font-bold mt-1">{incident.exposureDuration}</p>
                      </div>
                    )}
                    {incident.taskFrequency && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block">Task Frequency</span>
                        <p className="text-gray-900 dark:text-white font-bold mt-1">{incident.taskFrequency}</p>
                      </div>
                    )}
                    {incident.weightOrForce && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block">Weight/Force</span>
                        <p className="text-gray-900 dark:text-white font-bold mt-1">
                          {incident.weightOrForce}{incident.weightOrForceUnit ? ` ${incident.weightOrForceUnit}` : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section 5: Environmental Conditions */}
            {isWorkplaceSafety && activeWsTab === 'incident' && ((incident.environmentalConditions && incident.environmentalConditions.length > 0) || incident.environmentalConditionsNA) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-teal-500">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🌡️</span> Environmental Conditions
                </h2>
                {incident.environmentalConditionsNA ? (
                  <p className="text-gray-600 dark:text-gray-400 italic">Not Applicable</p>
                ) : incident.environmentalConditions && incident.environmentalConditions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {incident.environmentalConditions.map((cond, i) => (
                      <span key={i} className="inline-flex px-4 py-2 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-lg text-sm font-medium">
                        {cond}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section 6: Controls & Safety Equipment */}
            {isWorkplaceSafety && activeWsTab === 'incident' && (incident.ppeRequired !== null || incident.ppeWorn !== null || incident.sopAvailable !== null || incident.sopFollowed !== null || incident.wasEmployeeInstructedInSOP !== null || incident.wasProperProcedureFollowed !== null || incident.wasViolationOfSafetyRules !== null || incident.machineSafeguardsInPlace || incident.lotoRequired) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🛡️</span> Controls & Safety Equipment
                </h2>
                <div className="space-y-4">
                  {/* PPE Section */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Personal Protective Equipment (PPE)</h3>
                    <div className="flex flex-wrap gap-4">
                      {incident.ppeRequired !== null && incident.ppeRequired !== undefined && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-600/50 shadow-sm">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${incident.ppeRequired ? 'bg-blue-500' : 'bg-gray-400'}`}>
                            {incident.ppeRequired ? '✓' : '−'}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">PPE Required</span>
                        </div>
                      )}
                      {incident.ppeWorn !== null && incident.ppeWorn !== undefined && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-600/50 shadow-sm">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${incident.ppeWorn ? 'bg-green-500' : 'bg-red-500'}`}>
                            {incident.ppeWorn ? '✓' : '✗'}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">PPE Worn</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SOP Section */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Standard Operating Procedures (SOP)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {incident.sopAvailable !== null && incident.sopAvailable !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${incident.sopAvailable ? 'bg-blue-500' : 'bg-gray-400'}`}>
                            {incident.sopAvailable ? '✓' : '−'}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">SOP Available</span>
                        </div>
                      )}
                      {incident.sopFollowed !== null && incident.sopFollowed !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${incident.sopFollowed ? 'bg-green-500' : 'bg-red-500'}`}>
                            {incident.sopFollowed ? '✓' : '✗'}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">SOP Followed</span>
                        </div>
                      )}
                      {incident.wasEmployeeInstructedInSOP !== null && incident.wasEmployeeInstructedInSOP !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${incident.wasEmployeeInstructedInSOP ? 'bg-green-500' : 'bg-red-500'}`}>
                            {incident.wasEmployeeInstructedInSOP ? '✓' : '✗'}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">Instructed in SOP</span>
                        </div>
                      )}
                      {incident.wasProperProcedureFollowed !== null && incident.wasProperProcedureFollowed !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${incident.wasProperProcedureFollowed ? 'bg-green-500' : 'bg-red-500'}`}>
                            {incident.wasProperProcedureFollowed ? '✓' : '✗'}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">Proper Procedure Followed</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Safety Violations & Equipment */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {incident.wasViolationOfSafetyRules !== null && incident.wasViolationOfSafetyRules !== undefined && (
                      <div className={`rounded-lg p-4 text-center ${incident.wasViolationOfSafetyRules ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'}`}>
                        <span className={`text-3xl ${incident.wasViolationOfSafetyRules ? '⚠️' : '✅'}`}></span>
                        <p className={`text-sm font-bold mt-2 ${incident.wasViolationOfSafetyRules ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                          {incident.wasViolationOfSafetyRules ? 'Safety Rules Violated' : 'No Safety Violations'}
                        </p>
                      </div>
                    )}
                    {incident.machineSafeguardsInPlace && (
                      <div className={`rounded-lg p-4 text-center ${
                        incident.machineSafeguardsInPlace === 'YES' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' :
                        incident.machineSafeguardsInPlace === 'NO' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700' :
                        'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                      }`}>
                        <span className="text-3xl">🔧</span>
                        <p className="text-sm font-bold mt-2 text-gray-700 dark:text-gray-300">Machine Safeguards</p>
                        <p className={`text-sm ${
                          incident.machineSafeguardsInPlace === 'YES' ? 'text-green-600 dark:text-green-400' :
                          incident.machineSafeguardsInPlace === 'NO' ? 'text-red-600 dark:text-red-400' :
                          'text-gray-600 dark:text-gray-400'
                        }`}>{incident.machineSafeguardsInPlace}</p>
                      </div>
                    )}
                    {incident.lotoRequired && (
                      <div className={`rounded-lg p-4 text-center ${
                        incident.lotoRequired === 'YES' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700' :
                        'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                      }`}>
                        <span className="text-3xl">🔒</span>
                        <p className="text-sm font-bold mt-2 text-gray-700 dark:text-gray-300">LOTO Required</p>
                        <p className={`text-sm ${incident.lotoRequired === 'YES' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>{incident.lotoRequired}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section 7: Immediate Response */}
            {isWorkplaceSafety && activeWsTab === 'incident' && (incident.firstAidProvided !== null || incident.medicalTreatmentRequired !== null || incident.supervisorNotified !== null || incident.areaSecured || incident.reportedToMedicalDept !== null || incident.supervisorActions) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🚨</span> Immediate Response
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {incident.firstAidProvided !== null && incident.firstAidProvided !== undefined && (
                      <div className={`rounded-lg p-4 text-center ${incident.firstAidProvided ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                        <span className="text-2xl">🩹</span>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-2">First Aid</p>
                        <p className={`text-sm font-bold ${incident.firstAidProvided ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {incident.firstAidProvided ? 'Provided' : 'Not Provided'}
                        </p>
                      </div>
                    )}
                    {incident.medicalTreatmentRequired !== null && incident.medicalTreatmentRequired !== undefined && (
                      <div className={`rounded-lg p-4 text-center ${incident.medicalTreatmentRequired ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                        <span className="text-2xl">🏥</span>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-2">Medical Treatment</p>
                        <p className={`text-sm font-bold ${incident.medicalTreatmentRequired ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {incident.medicalTreatmentRequired ? 'Required' : 'Not Required'}
                        </p>
                      </div>
                    )}
                    {incident.supervisorNotified !== null && incident.supervisorNotified !== undefined && (
                      <div className={`rounded-lg p-4 text-center ${incident.supervisorNotified ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        <span className="text-2xl">👔</span>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-2">Supervisor</p>
                        <p className={`text-sm font-bold ${incident.supervisorNotified ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {incident.supervisorNotified ? 'Notified' : 'Not Notified'}
                        </p>
                      </div>
                    )}
                    {incident.areaSecured && (
                      <div className={`rounded-lg p-4 text-center ${incident.areaSecured === 'YES' || incident.areaSecured === 'true' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                        <span className="text-2xl">🚧</span>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-2">Area Secured</p>
                        <p className={`text-sm font-bold ${incident.areaSecured === 'YES' || incident.areaSecured === 'true' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {incident.areaSecured === 'YES' || incident.areaSecured === 'true' ? 'Yes' : incident.areaSecured === 'NO' || incident.areaSecured === 'false' ? 'No' : incident.areaSecured}
                        </p>
                      </div>
                    )}
                    {incident.reportedToMedicalDept !== null && incident.reportedToMedicalDept !== undefined && (
                      <div className={`rounded-lg p-4 text-center ${incident.reportedToMedicalDept ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                        <span className="text-2xl">📋</span>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-2">Medical Dept</p>
                        <p className={`text-sm font-bold ${incident.reportedToMedicalDept ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {incident.reportedToMedicalDept ? 'Reported' : 'Not Reported'}
                        </p>
                      </div>
                    )}
                  </div>
                  {incident.supervisorActions && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Supervisor Actions Taken</span>
                      <p className="text-gray-900 dark:text-white mt-2 whitespace-pre-wrap">{incident.supervisorActions}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 8: Witness Information */}
            {isWorkplaceSafety && activeWsTab === 'incident' && (incident.injuryWitnessed !== null || incident.wasInjuryWitnessed !== null || incident.witnessNames || incident.witnessNamesList || incident.wereCoworkersPresent !== null) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-purple-500">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">👁️</span> Witness Information
                </h2>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    {(incident.injuryWitnessed !== null || incident.wasInjuryWitnessed !== null) && (
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${(incident.injuryWitnessed || incident.wasInjuryWitnessed) ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${(incident.injuryWitnessed || incident.wasInjuryWitnessed) ? 'bg-green-500' : 'bg-gray-400'}`}>
                          {(incident.injuryWitnessed || incident.wasInjuryWitnessed) ? '✓' : '✗'}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {(incident.injuryWitnessed || incident.wasInjuryWitnessed) ? 'Injury Was Witnessed' : 'Injury Was Not Witnessed'}
                        </span>
                      </div>
                    )}
                    {incident.wereCoworkersPresent !== null && incident.wereCoworkersPresent !== undefined && (
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${incident.wereCoworkersPresent ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${incident.wereCoworkersPresent ? 'bg-blue-500' : 'bg-gray-400'}`}>
                          {incident.wereCoworkersPresent ? '✓' : '✗'}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {incident.wereCoworkersPresent ? 'Coworkers Were Present' : 'No Coworkers Present'}
                        </span>
                      </div>
                    )}
                  </div>
                  {(incident.witnessNames || incident.witnessNamesList) && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Witness Names</span>
                      <p className="text-gray-900 dark:text-white mt-2">{incident.witnessNames || incident.witnessNamesList}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 9: Initial Cause Analysis */}
            {isWorkplaceSafety && activeWsTab === 'incident' && (incident.directCause || incident.unsafeActOrCondition || incident.contributingActsConditions || incident.contributingFactors || incident.contributingFactorTypes?.length || incident.previousSimilarIncidents !== null || incident.previousSimilarConditionReported !== null || incident.previousSimilarConditionDetails) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-rose-500">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🔍</span> Initial Cause Analysis
                </h2>
                <div className="space-y-4">
                  {incident.directCause && (
                    <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-4 border border-rose-200 dark:border-rose-700">
                      <span className="text-xs font-medium text-rose-700 dark:text-rose-300 uppercase tracking-wide">Direct Cause</span>
                      <p className="text-rose-900 dark:text-rose-100 mt-2 font-medium">{incident.directCause}</p>
                    </div>
                  )}
                  
                  {incident.unsafeActOrCondition && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Classification</span>
                      <div className="mt-2">
                        <span className={`inline-flex px-4 py-2 rounded-lg text-sm font-bold ${
                          incident.unsafeActOrCondition === 'UNSAFE_ACT' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' :
                          incident.unsafeActOrCondition === 'UNSAFE_CONDITION' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200' :
                          'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200'
                        }`}>
                          {incident.unsafeActOrCondition === 'UNSAFE_ACT' ? '⚠️ Unsafe Act' :
                           incident.unsafeActOrCondition === 'UNSAFE_CONDITION' ? '🏗️ Unsafe Condition' :
                           '⚠️🏗️ Both Unsafe Act & Condition'}
                        </span>
                      </div>
                    </div>
                  )}

                  {incident.contributingActsConditions && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contributing Acts/Conditions</span>
                      <p className="text-gray-900 dark:text-white mt-2 whitespace-pre-wrap">{incident.contributingActsConditions}</p>
                    </div>
                  )}

                  {incident.contributingFactors && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-3">Contributing Factors by Category</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {incident.contributingFactors.people && incident.contributingFactors.people.length > 0 && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">👥 People</span>
                            <ul className="mt-2 space-y-1">
                              {incident.contributingFactors.people.map((f, i) => (
                                <li key={i} className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                                  <span className="text-blue-400">•</span>{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {incident.contributingFactors.process && incident.contributingFactors.process.length > 0 && (
                          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                            <span className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">⚙️ Process</span>
                            <ul className="mt-2 space-y-1">
                              {incident.contributingFactors.process.map((f, i) => (
                                <li key={i} className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
                                  <span className="text-green-400">•</span>{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {incident.contributingFactors.equipment && incident.contributingFactors.equipment.length > 0 && (
                          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                            <span className="text-sm font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-2">🔧 Equipment</span>
                            <ul className="mt-2 space-y-1">
                              {incident.contributingFactors.equipment.map((f, i) => (
                                <li key={i} className="text-sm text-orange-800 dark:text-orange-200 flex items-start gap-2">
                                  <span className="text-orange-400">•</span>{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {incident.contributingFactors.environment && incident.contributingFactors.environment.length > 0 && (
                          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                            <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">🌡️ Environment</span>
                            <ul className="mt-2 space-y-1">
                              {incident.contributingFactors.environment.map((f, i) => (
                                <li key={i} className="text-sm text-purple-800 dark:text-purple-200 flex items-start gap-2">
                                  <span className="text-purple-400">•</span>{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {incident.contributingFactorTypes && incident.contributingFactorTypes.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contributing Factor Types</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {incident.contributingFactorTypes.map((type, i) => (
                          <span key={i} className="inline-flex px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full text-sm">
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Previous Incidents Section */}
                  {(incident.previousSimilarIncidents !== null || incident.previousSimilarConditionReported !== null) && (
                    <div className={`rounded-lg p-4 ${(incident.previousSimilarIncidents || incident.previousSimilarConditionReported) ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${(incident.previousSimilarIncidents || incident.previousSimilarConditionReported) ? 'bg-amber-100 dark:bg-amber-800' : 'bg-green-100 dark:bg-green-800'}`}>
                          {(incident.previousSimilarIncidents || incident.previousSimilarConditionReported) ? '⚠️' : '✅'}
                        </span>
                        <div>
                          <p className={`font-medium ${(incident.previousSimilarIncidents || incident.previousSimilarConditionReported) ? 'text-amber-800 dark:text-amber-200' : 'text-green-800 dark:text-green-200'}`}>
                            {incident.previousSimilarIncidents ? 'Previous Similar Incidents Reported' : 'No Previous Similar Incidents'}
                          </p>
                          {incident.previousSimilarConditionReported !== null && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Similar condition previously reported: {incident.previousSimilarConditionReported ? 'Yes' : 'No'}
                            </p>
                          )}
                        </div>
                      </div>
                      {incident.previousSimilarConditionDetails && (
                        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 pl-13">{incident.previousSimilarConditionDetails}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 10: Prior Medical History */}
            {isWorkplaceSafety && activeWsTab === 'incident' && (incident.hadPhysicalRestrictions !== null || incident.knownRestrictions || incident.priorSurgeryPerformed !== null || incident.priorSurgeryDescription) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-cyan-500">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🏥</span> Prior Medical History
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {incident.hadPhysicalRestrictions !== null && incident.hadPhysicalRestrictions !== undefined && (
                      <div className={`rounded-lg p-4 ${incident.hadPhysicalRestrictions ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Physical Restrictions</span>
                        <p className={`font-medium mt-1 ${incident.hadPhysicalRestrictions ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-400'}`}>
                          {incident.hadPhysicalRestrictions ? 'Yes - Had Physical Restrictions' : 'No Physical Restrictions'}
                        </p>
                        {incident.knownRestrictions && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{incident.knownRestrictions}</p>
                        )}
                      </div>
                    )}
                    {incident.priorSurgeryPerformed !== null && incident.priorSurgeryPerformed !== undefined && (
                      <div className={`rounded-lg p-4 ${incident.priorSurgeryPerformed ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Prior Surgery</span>
                        <p className={`font-medium mt-1 ${incident.priorSurgeryPerformed ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                          {incident.priorSurgeryPerformed ? 'Yes - Prior Surgery Performed' : 'No Prior Surgery'}
                        </p>
                        {incident.priorSurgeryDescription && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{incident.priorSurgeryDescription}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== INVESTIGATION TAB CONTENT ==================== */}
            {/* Workplace Safety - Investigation Tab Content */}
            {isWorkplaceSafety && activeWsTab === 'investigation' && (
              <>
                {/* Investigation Status Banner */}
                {!investigationSubmitted && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">⏳</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-amber-800 dark:text-amber-200">Investigation Pending</h3>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          The investigation for this workplace safety incident has not been completed yet. 
                          A supervisor or safety manager needs to complete the investigation form.
                        </p>
                        {isOwner && !isPublicReadOnly && (
                          <Link
                            href={`/incidents/new?edit=${incident.id}&section=investigation`}
                            className="inline-flex items-center mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Complete Investigation
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Investigation Content - Show when completed */}
                {investigationSubmitted && (
                  <>
                    {/* Section 1: OSHA Classification & Case Information */}
                    {(incident.isOshaRecordable !== null || incident.isLostTime !== null || incident.caseClassification || incident.oshaCaseNumber) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <span className="text-xl">📊</span> OSHA Classification & Case Information
                          <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded-full">Completed</span>
                        </h2>
                        <div className="space-y-4">
                          {/* Primary Classification Badges */}
                          <div className="flex flex-wrap gap-3">
                            {incident.isOshaRecordable !== null && incident.isOshaRecordable !== undefined && (
                              <div className={`px-6 py-3 rounded-xl text-center ${incident.isOshaRecordable ? 'bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700' : 'bg-green-100 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700'}`}>
                                <span className={`text-2xl font-bold ${incident.isOshaRecordable ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                                  {incident.isOshaRecordable ? '⚠️' : '✅'}
                                </span>
                                <p className={`text-sm font-bold mt-1 ${incident.isOshaRecordable ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'}`}>
                                  {incident.isOshaRecordable ? 'OSHA RECORDABLE' : 'NON-RECORDABLE'}
                                </p>
                              </div>
                            )}
                            {incident.isLostTime !== null && incident.isLostTime !== undefined && (
                              <div className={`px-6 py-3 rounded-xl text-center ${incident.isLostTime ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-300 dark:border-orange-700' : 'bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-300 dark:border-gray-600'}`}>
                                <span className={`text-2xl font-bold ${incident.isLostTime ? 'text-orange-700 dark:text-orange-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {incident.isLostTime ? '⏰' : '−'}
                                </span>
                                <p className={`text-sm font-bold mt-1 ${incident.isLostTime ? 'text-orange-800 dark:text-orange-200' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {incident.isLostTime ? 'LOST TIME CASE' : 'NO LOST TIME'}
                                </p>
                              </div>
                            )}
                          </div>
                          {/* Case Details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {incident.caseClassification && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Case Classification</span>
                                <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.caseClassification}</p>
                              </div>
                            )}
                            {incident.oshaCaseNumber && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">OSHA Case Number</span>
                                <p className="text-gray-900 dark:text-white font-medium mt-1 font-mono">{incident.oshaCaseNumber}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 2: Detailed Investigation Description */}
                    {(incident.incidentDescriptionDetailed || incident.investigationBodyParts?.length || incident.investigationInjuryType) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <span className="text-xl">📝</span> Detailed Investigation Findings
                        </h2>
                        <div className="space-y-4">
                          {incident.incidentDescriptionDetailed && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">Detailed Incident Description</span>
                              <p className="text-gray-900 dark:text-white mt-2 whitespace-pre-wrap leading-relaxed">{incident.incidentDescriptionDetailed}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {incident.investigationBodyParts && incident.investigationBodyParts.length > 0 && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Body Parts Affected (Investigation Confirmed)</span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {incident.investigationBodyParts.map((part, i) => (
                                    <span key={i} className="inline-flex px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-medium">
                                      {part}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {incident.investigationInjuryType && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Injury Type (Investigation Confirmed)</span>
                                <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.investigationInjuryType}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 3: Site Investigation */}
                    {(incident.wasIncidentSiteViewed !== null || incident.siteViewDate || incident.siteViewTime || incident.isAreaUnderSurveillance !== null || incident.wasSurveillanceAvailable !== null || incident.didSiteRevealCause !== null || incident.siteRevealExplanation || incident.wasInjuryConsistentWithSite !== null || incident.inconsistencyExplanation || incident.werePhotosVideosTaken !== null) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-amber-500">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <span className="text-xl">🔎</span> Site Investigation
                        </h2>
                        <div className="space-y-4">
                          {/* Site Visit Info */}
                          {incident.wasIncidentSiteViewed !== null && incident.wasIncidentSiteViewed !== undefined && (
                            <div className={`rounded-lg p-4 ${incident.wasIncidentSiteViewed ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                              <div className="flex items-center gap-3">
                                <span className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${incident.wasIncidentSiteViewed ? 'bg-green-500' : 'bg-gray-400'}`}>
                                  {incident.wasIncidentSiteViewed ? '✓' : '✗'}
                                </span>
                                <div>
                                  <p className={`font-medium ${incident.wasIncidentSiteViewed ? 'text-green-800 dark:text-green-200' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {incident.wasIncidentSiteViewed ? 'Incident Site Was Viewed' : 'Incident Site Was NOT Viewed'}
                                  </p>
                                  {incident.wasIncidentSiteViewed && (incident.siteViewDate || incident.siteViewTime) && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                      {incident.siteViewDate && `Date: ${formatDate(incident.siteViewDate)}`}
                                      {incident.siteViewDate && incident.siteViewTime && ' • '}
                                      {incident.siteViewTime && `Time: ${incident.siteViewTime}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Surveillance Info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {incident.isAreaUnderSurveillance !== null && incident.isAreaUnderSurveillance !== undefined && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Area Under Surveillance</span>
                                <p className={`font-medium mt-1 ${incident.isAreaUnderSurveillance ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {incident.isAreaUnderSurveillance ? 'Yes' : 'No'}
                                </p>
                              </div>
                            )}
                            {incident.wasSurveillanceAvailable !== null && incident.wasSurveillanceAvailable !== undefined && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Surveillance Footage Available</span>
                                <p className={`font-medium mt-1 ${incident.wasSurveillanceAvailable ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {incident.wasSurveillanceAvailable ? 'Yes' : 'No'}
                                </p>
                              </div>
                            )}
                            {incident.werePhotosVideosTaken !== null && incident.werePhotosVideosTaken !== undefined && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Photos/Videos Taken</span>
                                <p className={`font-medium mt-1 ${incident.werePhotosVideosTaken ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {incident.werePhotosVideosTaken ? 'Yes' : 'No'}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Site Analysis */}
                          {(incident.didSiteRevealCause !== null || incident.siteRevealExplanation) && (
                            <div className={`rounded-lg p-4 ${incident.didSiteRevealCause ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Did Site Reveal Cause?</span>
                              <p className={`font-medium mt-1 ${incident.didSiteRevealCause ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                {incident.didSiteRevealCause === true ? 'Yes' : incident.didSiteRevealCause === false ? 'No' : 'Not determined'}
                              </p>
                              {incident.siteRevealExplanation && (
                                <p className="text-gray-700 dark:text-gray-300 mt-2 text-sm">{incident.siteRevealExplanation}</p>
                              )}
                            </div>
                          )}

                          {/* Injury Consistency */}
                          {(incident.wasInjuryConsistentWithSite !== null || incident.inconsistencyExplanation) && (
                            <div className={`rounded-lg p-4 ${incident.wasInjuryConsistentWithSite === false ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700' : incident.wasInjuryConsistentWithSite === true ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Was Injury Consistent With Site?</span>
                              <p className={`font-medium mt-1 ${incident.wasInjuryConsistentWithSite === false ? 'text-red-700 dark:text-red-300' : incident.wasInjuryConsistentWithSite === true ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                {incident.wasInjuryConsistentWithSite === true ? 'Yes - Consistent' : incident.wasInjuryConsistentWithSite === false ? 'No - Inconsistency Found' : 'Not determined'}
                              </p>
                              {incident.inconsistencyExplanation && (
                                <p className="text-gray-700 dark:text-gray-300 mt-2 text-sm">{incident.inconsistencyExplanation}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 4: Interviews */}
                    {(incident.wereInterviewsDocumented !== null || incident.interviewedNames) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-purple-500">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <span className="text-xl">🗣️</span> Interviews Conducted
                        </h2>
                        <div className="space-y-4">
                          {incident.wereInterviewsDocumented !== null && incident.wereInterviewsDocumented !== undefined && (
                            <div className={`flex items-center gap-3 p-4 rounded-lg ${incident.wereInterviewsDocumented ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                              <span className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${incident.wereInterviewsDocumented ? 'bg-green-500' : 'bg-gray-400'}`}>
                                {incident.wereInterviewsDocumented ? '✓' : '✗'}
                              </span>
                              <p className={`font-medium ${incident.wereInterviewsDocumented ? 'text-green-800 dark:text-green-200' : 'text-gray-600 dark:text-gray-400'}`}>
                                {incident.wereInterviewsDocumented ? 'Interviews Were Documented' : 'No Interviews Documented'}
                              </p>
                            </div>
                          )}
                          {incident.interviewedNames && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Persons Interviewed</span>
                              <p className="text-gray-900 dark:text-white mt-2">{incident.interviewedNames}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 5: Leader's Assessment & Recommendations */}
                    {(incident.leaderActsConditionsOpinion || incident.preventionRecommendations || incident.correctiveActionTypes?.length || incident.incidentPattern) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <span className="text-xl">👔</span> Leader's Assessment & Recommendations
                        </h2>
                        <div className="space-y-4">
                          {incident.leaderActsConditionsOpinion && (
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
                              <span className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">Leader's Opinion on Acts/Conditions</span>
                              <p className="text-gray-900 dark:text-white mt-2 whitespace-pre-wrap leading-relaxed">{incident.leaderActsConditionsOpinion}</p>
                            </div>
                          )}
                          {incident.preventionRecommendations && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">Prevention Recommendations</span>
                              <p className="text-gray-900 dark:text-white mt-2 whitespace-pre-wrap leading-relaxed">{incident.preventionRecommendations}</p>
                            </div>
                          )}
                          {incident.correctiveActionTypes && incident.correctiveActionTypes.length > 0 && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recommended Corrective Action Types</span>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {incident.correctiveActionTypes.map((type, i) => (
                                  <span key={i} className="inline-flex px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                                    {type}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {incident.incidentPattern && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Incident Pattern Identified</span>
                              <p className="text-gray-900 dark:text-white font-medium mt-1">{incident.incidentPattern}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 6: Medical Information */}
                    {(incident.medicalProvidersInvolved || incident.treatingDoctors || incident.notifiedIndividuals) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-cyan-500">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <span className="text-xl">🏥</span> Medical Information
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {incident.medicalProvidersInvolved && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Medical Providers Involved</span>
                              <p className="text-gray-900 dark:text-white mt-2">{incident.medicalProvidersInvolved}</p>
                            </div>
                          )}
                          {incident.treatingDoctors && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Treating Doctors</span>
                              <p className="text-gray-900 dark:text-white mt-2">{incident.treatingDoctors}</p>
                            </div>
                          )}
                          {incident.notifiedIndividuals && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 md:col-span-2">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Individuals Notified</span>
                              <p className="text-gray-900 dark:text-white mt-2">{incident.notifiedIndividuals}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 7: Work Time Impact */}
                    {(incident.didLeaveWork !== null || incident.dateTimeLeftWork || incident.didReturnToWork !== null || incident.dateTimeReturnedToWork || incident.dateIncidentReported || incident.dateInjuryKnownWorkRelated) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <span className="text-xl">⏱️</span> Work Time Impact
                        </h2>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {incident.didLeaveWork !== null && incident.didLeaveWork !== undefined && (
                              <div className={`rounded-lg p-4 ${incident.didLeaveWork ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Left Work Due to Injury</span>
                                <p className={`font-bold mt-1 ${incident.didLeaveWork ? 'text-orange-700 dark:text-orange-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {incident.didLeaveWork ? 'Yes' : 'No'}
                                </p>
                                {incident.dateTimeLeftWork && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Left: {formatDateTime(incident.dateTimeLeftWork)}
                                  </p>
                                )}
                              </div>
                            )}
                            {incident.didReturnToWork !== null && incident.didReturnToWork !== undefined && (
                              <div className={`rounded-lg p-4 ${incident.didReturnToWork ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'}`}>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Returned to Work</span>
                                <p className={`font-bold mt-1 ${incident.didReturnToWork ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                  {incident.didReturnToWork ? 'Yes' : 'Not Yet'}
                                </p>
                                {incident.dateTimeReturnedToWork && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Returned: {formatDateTime(incident.dateTimeReturnedToWork)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {incident.dateIncidentReported && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date Incident Reported</span>
                                <p className="text-gray-900 dark:text-white font-medium mt-1">{formatDateTime(incident.dateIncidentReported)}</p>
                              </div>
                            )}
                            {incident.dateInjuryKnownWorkRelated && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date Injury Known Work-Related</span>
                                <p className="text-gray-900 dark:text-white font-medium mt-1">{formatDateTime(incident.dateInjuryKnownWorkRelated)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Investigation Submission Info */}
                    {incident.investigationSubmittedAt && (
                      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Investigation completed on <span className="font-medium text-gray-900 dark:text-white">{formatDateTime(incident.investigationSubmittedAt)}</span>
                            </span>
                          </div>
                          {isOwner && !isPublicReadOnly && (
                            <Link
                              href={`/incidents/new?edit=${incident.id}&section=investigation`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Edit Investigation
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Evidence - Show on both tabs or for non-workplace safety */}
            {incident.Evidence.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Evidence</span>
                  <span className="px-1.5 sm:px-2 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-[10px] sm:text-xs font-medium rounded-full">
                    {incident.Evidence.length} file{incident.Evidence.length !== 1 ? 's' : ''}
                  </span>
                  {loadingIncidentEvidence && (
                    <span className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span className="hidden xs:inline">Loading images...</span>
                    </span>
                  )}
                </h3>
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                  {incident.Evidence.map((ev: any, index: number) => {
                    const isImage = ev.mimeType?.startsWith('image/') || ev.fileType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(ev.fileName);
                    const isVideo = ev.mimeType?.startsWith('video/') || ev.fileType?.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(ev.fileName);
                    const isAudio = (ev.mimeType?.startsWith('audio/') || ev.fileType?.startsWith('audio/') || /\.(mp3|wav|ogg|webm)$/i.test(ev.fileName)) && !isVideo;
                    const canDelete = ev.uploadedById === user?.id || isOwner || ['ADMIN', 'SYSTEM_ADMIN'].includes(user?.role || '');
                    const isDeleting = deletingEvidenceId === ev.id;
                    const mediaUrl = incidentEvidenceUrls[ev.id];
                    
                    return (
                      <div
                        key={ev.id}
                        className="group relative bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500"
                      >
                        {/* Image Preview */}
                        {isImage ? (
                          <div 
                            className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer"
                            onClick={() => {
                              if (mediaUrl) {
                                window.open(mediaUrl, '_blank');
                              } else {
                                handleIncidentEvidenceDownload(incident.id, ev.id, ev.fileName);
                              }
                            }}
                          >
                            {mediaUrl ? (
                              <img
                                src={mediaUrl}
                                alt={ev.fileName}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <svg className="animate-spin w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              </div>
                            )}
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                              <span className="text-white text-sm font-medium flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View Full Size
                              </span>
                            </div>
                            {/* Evidence number badge */}
                            <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-md shadow">
                              #{index + 1}
                            </div>
                          </div>
                        ) : isVideo ? (
                          <div 
                            className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer"
                            onClick={() => {
                              if (mediaUrl) {
                                window.open(mediaUrl, '_blank');
                              } else {
                                handleIncidentEvidenceDownload(incident.id, ev.id, ev.fileName);
                              }
                            }}
                          >
                            {mediaUrl ? (
                              <video
                                src={mediaUrl}
                                className="w-full h-full object-cover"
                                controls={false}
                                muted
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <svg className="animate-spin w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              </div>
                            )}
                            {/* Video play icon overlay */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                              <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                            </div>
                            {/* Evidence number badge */}
                            <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-md shadow">
                              #{index + 1}
                            </div>
                          </div>
                        ) : (
                          /* Non-image/video file placeholder */
                          <div 
                            className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer flex items-center justify-center"
                            onClick={() => handleIncidentEvidenceDownload(incident.id, ev.id, ev.fileName)}
                          >
                            <div className="text-center p-4">
                              {isAudio ? (
                                <svg className="w-12 h-12 text-purple-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                              ) : (
                                <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                              <span className="text-sm text-gray-500 dark:text-gray-400">Click to download</span>
                            </div>
                            {/* Evidence number badge */}
                            <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-md shadow">
                              #{index + 1}
                            </div>
                          </div>
                        )}
                        
                        {/* File info footer */}
                        <div className="p-3 bg-white dark:bg-gray-800">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={ev.fileName}>
                            {ev.fileName}
                          </p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {ev.fileSize ? `${(ev.fileSize / 1024).toFixed(1)} KB` : (ev.mimeType || ev.fileType || 'File')}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIncidentEvidenceDownload(incident.id, ev.id, ev.fileName);
                              }}
                              className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </button>
                          </div>
                        </div>
                        
                        {/* Delete button - only visible for own uploads or admins */}
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteEvidence(ev.id, ev.fileName);
                            }}
                            disabled={isDeleting}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all disabled:opacity-50 z-10"
                            title="Delete evidence"
                          >
                            {isDeleting ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Visibility Settings - Only visible to owner */}
            {isOwner && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                  Visibility Settings
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {(['PRIVATE', 'TEAM', 'PUBLIC'] as const).map((vis) => (
                    <button
                      key={vis}
                      onClick={() => handleVisibilityRequest(vis)}
                      disabled={changingVisibility || incident.visibility === vis}
                      className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg border-2 transition-colors ${
                        incident.visibility === vis
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      } ${changingVisibility ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                          vis === 'PRIVATE' ? 'bg-gray-100 dark:bg-gray-700' :
                          vis === 'TEAM' ? 'bg-blue-100 dark:bg-blue-900' :
                          'bg-green-100 dark:bg-green-900'
                        }`}>
                          {vis === 'PRIVATE' && (
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                          {vis === 'TEAM' && (
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          )}
                          {vis === 'PUBLIC' && (
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {vis === 'PRIVATE' ? 'Private' : vis === 'TEAM' ? 'Team' : 'Public'}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                            {vis === 'PRIVATE' && 'Only you can see this incident'}
                            {vis === 'TEAM' && 'Invite collaborators to work together'}
                            {vis === 'PUBLIC' && 'Visible to all authorized users'}
                          </p>
                        </div>
                      </div>
                      {incident.visibility === vis && (
                        <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* People */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                People
              </h3>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Reported By</span>
                  <p className="text-xs sm:text-sm text-gray-900 dark:text-white">
                    {incident.User_Incident_createdByIdToUser.firstName} {incident.User_Incident_createdByIdToUser.lastName}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                    {incident.User_Incident_createdByIdToUser.email}
                  </p>
                </div>
                {incident.User_Incident_assignedToIdToUser && (
                  <div>
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Assigned To</span>
                    <p className="text-xs sm:text-sm text-gray-900 dark:text-white">
                      {incident.User_Incident_assignedToIdToUser.firstName} {incident.User_Incident_assignedToIdToUser.lastName}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                      {incident.User_Incident_assignedToIdToUser.email}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RCA Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                Root Cause Analysis
              </h3>

              {rcaAnalyses.length === 0 ? (
                <div className="text-center py-3 sm:py-4">
                  <svg className="mx-auto h-8 w-8 sm:h-10 sm:w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No RCA started yet
                  </p>
                  
                  {/* Public read-only mode - cannot start RCA */}
                  {isPublicReadOnly ? (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        🔒 This is a public incident. Only the creator can start RCA.
                      </p>
                    </div>
                  ) : canStartRCA ? (
                    <button
                      onClick={() => {
                        setRcaVisibility(incident?.visibility || 'PRIVATE');
                        // Pre-select AI-recommended method if available
                        if (incident?.aiAnalysisData?.recommendedRCAMethodology?.primary) {
                          setSelectedMethod(incident.aiAnalysisData.recommendedRCAMethodology.primary as 'FIVE_WHYS' | 'FISHBONE');
                        }
                        // Reset analysis state
                        setMethodologyRecommendation(null);
                        setTeamViewingModal([]);
                        setShowStartRCA(true);
                        // Emit WebSocket event for team sync
                        emitRCAModalState(incidentId, 'opened');
                      }}
                      className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start RCA
                    </button>
                  ) : isWorkplaceSafety && rcaAnalyses.length === 0 ? (
                    <div className="mt-4 space-y-3">
                      <button
                        disabled
                        className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg cursor-not-allowed"
                      >
                        Start RCA
                      </button>
                      
                      {/* Warning messages for Workplace Safety */}
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-left">
                        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mb-2">
                          Complete the following to enable Root Cause Analysis:
                        </p>
                        <ul className="space-y-1.5">
                          <li className="flex items-center gap-2 text-xs">
                            {incidentReportSubmitted ? (
                              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            <span className={incidentReportSubmitted ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-300'}>
                              Incident Report {incidentReportSubmitted ? '- Submitted' : '- Pending'}
                            </span>
                          </li>
                          <li className="flex items-center gap-2 text-xs">
                            {investigationSubmitted ? (
                              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            <span className={investigationSubmitted ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-300'}>
                              Investigation (Leader/Supervisor) {investigationSubmitted ? '- Submitted' : '- Pending'}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {rcaAnalyses.map((rca: any) => (
                    <Link
                      key={rca.id}
                      href={`/rca/${rca.id}`}
                      className="block p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {rca.method === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone'}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          rca.isValidated
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {rca.isValidated ? 'Validated' : rca.status?.replace('_', ' ')}
                        </span>
                      </div>
                      {rca.rootCauseStatement && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                          {rca.rootCauseStatement}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                Dates
              </h3>
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Reported</span>
                  <p className="text-xs sm:text-sm text-gray-900 dark:text-white">
                    {formatDateTime(incident.reportedAt)}
                  </p>
                </div>
                {incident.dueDate && (
                  <div>
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Due Date</span>
                    <p className="text-xs sm:text-sm text-gray-900 dark:text-white">
                      {formatDate(incident.dueDate)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Start RCA Modal */}
      {showStartRCA && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Start Root Cause Analysis
              </h3>
              {/* Team members viewing this modal indicator */}
              {teamViewingModal.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">👥</span>
                  <div className="flex -space-x-2">
                    {teamViewingModal.slice(0, 3).map((member) => (
                      <div
                        key={member.id}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium border-2 border-white dark:border-gray-800 ${
                          member.action === 'analyzing' ? 'bg-purple-500 text-white animate-pulse' : 'bg-blue-500 text-white'
                        }`}
                        title={`${member.name} ${member.action === 'analyzing' ? 'is analyzing...' : 'is viewing'}`}
                      >
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                    ))}
                    {teamViewingModal.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-gray-500 text-white flex items-center justify-center text-[10px] font-medium border-2 border-white dark:border-gray-800">
                        +{teamViewingModal.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AI Analysis Button - Thorough Analysis */}
            <div className="mb-4">
              <button
                onClick={handleAnalyzeMethodology}
                disabled={analyzingMethodology}
                className={`w-full p-3 border-2 border-dashed rounded-lg transition-all ${
                  analyzingMethodology
                    ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 cursor-wait'
                    : 'border-purple-300 dark:border-purple-600 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {analyzingMethodology ? (
                    <>
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        AI Analyzing Incident & Evidence...
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">🧠</span>
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        AI Analyze & Recommend Methodology
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Thoroughly analyze incident details, evidence, and context to recommend the best RCA method
                </p>
              </button>
            </div>

            {/* AI Recommendation Result */}
            {methodologyRecommendation && (
              <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🤖</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        AI Recommends: {methodologyRecommendation.recommendedMethod === 'FISHBONE' ? 'Fishbone Diagram' : '5 Whys'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        methodologyRecommendation.confidence >= 80 
                          ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200'
                          : methodologyRecommendation.confidence >= 60
                          ? 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {Math.round(methodologyRecommendation.confidence * (methodologyRecommendation.confidence <= 1 ? 100 : 1))}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      {methodologyRecommendation.reason}
                    </p>
                    
                    {/* Analysis Factors */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        methodologyRecommendation.factors.complexity === 'high' 
                          ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200'
                          : methodologyRecommendation.factors.complexity === 'medium'
                          ? 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200'
                          : 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200'
                      }`}>
                        {methodologyRecommendation.factors.complexity} complexity
                      </span>
                      {methodologyRecommendation.factors.recurrence && (
                        <span className="px-2 py-1 text-xs rounded-full bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200">
                          recurring issue
                        </span>
                      )}
                      {methodologyRecommendation.factors.hasMultipleCauses && (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200">
                          multiple causes
                        </span>
                      )}
                    </div>

                    {/* Alternative suggestion */}
                    {methodologyRecommendation.alternativeMethod && methodologyRecommendation.alternativeReason && (
                      <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-600">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Alternative:</span> {methodologyRecommendation.alternativeMethod === 'FISHBONE' ? 'Fishbone' : '5 Whys'} - {methodologyRecommendation.alternativeReason}
                        </p>
                      </div>
                    )}
                    
                    {/* Analyzed by (for team sync) */}
                    {methodologyRecommendation.analyzedBy && methodologyRecommendation.analyzedBy.id !== user?.id && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Analyzed by {methodologyRecommendation.analyzedBy.firstName} {methodologyRecommendation.analyzedBy.lastName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Legacy AI Recommendation Banner (from incident creation) */}
            {!methodologyRecommendation && incident?.aiAnalysisData?.recommendedRCAMethodology && (
              <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-purple-600 dark:text-purple-400">🤖</span>
                  <span className="text-purple-700 dark:text-purple-300 font-medium">
                    AI Recommends: {incident.aiAnalysisData.recommendedRCAMethodology.primary === 'FISHBONE' ? 'Fishbone Diagram' : '5 Whys'}
                  </span>
                  <span className="text-purple-500 dark:text-purple-400 text-xs">
                    ({incident.aiAnalysisData.recommendedRCAMethodology.confidence}% confidence)
                  </span>
                </div>
                {incident.aiAnalysisData.recommendedRCAMethodology.reason && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-6">
                    {incident.aiAnalysisData.recommendedRCAMethodology.reason}
                  </p>
                )}
              </div>
            )}

            {/* RCA Method Selection */}
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <span>🔍</span> Choose Analysis Method
              <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">(You have the final decision)</span>
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                  setSelectedMethod('FIVE_WHYS');
                  emitRCAModalState(incidentId, 'method-selected', { selectedMethod: 'FIVE_WHYS' });
                }}
                className={`w-full p-3 border rounded-lg text-left transition-colors ${
                  selectedMethod === 'FIVE_WHYS'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">5 Whys</p>
                      {(methodologyRecommendation?.recommendedMethod === 'FIVE_WHYS' || (!methodologyRecommendation && incident?.aiAnalysisData?.recommendedRCAMethodology?.primary === 'FIVE_WHYS')) && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200 rounded">
                          AI Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Iterative questioning to drill down to the root cause
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedMethod('FISHBONE');
                  emitRCAModalState(incidentId, 'method-selected', { selectedMethod: 'FISHBONE' });
                }}
                className={`w-full p-3 border rounded-lg text-left transition-colors ${
                  selectedMethod === 'FISHBONE'
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-teal-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">Fishbone (Ishikawa)</p>
                      {(methodologyRecommendation?.recommendedMethod === 'FISHBONE' || (!methodologyRecommendation && incident?.aiAnalysisData?.recommendedRCAMethodology?.primary === 'FISHBONE')) && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-teal-200 dark:bg-teal-700 text-teal-700 dark:text-teal-200 rounded">
                          AI Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Visual diagram to explore multiple cause categories
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowStartRCA(false);
                  setMethodologyRecommendation(null);
                  setTeamViewingModal([]);
                  emitRCAModalState(incidentId, 'closed');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleStartRCA}
                disabled={startingRCA || analyzingMethodology}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {startingRCA ? 'Starting...' : 'Start Analysis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Validation Modal - Shown when switching to Team with no members */}
      {showTeamValidationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-purple-50 dark:bg-purple-900/30 px-6 py-4 border-b border-purple-200 dark:border-purple-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Team Mode Requires Members
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No team members assigned
                  </p>
                </div>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                This incident is set to <span className="font-semibold text-purple-600 dark:text-purple-400">Team mode</span>, but no team members are currently assigned.
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                To continue working as a Team Incident, please add at least one team member.
              </p>
              
              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-4 border border-blue-200 dark:border-blue-700">
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">💡</span>
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">You can also continue working solo</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Continue as Private or Public and add team members later by switching back to Team.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Reminder */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
                <p>✅ Team members can be added at any time by switching to Team</p>
                <p className="mt-1">✅ The incident can be converted back to Team mode later without data loss</p>
              </div>
            </div>
            
            {/* Modal Actions */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 space-y-3">
              {/* Primary Action - Add Team Member */}
              <button
                onClick={() => {
                  setShowTeamValidationModal(false);
                  // Set pending team visibility - will be validated when leaving team tab
                  setPendingTeamVisibility(true);
                  // Change visibility to TEAM
                  handleChangeVisibility('TEAM');
                  // Open chat sidebar on team tab
                  setChatSidebarOpen(true);
                  setChatSidebarTab('team');
                }}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <span>👥</span>
                Switch to Team & Add Members
              </button>
              
              {/* Secondary Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowTeamValidationModal(false);
                    // Stay as Private (or set to Private if not already)
                    if (incident?.visibility !== 'PRIVATE') {
                      handleChangeVisibility('PRIVATE');
                    }
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                >
                  🔐 Continue as Private
                </button>
                <button
                  onClick={() => {
                    setShowTeamValidationModal(false);
                    // Change to Public
                    if (incident?.visibility !== 'PUBLIC') {
                      handleChangeVisibility('PUBLIC');
                    }
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                >
                  🌐 Continue as Public
                </button>
              </div>
              
              {/* Cancel */}
              <button
                onClick={() => setShowTeamValidationModal(false)}
                className="w-full px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Collaboration Chat Panel - Show only for owner, assignee, or active participants */}
      {incident && user && canAccessChat && (
        <ChatSidebar
          incidentId={incidentId}
          incidentTitle={incident.customTitle || incident.Category?.name || `Incident ${incident.incidentNumber}`}
          currentUserId={user.id}
          organizationId={user.organizationId}
          isParticipant={canAccessChat}
          participants={(incident.IncidentParticipant || [])
            .filter(p => p.User_IncidentParticipant_userIdToUser || p.user)
            .map(p => {
              const userData = p.User_IncidentParticipant_userIdToUser || p.user;
              return {
                id: p.id,
                userId: p.userId,
                role: p.role,
                canEdit: p.canEdit,
                canChat: p.canChat,
                isActive: p.isActive,
                user: {
                  id: userData!.id,
                  firstName: userData!.firstName,
                  lastName: userData!.lastName,
                  email: userData!.email,
                  role: userData!.role,
                  isOnline: onlineUsers.has(userData!.id),
                  profilePicture: userData!.profilePicture,
                }
              };
            })}
          onParticipantsChange={(newParticipants) => {
            setIncident(prev => prev ? {
              ...prev,
              IncidentParticipant: newParticipants
            } : null);
          }}
          isTeamIncident={incident.isTeamIncident || false}
          onVisibilityChange={(newVisibility) => {
            setIncident(prev => prev ? {
              ...prev,
              visibility: newVisibility,
              isTeamIncident: newVisibility === 'TEAM',
            } : null);
          }}
          visibility={incident.visibility}
          defaultOpen={chatSidebarOpen}
          defaultTab={chatSidebarTab}
          ownerId={incident.User_Incident_createdByIdToUser?.id}
          onTeamTabClosed={(hasTeamMembers) => {
            // Reset sidebar control state
            setChatSidebarOpen(false);
            setChatSidebarTab('chat');
            
            // If we're in pending team visibility mode and no members were added
            if (pendingTeamVisibility) {
              setPendingTeamVisibility(false);
              if (!hasTeamMembers) {
                // Revert to PRIVATE since no team members were added
                handleChangeVisibility('PRIVATE');
              }
            }
          }}
        />
      )}
    </div>
  );
}
